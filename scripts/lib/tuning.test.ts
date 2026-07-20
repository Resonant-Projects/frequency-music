import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import {
  NAMED_TUNINGS,
  parsePitchToken,
  parseTuningFromParameters,
  parseTuningFromParametersWithReason,
  slugify,
  toKbm,
  toScl,
  tuningIntervalsInCents,
} from "./tuning";

function scalaLinesWithoutComments(contents: string): string[] {
  return contents
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("!"));
}

function scalaIntervals(contents: string): Array<number | string> {
  const intervals = scalaLinesWithoutComments(contents)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const countText = intervals.shift();
  expect(intervals).toHaveLength(Number(countText));
  return intervals.map((interval) =>
    interval.includes("/") ? interval : Number(interval),
  );
}

function scalaBody(contents: string): string {
  return scalaLinesWithoutComments(contents).join("\n").replace(/^\n+/, "");
}

async function scaleFixture(filename: string): Promise<string> {
  return await readFile(
    new URL(`../../scales/${filename}`, import.meta.url),
    "utf8",
  );
}

describe("tuning parameters to Scala", () => {
  test.each(
    Object.entries(NAMED_TUNINGS),
  )("keeps named tuning %s aligned with its Scala file", async (name, tuning) => {
    const fixture = await scaleFixture(`${name}.scl`);
    const spec = parseTuningFromParameters([
      { type: "tuningSystem", value: tuning.aliases[0]! },
    ]);

    expect(spec).toEqual({ kind: "named", name });
    expect(scalaIntervals(fixture)).toEqual(tuning.intervals);
  });

  test("matches the hand-written geometric keyboard mapping body", async () => {
    const fixture = await scaleFixture("geometric-temperament.kbm");
    const generated = toKbm(
      { kind: "named", name: "geometric-temperament" },
      "C4",
    );

    expect(scalaBody(generated)).toBe(scalaBody(fixture));
  });

  test("emits an equal division of the octave", () => {
    expect(toScl({ kind: "edo", divisions: 4 }, "4-EDO")).toBe(
      "! tuning.scl\n!\n4-EDO\n4\n!\n300.00000\n600.00000\n900.00000\n2/1\n",
    );
  });

  test("emits JI ratios without the implicit unison", () => {
    expect(
      toScl(
        { kind: "ji", ratios: ["2/1", "3/2", "1/1", "9/8", "5/4"] },
        "Five-note JI",
      ),
    ).toContain("4\n!\n9/8\n5/4\n3/2\n2/1\n");
  });

  test("emits explicit cents and normalizes a 1200-cent octave", () => {
    expect(
      toScl({ kind: "cents", values: [1200, 386.31371, 100, 1200] }, "Cents"),
    ).toContain("3\n!\n100.00000\n386.31371\n2/1\n");
  });

  test("converts JI ratios to ascending cents with a normalized octave", () => {
    const cents = tuningIntervalsInCents({
      kind: "ji",
      ratios: ["3/2", "1/1", "5/4"],
    });

    expect(cents).toHaveLength(3);
    expect(cents[0]).toBeCloseTo(386.31371, 5);
    expect(cents[1]).toBeCloseTo(701.955, 5);
    expect(cents[2]).toBeCloseTo(1200, 5);
  });

  test("returns a typed reason instead of throwing for an unsupported tuning", () => {
    expect(
      parseTuningFromParametersWithReason([
        { type: "tuningSystem", value: "Quarter-comma meantone" },
      ]),
    ).toEqual({
      spec: null,
      reason: {
        code: "unsupported_tuning",
        message: 'Unsupported tuning system: "Quarter-comma meantone".',
      },
    });
    expect(
      parseTuningFromParameters([
        { type: "tuningSystem", value: "Quarter-comma meantone" },
      ]),
    ).toBeNull();
  });

  test("parses type-only EDO and explicit interval details", () => {
    expect(
      parseTuningFromParameters([{ type: "tuningSystem", value: "19-EDO" }]),
    ).toEqual({ kind: "edo", divisions: 19 });
    expect(
      parseTuningFromParameters([
        {
          canonicalKind: "tuningSystem",
          value: "custom just intonation",
          details: { ratios: ["1/1", "9/8", "3/2", "2/1"] },
        },
      ]),
    ).toEqual({ kind: "ji", ratios: ["1/1", "9/8", "3/2", "2/1"] });
  });

  test("maps the requested root note in a valid KBM", () => {
    const kbm = toKbm({ kind: "edo", divisions: 19 }, "D4");
    expect(kbm).toContain("! Middle note (scale degree 0)\n62\n");
    expect(kbm).toContain("! Reference note\n69\n");
    expect(kbm).toContain("! Reference frequency\n440.00000\n");
    expect(kbm).toContain("! Reference scale degree\n7\n");
  });

  test("rejects a zero-denominator ratio as a typed parse failure", () => {
    expect(
      parseTuningFromParametersWithReason([
        {
          type: "tuningSystem",
          value: "custom JI",
          details: { ratios: ["1/1", "3/0", "2/1"] },
        },
      ]),
    ).toMatchObject({
      spec: null,
      reason: { code: "invalid_tuning_details" },
    });
  });

  test.each([
    ["key of C major", "C"],
    ["Root: F#3", "F#3"],
    ["Bb-1 drone", "Bb-1"],
    ["prepared piano", null],
  ])("extracts a pitch token from %s", (value, expected) => {
    expect(parsePitchToken(value)).toBe(expected);
  });

  test("creates a filesystem-safe production slug", () => {
    expect(slugify(" Golden Ratio & Tuning Study ")).toBe(
      "golden-ratio-tuning-study",
    );
  });
});
