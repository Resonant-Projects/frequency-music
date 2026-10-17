import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { STUDIO_ENCODE_COMMAND } from "./studioComparison";

// finishUpload refuses a studio MP3 whose encoding or encoder header differs
// from the machine delivery, so the documented command must stay the media
// engine's delivery encode. The engine is another package; read its source.
const engineSource = readFileSync(
  join(import.meta.dirname, "../../media/src/engines/sc/index.ts"),
  "utf8",
);

describe("STUDIO_ENCODE_COMMAND", () => {
  test("uses the litmus engine's delivery ffmpeg arguments", () => {
    const call = engineSource
      .split("await ffmpeg([")
      .slice(1)
      .map((rest) => rest.slice(0, rest.indexOf("]);")))
      .filter((args) => args.includes('"libmp3lame"'));
    expect(call).toHaveLength(1);
    // String literals only: the input and output paths are variables there.
    const engineArgs = [...call[0]!.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    const [program, input, inputPath, ...rest] =
      STUDIO_ENCODE_COMMAND.split(" ");
    const output = rest.pop();
    expect({ program, input, inputPath, output }).toEqual({
      program: "ffmpeg",
      input: "-i",
      inputPath: "studio-master.wav",
      output: "studio-delivery.mp3",
    });
    expect([input, ...rest]).toEqual(engineArgs);
  });
});
