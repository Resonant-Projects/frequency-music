import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { VOICE_CATALOG, voiceById } from "../../convex/shared/voices";
import { synthTone } from "../src/audio/synth";
import {
  chooseIntroVoice,
  introText,
  shootoutHandler,
  shuffleWithSeed,
  spokenLabel,
} from "../src/jobs/shootout";
import type { NewArtifact, ToolClient } from "../src/jobs/types";

const dirs: string[] = [];
function workDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("shootout job", () => {
  test("shuffle is deterministic per seed and labels are ordinal words", () => {
    expect(shuffleWithSeed(["a", "b", "c", "d"], "job-1")).toEqual(
      shuffleWithSeed(["a", "b", "c", "d"], "job-1"),
    );
    expect(shuffleWithSeed(["a", "b", "c", "d"], "job-1").toSorted()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(spokenLabel(0)).toBe("take one");
    expect(spokenLabel(3)).toBe("take four");
    // Matches the effect's ORDINALS table (one..eight) exactly.
    expect(spokenLabel(7)).toBe("take eight");
  });

  test("R26: the intro voice is a configured non-candidate when one exists, hosted first", () => {
    const [gemini, inworld, elevenlabs, breeze] = VOICE_CATALOG;
    // Two candidates, two configured bystanders: the hosted bystander wins
    // even when the local one is listed first.
    const chosen = chooseIntroVoice(
      [inworld!, elevenlabs!],
      [breeze!, inworld!, gemini!, elevenlabs!],
    );
    expect(chosen).toEqual({ voice: gemini, isCandidate: false });
    expect(introText(2, chosen.isCandidate)).toBe(
      "This intro voice is not a candidate. You will hear 2 takes of the same passage. Rate each one before the reveal.",
    );
    // Only a local bystander: still preferred over any candidate.
    expect(
      chooseIntroVoice(
        [inworld!, elevenlabs!],
        [inworld!, elevenlabs!, breeze!],
      ).voice.id,
    ).toBe("breeze-2");
    // The whole configured catalog competes: a candidate announces (first
    // hosted one) and the intro must not claim it is a bystander.
    const fallback = chooseIntroVoice(
      [breeze!, inworld!, elevenlabs!],
      [breeze!, inworld!, elevenlabs!],
    );
    expect(fallback).toEqual({ voice: inworld, isCandidate: true });
    expect(introText(3, fallback.isCandidate)).toBe(
      "You will hear 3 takes of the same passage. Rate each one before the reveal.",
    );
    // No hosted voice anywhere: the first candidate announces.
    expect(chooseIntroVoice([breeze!], [breeze!])).toEqual({
      voice: breeze,
      isCandidate: true,
    });
  });

  test("R26: a configured catalog voice outside voiceIds renders the intro and labels", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("INWORLD_API_KEY", "k");
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    const synth = vi.fn(
      async (
        text: string,
        _voice: { id: string },
        out: string,
        signal?: AbortSignal,
      ) => {
        await synthTone(
          out,
          { hz: 440, seconds: Math.max(1, Math.min(3, text.length / 40)) },
          signal,
        );
      },
    );
    let mintedCount = 0;
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(async () => {
        mintedCount += 1;
        return { artifactId: `a${mintedCount}`, uploadUrl: "http://u" };
      }),
      attachAudioStorage: vi.fn(async () => null),
      uploadBytes: vi.fn(async () => ({ storageId: "s" })),
    };
    const result = await shootoutHandler(
      {
        job: {
          jobId: "job-8",
          kind: "shootout",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "shootout",
            passage: ["One paragraph."],
            voiceIds: ["inworld-max", "elevenlabs-v3"],
            title: "Voice shootout",
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("shoot-intro-"),
        tools,
        rendererVersion: "0.2.0",
        signal: new AbortController().signal,
      },
      { synthesize: synth },
    );
    expect(result.skippedVoiceIds).toEqual([]);
    expect(result.takes.map((take) => take.voiceId).toSorted()).toEqual([
      "elevenlabs-v3",
      "inworld-max",
    ]);
    const calls = synth.mock.calls.map(([text, voice]) => ({
      text,
      voiceId: voice.id,
    }));
    const intro = calls.find((call) => call.text.includes("You will hear"));
    expect(intro).toEqual({
      text: "This intro voice is not a candidate. You will hear 2 takes of the same passage. Rate each one before the reveal.",
      voiceId: "gemini-flash-tts",
    });
    expect(
      calls.filter((call) => /^take (one|two)\.$/.test(call.text)),
    ).toEqual([
      { text: "take one.", voiceId: "gemini-flash-tts" },
      { text: "take two.", voiceId: "gemini-flash-tts" },
    ]);
    // The bystander never renders the passage.
    expect(
      calls
        .filter((call) => call.text === "One paragraph.")
        .map((c) => c.voiceId)
        .toSorted(),
    ).toEqual(["elevenlabs-v3", "inworld-max"]);
    expect(voiceById(intro!.voiceId).runsOn).toBe("hosted");
  });

  test("skips unconfigured voices, renders the rest, assembles an episode, returns member order", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    // gemini and breeze unconfigured
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const signals: (AbortSignal | undefined)[] = [];
    const synth = vi.fn(
      async (
        text: string,
        voice: { id: string },
        out: string,
        signal?: AbortSignal,
      ) => {
        signals.push(signal);
        await synthTone(
          out,
          {
            hz: voice.id === "inworld-max" ? 440 : 660,
            seconds: Math.max(1, Math.min(3, text.length / 40)),
            gainDb: -25,
          },
          signal,
        );
      },
    );
    const roles: string[] = [];
    const minted: NewArtifact[] = [];
    const uploadSignals: (AbortSignal | undefined)[] = [];
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(async ({ artifact }) => {
        roles.push(`${artifact.kind}:${artifact.role}`);
        minted.push(artifact);
        return { artifactId: `a${roles.length}`, uploadUrl: "http://u" };
      }),
      attachAudioStorage: vi.fn(async () => null),
      uploadBytes: vi.fn(
        async (
          _url: string,
          _path: string,
          _mimeType: string,
          signal?: AbortSignal,
        ) => {
          uploadSignals.push(signal);
          return { storageId: "s" };
        },
      ),
    };
    const signal = new AbortController().signal;
    const result = await shootoutHandler(
      {
        job: {
          jobId: "job-7",
          kind: "shootout",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "shootout",
            passage: [
              "First paragraph of the passage.",
              "Second paragraph, a little longer than the first.",
            ],
            voiceIds: [
              "gemini-flash-tts",
              "inworld-max",
              "elevenlabs-v3",
              "breeze-2",
            ],
            title: "Voice shootout",
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("shoot-"),
        tools,
        rendererVersion: "0.2.0",
        signal,
      },
      { synthesize: synth },
    );
    expect(result.kind).toBe("shootout");
    // R26 fallback: every configured catalog voice is a candidate here, so
    // the first configured hosted candidate announces and the intro does
    // not claim to be a bystander.
    const calls = synth.mock.calls.map(([text, voice]) => ({
      text,
      voiceId: voice.id,
    }));
    expect(calls.find((call) => call.text.includes("You will hear"))).toEqual({
      text: "You will hear 2 takes of the same passage. Rate each one before the reveal.",
      voiceId: "inworld-max",
    });
    expect(
      calls.filter((call) => /^take (one|two)\.$/.test(call.text)),
    ).toEqual([
      { text: "take one.", voiceId: "inworld-max" },
      { text: "take two.", voiceId: "inworld-max" },
    ]);
    expect(result.skippedVoiceIds.toSorted()).toEqual([
      "breeze-2",
      "gemini-flash-tts",
    ]);
    // Skipped voices are logged by id.
    const warned = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(warned).toContain("gemini-flash-tts");
    expect(warned).toContain("breeze-2");
    expect(result.takes.map((take) => take.voiceId).toSorted()).toEqual([
      "elevenlabs-v3",
      "inworld-max",
    ]);
    expect(result.memberOrder.toSorted()).toEqual([
      "elevenlabs-v3",
      "inworld-max",
    ]);
    expect(result.takes.map((take) => take.label).toSorted()).toEqual([
      "take one",
      "take two",
    ]);
    // Takes come back in presentation order, and each label is the one the
    // effect derives from its memberOrder position.
    expect(result.takes.map((take) => take.voiceId)).toEqual(
      result.memberOrder,
    );
    for (const take of result.takes) {
      expect(take.label).toBe(
        spokenLabel(result.memberOrder.indexOf(take.voiceId)),
      );
    }
    expect(
      result.takes.every(
        (take) => take.master.artifactId !== take.artifact.artifactId,
      ),
    ).toBe(true);
    expect(result.episodeMaster.artifactId).not.toBe(result.episode.artifactId);
    expect(
      roles.filter((role) => role.startsWith("shootoutTake:delivery")),
    ).toHaveLength(2);
    expect(
      roles.filter((role) => role.startsWith("shootoutTake:masterNormalized")),
    ).toHaveLength(2);
    expect(
      roles.filter((role) => role.startsWith("episode:delivery")),
    ).toHaveLength(1);
    expect(
      roles.filter((role) => role.startsWith("episode:masterNormalized")),
    ).toHaveLength(1);
    // R18/R21: masters are private; take deliveries are private blind
    // members; only the episode delivery is published to the feed.
    for (const artifact of minted) {
      if (artifact.role === "masterNormalized") {
        expect(artifact.access).toBe("private");
      } else if (artifact.kind === "shootoutTake") {
        expect(artifact.access).toBe("private");
      } else {
        expect(artifact.kind).toBe("episode");
        expect(artifact.access).toBe("feed");
      }
    }
    // Episode chapters mark each take at the tone that announces it: after
    // the intro, then one full slot (tone, label, gap, take, gap) apart.
    const episodeDelivery = minted.find(
      (artifact) => artifact.kind === "episode" && artifact.role === "delivery",
    );
    const chapters = episodeDelivery?.chapters ?? [];
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      "take one",
      "take two",
    ]);
    expect(chapters[0]!.startSecs).toBeGreaterThan(0);
    expect(chapters[1]!.startSecs - chapters[0]!.startSecs).toBeGreaterThan(
      0.5 + 1 + 1 + result.takes[0]!.artifact.durationSecs + 2 - 0.1,
    );
    expect(result.episode.durationSecs).toBeGreaterThan(
      result.takes[0]!.artifact.durationSecs +
        result.takes[1]!.artifact.durationSecs +
        7,
    );
    for (const artifact of [
      ...result.takes.flatMap((take) => [take.artifact, take.master]),
      result.episode,
      result.episodeMaster,
    ]) {
      expect(Math.abs(artifact.loudnessLufs + 16)).toBeLessThanOrEqual(0.5);
      expect(artifact.truePeakDbtp).toBeLessThanOrEqual(-1);
    }
    // R8: the job signal reaches every synth call and every upload.
    expect(signals.length).toBeGreaterThan(0);
    for (const seen of signals) expect(seen).toBe(signal);
    expect(uploadSignals).toHaveLength(6);
    for (const seen of uploadSignals) expect(seen).toBe(signal);
  });

  test("fewer than two configured voices fails the job", async () => {
    vi.stubEnv("INWORLD_API_KEY", "k");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tools: ToolClient = {
      generateAudioUploadUrl: vi.fn(),
      attachAudioStorage: vi.fn(),
      uploadBytes: vi.fn(),
    };
    await expect(
      shootoutHandler(
        {
          job: {
            jobId: "j",
            kind: "shootout",
            leaseToken: "L",
            leaseExpiresAt: Date.now() + 60_000,
            attempts: 0,
            input: {
              kind: "shootout",
              passage: ["p"],
              voiceIds: ["inworld-max", "breeze-2"],
              title: "t",
              rendererVersion: "0.2.0",
            },
          },
          workDir: workDir("shoot2-"),
          tools,
          rendererVersion: "0.2.0",
          signal: new AbortController().signal,
        },
        {
          synthesize: vi.fn(async (_t: string, _v: unknown, out: string) =>
            synthTone(out, { hz: 440, seconds: 1 }),
          ),
        },
      ),
    ).rejects.toThrow(/at least two/);
    expect(tools.generateAudioUploadUrl).not.toHaveBeenCalled();
  });

  test("refuses another job kind", async () => {
    await expect(
      shootoutHandler({
        job: {
          jobId: "j",
          kind: "probe",
          leaseToken: "L",
          leaseExpiresAt: Date.now() + 60_000,
          attempts: 0,
          input: {
            kind: "probe",
            toneHz: 440,
            seconds: 1,
            rendererVersion: "0.2.0",
          },
        },
        workDir: workDir("shoot-kind-"),
        tools: {
          generateAudioUploadUrl: vi.fn(),
          attachAudioStorage: vi.fn(),
          uploadBytes: vi.fn(),
        },
        rendererVersion: "0.2.0",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/another kind/);
  });
});
