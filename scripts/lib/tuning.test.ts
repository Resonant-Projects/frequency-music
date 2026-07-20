import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import {
  parseTuningFromParameters,
  parseTuningFromParametersWithReason,
  toKbm,
  toScl,
} from "./tuning";

function scalaBody(contents: string): string {
  return contents
    .split("\n")
    .filter((line) => !line.startsWith("!"))
    .join("\n")
    .replace(/^\n+/, "");
}

describe("tuning parameters to Scala", () => {
  test("matches the hand-written geometric temperament interval body", async () => {
    const fixture = await readFile(
      new URL("../../scales/geometric-temperament.scl", import.meta.url),
      "utf8",
    );
    const spec = parseTuningFromParameters([
      { type: "tuningSystem", value: "Geometric Temperament" },
    ]);

    expect(spec).toEqual({ kind: "named", name: "geometric-temperament" });
    expect(scalaBody(toScl(spec!, "Generated geometric temperament"))).toBe(
      scalaBody(fixture),
    );
  });

  test("emits an equal division of the octave", () => {
    expect(toScl({ kind: "edo", divisions: 4 }, "4-EDO")).toBe(
      "! tuning.scl\n! 4-EDO\n4\n!\n300.00000\n600.00000\n900.00000\n2/1\n",
    );
  });

  test("emits JI ratios without the implicit unison", () => {
    expect(
      toScl(
        { kind: "ji", ratios: ["1/1", "9/8", "5/4", "3/2", "2/1"] },
        "Five-note JI",
      ),
    ).toContain("4\n!\n9/8\n5/4\n3/2\n2/1\n");
  });

  test("emits explicit cents and normalizes a 1200-cent octave", () => {
    expect(
      toScl({ kind: "cents", values: [100, 386.31371, 1200] }, "Cents"),
    ).toContain("3\n!\n100.00000\n386.31371\n2/1\n");
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
    const kbm = toKbm({ kind: "edo", divisions: 12 }, "D4");
    expect(kbm).toContain("! Middle note (scale degree 0)\n62\n");
    expect(kbm).toContain("! Reference note\n69\n");
    expect(kbm).toContain("! Reference frequency\n440.00000\n");
    expect(kbm).toContain("! Reference scale degree\n7\n");
  });
});
