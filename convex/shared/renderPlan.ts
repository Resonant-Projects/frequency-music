import { z } from "zod";
import {
  degreeCentsToHz,
  octaveDegreeCents,
  MAX_RENDER_DEGREES,
  MAX_RENDER_TUNING_STRING_LENGTH,
  type SeedEvent,
} from "./tuning";

/** Bounded litmus studies: up to 90 seconds, including short smoke renders.
 * 20..400 BPM matches the seed generator. 64 beats covers its 16-bar maximum;
 * 1/64 beat supports subdivisions while preventing near-zero loop periods.
 * 1024 seed notes allows eight voices over 128 generated eighth-note onsets.
 * Each member admits at most 8192 scheduled notes, conservatively counting
 * every note of the last partial cycle. At most four members means 32768 notes.
 * Octaves are integers in -10..10, further restricted by the 20..20000 Hz
 * pitch check; no audible mapping with a 20..2000 Hz reference is lost.
 * These restrictions apply only to render admission, never legacy kit parsing. */
export const RENDER_LIMITS = Object.freeze({
  minDurationSecs: 0.1,
  maxDurationSecs: 90,
  minTempoBpm: 20,
  maxTempoBpm: 400,
  minEventBeats: 1 / 64,
  maxSeedBeats: 64,
  maxSeedEvents: 1024,
  maxExpandedEvents: 8192,
});

// Check collection sizes before Zod visits their elements or tuning sorts them.
function boundedArray<T extends z.ZodType>(element: T, max: number) {
  return z
    .unknown()
    .superRefine((input, ctx) => {
      if (Array.isArray(input) && input.length > max) {
        ctx.addIssue({
          code: "custom",
          message: `Array admits at most ${max} entries.`,
        });
      }
    })
    .pipe(z.array(element).max(max));
}

/** This contract adds no general formal period. Version 1 is explicitly
 * octave-only; strict objects reject a supplied period instead of dropping it.
 * These render restrictions do not change the legacy script tuning parser. */
const preparedTuningZ = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("edo"),
      divisions: z.number().int().min(1).max(MAX_RENDER_DEGREES),
    }),
    z.strictObject({
      kind: z.literal("ji"),
      ratios: boundedArray(
        z.string().max(MAX_RENDER_TUNING_STRING_LENGTH),
        MAX_RENDER_DEGREES,
      ),
    }),
    z.strictObject({
      kind: z.literal("cents"),
      values: boundedArray(z.number(), MAX_RENDER_DEGREES),
    }),
    z.strictObject({
      kind: z.literal("named"),
      name: z.string().max(MAX_RENDER_TUNING_STRING_LENGTH),
    }),
  ])
  .transform((tuning, ctx) => {
    try {
      return { tuning, cents: octaveDegreeCents(tuning) };
    } catch (error) {
      ctx.addIssue({ code: "custom", message: String(error) });
      return z.NEVER;
    }
  });

export const renderTuningZ = preparedTuningZ.transform(({ tuning }) => tuning);

export const seedEventZ = z.strictObject({
  degree: z
    .number()
    .int()
    .min(0)
    .max(MAX_RENDER_DEGREES - 1),
  octave: z.number().int().min(-10).max(10),
  startBeat: z.number().min(0).max(RENDER_LIMITS.maxSeedBeats),
  beats: z
    .number()
    .min(RENDER_LIMITS.minEventBeats)
    .max(RENDER_LIMITS.maxSeedBeats),
  velocity: z.number().int().min(1).max(127),
});

const referenceHzZ = z.number().min(20).max(2000);

export const renderPlanZ = z
  .strictObject({
    version: z.literal(1),
    engine: z.literal("sc-litmus"),
    tuning: preparedTuningZ,
    referenceHz: referenceHzZ,
    normalize: z.boolean(),
    variable: z
      .discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("temperament"),
          variants: boundedArray(preparedTuningZ, 3).refine(
            (items) => items.length > 0,
          ),
        }),
        z.strictObject({
          kind: z.literal("referenceHz"),
          variants: boundedArray(referenceHzZ, 3).refine(
            (items) => items.length > 0,
          ),
        }),
      ])
      .optional(),
    seed: boundedArray(seedEventZ, RENDER_LIMITS.maxSeedEvents).refine(
      (items) => items.length > 0,
    ),
    tempoBpm: z
      .number()
      .min(RENDER_LIMITS.minTempoBpm)
      .max(RENDER_LIMITS.maxTempoBpm),
    durationSecs: z
      .number()
      .min(RENDER_LIMITS.minDurationSecs)
      .max(RENDER_LIMITS.maxDurationSecs),
  })
  .superRefine((plan, ctx) => {
    // Zod can continue refinements after a nested validation issue.
    // Never inspect partial/untransformed collections in that case.
    if (ctx.issues.length > 0) return;
    const degreeCount = plan.tuning.cents.length;
    const mappings = [degreeCentsToHz(plan.tuning.cents, plan.referenceHz)];
    if (plan.variable?.kind === "temperament") {
      for (const [index, tuning] of plan.variable.variants.entries()) {
        if (tuning.cents.length !== degreeCount) {
          ctx.addIssue({
            code: "custom",
            path: ["variable", "variants", index],
            message:
              "Temperament variants must have the baseline degree count.",
          });
        }
        mappings.push(degreeCentsToHz(tuning.cents, plan.referenceHz));
      }
    } else if (plan.variable?.kind === "referenceHz") {
      mappings.push(
        ...plan.variable.variants.map((referenceHz) =>
          degreeCentsToHz(plan.tuning.cents, referenceHz),
        ),
      );
    }
    let cycleSecs = 0;
    for (const [index, event] of plan.seed.entries()) {
      const endBeat = event.startBeat + event.beats;
      const startSecs = (event.startBeat * 60) / plan.tempoBpm;
      const endSecs = (endBeat * 60) / plan.tempoBpm;
      const eventSecs = (event.beats * 60) / plan.tempoBpm;
      cycleSecs = Math.max(cycleSecs, endSecs);
      if (
        endBeat > RENDER_LIMITS.maxSeedBeats ||
        !Number.isFinite(endSecs) ||
        !(eventSecs > 0) ||
        !(endSecs > startSecs)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["seed", index],
          message:
            "Event timing must be positive, representable, and within 64 beats.",
        });
      }
      if (index > 0 && event.startBeat < plan.seed[index - 1]!.startBeat) {
        ctx.addIssue({
          code: "custom",
          path: ["seed", index, "startBeat"],
          message: "Seed events must be ordered by startBeat.",
        });
      }
      for (const mapping of mappings) {
        try {
          mapping(event.degree, event.octave);
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            path: ["seed", index],
            message: String(error),
          });
        }
      }
    }
    const expandedCount =
      Math.ceil(plan.durationSecs / cycleSecs) * plan.seed.length;
    if (
      !(cycleSecs > 0) ||
      !Number.isFinite(cycleSecs) ||
      !Number.isSafeInteger(expandedCount) ||
      expandedCount > RENDER_LIMITS.maxExpandedEvents
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["seed"],
        message:
          "Seed cycle must be positive and expand to at most 8192 events per member.",
      });
    }
  })
  .transform(({ tuning, variable, ...plan }) => ({
    ...plan,
    tuning: tuning.tuning,
    ...(variable
      ? {
          variable:
            variable.kind === "temperament"
              ? {
                  kind: "temperament" as const,
                  variants: variable.variants.map((variant) => variant.tuning),
                }
              : variable,
        }
      : {}),
  }));

export type RenderPlan = z.infer<typeof renderPlanZ>;
export type RenderPlanVariant = Readonly<
  Omit<RenderPlan, "seed" | "variable">
> & {
  readonly seed: readonly Readonly<SeedEvent>[];
};

/** Baseline first, then declared variants. Parse a detached snapshot and freeze
 * one event list shared by all members. Renderers loop/truncate that list to
 * durationSecs; they must never regenerate it for a variant or derive Hz from
 * seed MIDI. This is structural/pitch validation, not the human evidence gate. */
export function expandRenderPlan(input: unknown): readonly RenderPlanVariant[] {
  const { variable, seed: inputSeed, ...baseline } = renderPlanZ.parse(input);
  const seed = Object.freeze(inputSeed.map((event) => Object.freeze(event)));
  const variants: RenderPlanVariant[] = [{ ...baseline, seed }];
  if (variable?.kind === "temperament") {
    variants.push(
      ...variable.variants.map((tuning) => ({ ...baseline, tuning, seed })),
    );
  } else if (variable?.kind === "referenceHz") {
    variants.push(
      ...variable.variants.map((referenceHz) => ({
        ...baseline,
        referenceHz,
        seed,
      })),
    );
  }
  return Object.freeze(variants.map((variant) => Object.freeze(variant)));
}
