import { writeFile } from "node:fs/promises";
import { voiceById } from "../../convex/shared/voices";
import { runFfmpeg } from "../../media/src/audio/ffmpeg";
import {
  CARTESIA_API_VERSION,
  CARTESIA_SAMPLE_RATE,
  synthesizeCartesia,
} from "../../media/src/tts/cartesia";
import { wrapPcmAsWav } from "../../media/src/tts/elevenlabs";

export type VoiceKey =
  | "inworld"
  | "elevenlabs"
  | "voxtral"
  | "cartesia-nandi"
  | "cartesia-quentin";
type Voice = {
  key: VoiceKey;
  catalogId: string;
  label: string;
  // Request size. Voxtral drifts on long inputs, so it gets short chunks.
  maxChars: number;
  paid: boolean;
  // Re-renders allowed for a chunk that fails the sanity gate.
  retries: number;
  // Lay a noise bed under the gaps at the take's own floor (see pacing.ts).
  roomTone: boolean;
  settings: Record<string, unknown>;
};

export function voiceFor(
  key: VoiceKey,
  options: { elevenVoiceId?: string; elevenVoiceName?: string } = {},
): Voice {
  if (key === "cartesia-nandi" || key === "cartesia-quentin") {
    const entry = voiceById(key.replace("cartesia-", "cartesia-sonic-"));
    return {
      key,
      catalogId: entry.id,
      label: `Cartesia Sonic, ${key === "cartesia-nandi" ? "Nandi" : "Quentin"}`,
      maxChars: 2000,
      paid: true,
      retries: 1,
      roomTone: false,
      settings: {
        model: entry.model,
        voice: entry.voiceId,
        apiVersion: CARTESIA_API_VERSION,
        sampleRate: CARTESIA_SAMPLE_RATE,
      },
    };
  }
  if (key === "inworld") {
    return {
      key,
      catalogId: "inworld-max",
      label: "Inworld Max, Dennis",
      maxChars: 1900,
      paid: true,
      retries: 1,
      roomTone: false,
      settings: { model: "inworld-tts-1.5-max", voice: "Dennis" },
    };
  }
  if (key === "elevenlabs") {
    const voiceId = options.elevenVoiceId ?? "JBFqnCBsd6RMkjVDRZzb";
    const name = options.elevenVoiceName ?? "George";
    return {
      key,
      catalogId: `elevenlabs-v4-${name.toLowerCase().replaceAll(/\W+/g, "-")}`,
      label: `ElevenLabs v4, ${name}`,
      maxChars: 2400,
      paid: true,
      retries: 1,
      roomTone: true,
      settings: {
        model: "eleven_v4",
        voice: voiceId,
        stability: 0.5,
        similarity_boost: 0.75,
        // 44.1 kHz PCM needs the Pro tier (403 output_format_not_allowed on
        // this plan); 192 kbps MP3 is the best format it allows.
        output_format: "mp3_44100_192",
      },
    };
  }
  if (key !== "voxtral") throw new Error(`unknown voice ${String(key)}`);
  return {
    key,
    catalogId: "voxtral-male-preset",
    label: "Voxtral, male preset",
    maxChars: 360,
    paid: false,
    retries: 3,
    roomTone: false,
    settings: {
      model: "mistralai/Voxtral-4B-TTS-2603",
      voice: "neutral_male",
      seed: 42,
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function synthesize(
  voice: Voice,
  text: string,
  attempt: number,
  output: string,
  voxtralUrl?: string,
): Promise<void> {
  const signal = AbortSignal.timeout(300_000);
  if (voice.key === "cartesia-nandi" || voice.key === "cartesia-quentin") {
    // The essay ledger accounts for each paid request. Do not let the
    // provider retry invisibly beneath that cap.
    await synthesizeCartesia(text, voiceById(voice.catalogId), output, signal, {
      attempts: 1,
    });
    return;
  }
  let response: Response;
  if (voice.key === "inworld") {
    response = await fetch("https://api.inworld.ai/tts/v1/voice", {
      method: "POST",
      headers: {
        authorization: `Basic ${requireEnv("INWORLD_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId: voice.settings.voice,
        modelId: voice.settings.model,
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 48000 },
      }),
      redirect: "error",
      signal,
    });
  } else if (voice.key === "elevenlabs") {
    const { voice: id, output_format, model, ...settings } = voice.settings;
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${String(id)}?output_format=${String(output_format)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": requireEnv("ELEVENLABS_API_KEY"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: settings,
        }),
        redirect: "error",
        signal,
      },
    );
  } else {
    if (!voxtralUrl) throw new Error("--voxtral-url is required for Voxtral");
    response = await fetch(`${voxtralUrl.replace(/\/$/, "")}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: voice.settings.model,
        input: text,
        voice: voice.settings.voice,
        // A re-render after a failed gate tries another seed.
        seed: Number(voice.settings.seed) + attempt,
        response_format: "wav",
      }),
      redirect: "error",
      signal,
    });
  }
  // Status only: a body may echo the request.
  if (!response.ok) throw new Error(`${voice.key} status ${response.status}`);
  if (voice.key === "inworld") {
    const body = (await response.json()) as { audioContent: string };
    const pcm = new Uint8Array(Buffer.from(body.audioContent, "base64"));
    await writeFile(output, wrapPcmAsWav(pcm, 48000, 1));
  } else if (voice.key === "elevenlabs") {
    const mp3 = `${output}.mp3`;
    await writeFile(mp3, new Uint8Array(await response.arrayBuffer()));
    await runFfmpeg(["-i", mp3, "-ac", "1", "-c:a", "pcm_s24le", output]);
  } else {
    await writeFile(output, new Uint8Array(await response.arrayBuffer()));
  }
}
