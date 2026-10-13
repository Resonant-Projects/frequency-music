import { describe, expect, test, vi } from "vite-plus/test";
import {
  admitRenderPlan,
  expandRenderPlan,
  renderPlanMemberCount,
  renderPlanSnapshotZ,
  renderPlanZ,
  renderTuningZ,
  RENDER_LIMITS,
  type RenderPlan,
} from "./renderPlan";
import {
  degreeToHz,
  prepareDegreeToHz,
  generateSeedEvents,
  octaveDegreeCents,
  tuningIntervalsInCents,
  type TuningSpec,
} from "./tuning";

const geometric: TuningSpec = { kind: "named", name: "geometric-temperament" };
const edo19: TuningSpec = { kind: "edo", divisions: 19 };

function fixture(): RenderPlan {
  return {
    version: 1,
    engine: "sc-litmus",
    tuning: geometric,
    referenceHz: 432,
    normalize: true,
    seed: generateSeedEvents([], geometric).events,
    tempoBpm: 120,
    durationSecs: 30,
  };
}

describe("octave-native pitch", () => {
  test("keeps Scala intervals separate from degree-zero unison", () => {
    expect(tuningIntervalsInCents(edo19)[0]).toBeCloseTo(1200 / 19);
    expect(tuningIntervalsInCents(edo19).at(-1)).toBe(1200);
    expect(octaveDegreeCents(edo19)).toHaveLength(19);
    expect(octaveDegreeCents(edo19)[0]).toBe(0);
    expect(degreeToHz(edo19, 432, 0)).toBe(432);
    expect(degreeToHz(edo19, 432, 1)).toBeCloseTo(432 * 2 ** (1 / 19), 10);
    expect(degreeToHz(edo19, 432, 18)).toBeCloseTo(432 * 2 ** (18 / 19), 10);
    expect(degreeToHz(edo19, 432, 0, 1)).toBe(864);
    expect(degreeToHz(edo19, 432, 0, -1)).toBe(216);
  });

  test.each([
    [0, 432],
    [4, 540],
    [5, 576],
    [7, 648],
    [9, 720],
    [11, 810],
  ])(
    "geometric degree %i at 432 Hz is within 0.01 cents of %i Hz",
    (degree, expected) => {
      expect(
        Math.abs(
          1200 * Math.log2(degreeToHz(geometric, 432, degree) / expected),
        ),
      ).toBeLessThan(0.01);
    },
  );

  test("accepts one-degree scales and inclusive frequency bounds", () => {
    expect(octaveDegreeCents({ kind: "edo", divisions: 1 })).toEqual([0]);
    expect(degreeToHz(edo19, 20, 0)).toBe(20);
    expect(degreeToHz(edo19, 1250, 0, 4)).toBe(20000);
  });

  test.each([-1, 19, 0.5, NaN, Infinity])(
    "rejects degree %s instead of wrapping",
    (degree) => {
      expect(() => degreeToHz(edo19, 432, degree)).toThrow("Degree");
    },
  );

  test.each([-100, 100, 0.5, Infinity])(
    "rejects invalid or out-of-range octave %s",
    (octave) => {
      expect(() => degreeToHz(edo19, 432, 0, octave)).toThrow();
    },
  );

  test.each([0, -1, NaN, Infinity, 19, 20001])(
    "rejects reference producing invalid Hz %s",
    (referenceHz) => {
      expect(() => degreeToHz(edo19, referenceHz, 0)).toThrow();
    },
  );
});

describe("degree-native seed", () => {
  test("visits all 19 degrees without rounding or merging", () => {
    const result = generateSeedEvents([], edo19);
    expect(result).toEqual(generateSeedEvents([], edo19));
    expect(new Set(result.events.map((event) => event.degree)).size).toBe(19);
    expect(result.events.slice(0, 3).map((event) => event.degree)).toEqual([
      0, 1, 2,
    ]);
    expect(result.events.at(-1)!.startBeat + result.events.at(-1)!.beats).toBe(
      result.bars * 4,
    );
  });

  test("retains timing and parameter interpretation without a MIDI dependency", () => {
    const result = generateSeedEvents(
      [
        { type: "tempo", value: "96 BPM" },
        { type: "rootNote", value: "G9" },
        { type: "rhythm", value: "eighth notes" },
        { type: "form", value: "16 bars" },
        { type: "chordProgression", value: "V-I" },
      ],
      edo19,
    );
    expect(result).toMatchObject({
      tempoBpm: 96,
      rootMidi: 127,
      bars: 16,
      honoredParameterIndexes: [0, 1, 2, 3, 4],
    });
    expect(result.events).toHaveLength(128);
    expect(result.events[0]).toEqual({
      degree: 4,
      octave: 0,
      startBeat: 0,
      beats: 0.5,
      velocity: 72,
    });
    expect(result.events[8]!.degree).toBe(0);
  });
});

describe("validated render plans", () => {
  test("expands temperament mappings with the same immutable detached event list", () => {
    const input = fixture();
    input.variable = {
      kind: "temperament",
      variants: [{ kind: "edo", divisions: 12 }],
    };
    const variants = expandRenderPlan(input);
    expect(variants).toHaveLength(2);
    expect(variants[0]!.seed).toBe(variants[1]!.seed);
    expect(JSON.stringify(variants[0]!.seed)).toBe(
      JSON.stringify(variants[1]!.seed),
    );
    expect(Object.isFrozen(variants[0]!.seed)).toBe(true);
    expect(Object.isFrozen(variants[0]!.seed[0])).toBe(true);
    input.seed[0]!.degree = 11;
    expect(variants[0]!.seed[0]!.degree).toBe(0);
    expect(degreeToHz(variants[0]!.tuning, 432, 4)).not.toBe(
      degreeToHz(variants[1]!.tuning, 432, 4),
    );
  });

  test("reference variants change only referenceHz", () => {
    const plan = fixture();
    plan.normalize = false;
    plan.variable = { kind: "referenceHz", variants: [440, 444] };
    const variants = expandRenderPlan(plan);
    expect(variants.map((variant) => variant.referenceHz)).toEqual([
      432, 440, 444,
    ]);
    for (const variant of variants) {
      expect(variant.seed).toBe(variants[0]!.seed);
      expect(variant.normalize).toBe(false);
      expect(variant.tempoBpm).toBe(plan.tempoBpm);
      expect(variant.durationSecs).toBe(plan.durationSecs);
    }
  });

  test("rejects degree-count mismatches even if the seed only uses unison", () => {
    const plan = fixture();
    plan.seed = [plan.seed[0]!];
    plan.variable = { kind: "temperament", variants: [edo19] };
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });

  test("checks frequency bounds in every variant, including temperament changes", () => {
    const plan = fixture();
    plan.seed = [
      { degree: 0, octave: 5, startBeat: 0, beats: 1, velocity: 72 },
    ];
    expect(renderPlanZ.safeParse(plan).success).toBe(true);
    plan.variable = { kind: "referenceHz", variants: [1000] };
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
    plan.referenceHz = 440;
    plan.seed[0]!.degree = 6;
    plan.variable = {
      kind: "temperament",
      variants: [
        {
          kind: "cents",
          values: Array.from({ length: 11 }, (_, i) => 1100 + i),
        },
      ],
    };
    expect(
      renderPlanZ.safeParse({ ...plan, variable: undefined }).success,
    ).toBe(true);
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });

  test.each([
    { kind: "ji", ratios: ["1/1", "3/1"] },
    { kind: "ji", ratios: ["1/2", "2/1"] },
    { kind: "ji", ratios: ["3/0"] },
    { kind: "named", name: "unknown" },
    { kind: "cents", values: [1300] },
    { kind: "edo", divisions: 0 },
    { kind: "edo", divisions: 12, period: 3 },
  ])(
    "rejects unsupported render tuning without throwing from safeParse: %j",
    (tuning) => {
      expect(renderPlanZ.safeParse({ ...fixture(), tuning }).success).toBe(
        false,
      );
    },
  );

  test.each([
    { version: 2 },
    { engine: "other" },
    { referenceHz: 19 },
    { referenceHz: 2001 },
    { tempoBpm: 0 },
    { durationSecs: Infinity },
    { durationSecs: 0 },
    { normalize: "yes" },
    { seed: [] },
    { variable: { kind: "dynamics", variants: [1] } },
    { variable: { kind: "referenceHz", variants: [] } },
    { variable: { kind: "referenceHz", variants: [432, 440, 444, 448] } },
    { variable: { kind: "referenceHz", variants: [2001] } },
  ])("rejects invalid plan fields: %j", (fields) => {
    expect(renderPlanZ.safeParse({ ...fixture(), ...fields }).success).toBe(
      false,
    );
  });

  test.each([
    { degree: 12 },
    { degree: -1 },
    { octave: 0.5 },
    { velocity: 0 },
    { velocity: 128 },
    { beats: 0 },
    { beats: Infinity },
    { startBeat: -1 },
  ])("rejects invalid event fields: %j", (fields) => {
    const plan = fixture();
    plan.seed = [{ ...plan.seed[0]!, ...fields }];
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });

  test("allows overlapping events but rejects descending or overflowing timing", () => {
    const plan = fixture();
    plan.seed[1]!.startBeat = 0;
    expect(renderPlanZ.safeParse(plan).success).toBe(true);
    plan.seed[0]!.startBeat = 1;
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
    plan.seed = [
      {
        ...plan.seed[0]!,
        startBeat: Number.MAX_VALUE,
        beats: Number.MAX_VALUE,
      },
    ];
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });
});

describe("render admission work bounds", () => {
  test.each([
    { tempoBpm: Number.MAX_VALUE, beats: Number.MIN_VALUE, durationSecs: 30 },
    { tempoBpm: 120, beats: 1e-12, durationSecs: 30 },
    { tempoBpm: 120, beats: 1, durationSecs: 1e100 },
  ])(
    "rejects the reviewed unbounded repeat probe: %j",
    ({ beats, ...fields }) => {
      const plan = fixture();
      expect(
        renderPlanZ.safeParse({
          ...plan,
          ...fields,
          seed: [{ ...plan.seed[0]!, beats }],
        }).success,
      ).toBe(false);
    },
  );

  test("accepts exactly 8192 conservative scheduled events and rejects the next", () => {
    const plan = fixture();
    plan.seed = [{ ...plan.seed[0]!, startBeat: 0, beats: 1 / 64 }];
    plan.durationSecs = 64; // 8192 cycles at 120 BPM
    expect(renderPlanZ.safeParse(plan).success).toBe(true);
    plan.durationSecs += 1 / 128;
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
    plan.durationSecs = 32;
    plan.seed.push({ ...plan.seed[0]! }); // simultaneous notes count too
    expect(renderPlanZ.safeParse(plan).success).toBe(true);
    plan.seed.push({ ...plan.seed[0]! });
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });

  test.each([20, 400])(
    "admits 16 bars of generated eighth notes at %i BPM",
    (tempoBpm) => {
      const result = generateSeedEvents(
        [
          { type: "tempo", value: `${tempoBpm} BPM` },
          { type: "form", value: "16 bars" },
          { type: "rhythm", value: "eighth notes" },
        ],
        geometric,
      );
      expect(
        renderPlanZ.safeParse({
          ...fixture(),
          seed: result.events,
          tempoBpm,
          durationSecs: 90,
        }).success,
      ).toBe(true);
    },
  );

  test.each([
    { durationSecs: 0.099 },
    { durationSecs: 90.001 },
    { tempoBpm: 19.999 },
    { tempoBpm: 400.001 },
  ])("rejects values outside documented bounds: %j", (fields) => {
    expect(renderPlanZ.safeParse({ ...fixture(), ...fields }).success).toBe(
      false,
    );
  });

  test("admits the maximum seed and rejects an event extending beyond 64 beats", () => {
    const plan = fixture();
    plan.seed = Array.from({ length: RENDER_LIMITS.maxSeedEvents }, () => ({
      ...plan.seed[0]!,
      startBeat: 0,
      beats: 64,
    }));
    expect(renderPlanZ.safeParse(plan).success).toBe(true);
    plan.seed[0]!.startBeat = 1 / 64;
    expect(renderPlanZ.safeParse(plan).success).toBe(false);
  });

  test.each(["seed", "cents", "ji", "variants"])(
    "rejects oversized %s collections before visiting elements",
    (kind) => {
      const entries = Array(
        kind === "seed" ? 1025 : kind === "variants" ? 4 : 257,
      );
      Object.defineProperty(entries, 0, {
        get() {
          throw new Error("element visited");
        },
      });
      const plan = fixture();
      const input =
        kind === "seed"
          ? { ...plan, seed: entries }
          : kind === "variants"
            ? { ...plan, variable: { kind: "temperament", variants: entries } }
            : {
                ...plan,
                tuning:
                  kind === "cents"
                    ? { kind, values: entries }
                    : { kind, ratios: entries },
              };
      expect(renderPlanZ.safeParse(input).success).toBe(false);
    },
  );

  test("bounds raw and normalized degrees plus strings without limiting legacy normalization", () => {
    expect(
      renderTuningZ.safeParse({ kind: "edo", divisions: 256 }).success,
    ).toBe(true);
    expect(
      renderTuningZ.safeParse({ kind: "edo", divisions: 257 }).success,
    ).toBe(false);
    expect(
      renderTuningZ.safeParse({ kind: "cents", values: Array(255).fill(100) })
        .success,
    ).toBe(true);
    expect(
      renderTuningZ.safeParse({ kind: "cents", values: Array(256).fill(100) })
        .success,
    ).toBe(false);
    expect(
      renderTuningZ.safeParse({ kind: "ji", ratios: ["1/" + "1".repeat(63)] })
        .success,
    ).toBe(false);
    expect(
      renderTuningZ.safeParse({ kind: "named", name: "x".repeat(65) }).success,
    ).toBe(false);
    expect(
      tuningIntervalsInCents({ kind: "edo", divisions: 4096 }),
    ).toHaveLength(4096);
    expect(
      tuningIntervalsInCents({ kind: "cents", values: Array(300).fill(100) }),
    ).toHaveLength(301);
  });

  test("sorts each temperament once, independent of seed count", () => {
    const plan = fixture();
    const tuning: TuningSpec = {
      kind: "cents",
      values: Array.from({ length: 255 }, (_, i) => 1190 - i),
    };
    plan.tuning = tuning;
    plan.variable = { kind: "temperament", variants: [tuning, tuning, tuning] };
    plan.seed = Array.from({ length: 1024 }, (_, i) => ({
      degree: i % 256,
      octave: 0,
      startBeat: 0,
      beats: 64,
      velocity: 72,
    }));
    const sort = vi.spyOn(Array.prototype, "toSorted");
    try {
      expect(renderPlanZ.safeParse(plan).success).toBe(true);
      expect(sort).toHaveBeenCalledTimes(4);
      sort.mockClear();
      plan.variable = { kind: "referenceHz", variants: [440, 444, 448] };
      expect(renderPlanZ.safeParse(plan).success).toBe(true);
      expect(sort).toHaveBeenCalledTimes(1);
    } finally {
      sort.mockRestore();
    }
  });
});

test("prepared pitch mapping normalizes once and detaches from mutable input", () => {
  const tuning: TuningSpec = { kind: "cents", values: [700, 400] };
  const sort = vi.spyOn(Array.prototype, "toSorted");
  try {
    const pitch = prepareDegreeToHz(tuning, 432);
    tuning.values[1] = 200;
    for (let i = 0; i < 1024; i += 1) {
      expect(pitch(1)).toBeCloseTo(432 * 2 ** (400 / 1200));
    }
    expect(sort).toHaveBeenCalledTimes(1);
  } finally {
    sort.mockRestore();
  }
});

describe("render plan snapshots", () => {
  test("admission returns the storable plan, unchanged in shape", () => {
    const plan = {
      ...fixture(),
      variable: {
        kind: "temperament" as const,
        variants: [geometric, geometric],
      },
    };
    const admitted = admitRenderPlan(plan);
    expect(admitted).toEqual(plan);
    expect(renderPlanSnapshotZ.parse(admitted)).toEqual(admitted);
    expect(renderPlanMemberCount(admitted)).toBe(3);
    expect(renderPlanMemberCount(admitRenderPlan(fixture()))).toBe(1);
    // A stored snapshot re-admits identically, so a job always renders it.
    expect(admitRenderPlan(admitted)).toEqual(admitted);
  });

  test("admission applies the semantic contract, not just the shape", () => {
    const shapeOnly = { ...fixture(), durationSecs: 600 };
    expect(renderPlanSnapshotZ.safeParse(shapeOnly).success).toBe(true);
    expect(() => admitRenderPlan(shapeOnly)).toThrow();
    expect(() => admitRenderPlan({ ...fixture(), period: 3 })).toThrow();
  });
});
