# `recipe_export_v1` design spike

## 1. Goal and non-goals

The goal is a small, versioned boundary that lets a Recipe become a
machine-readable bundle without downstream tools scraping `bodyMd`. Version 1
proves that boundary with deterministic Scala (`.scl`) assets for tuning data
that is already precise enough to export.

The Phase C definition of done is:

> a recipe can produce at least one deterministic machine-readable bundle

> an external tool can consume that bundle without scraping prose

The Phase C scope is also explicit:

> `recipe_export_v1` contract

> generated scale files and tuning payloads

> MIDI seed generation

> automation and arrangement hints

> instrument/template mapping

> initial OSC/WebSocket bridge

Version 1 deliberately takes the first two lines only as far as the contract
and generated scale files. The remaining consumers stay out of scope. The
roadmap's first-ten-projects order puts normalization before export:

> 3. define `parameter_value_v1` and canonical normalization rules

> 4. define `experiment_protocol_v1` as a first-class model

> 5. replace free-text `revisionVariable` with structured revision diffs

> 6. define `recipe_export_v1`

> 7. generate exported assets from recipes

The 2026-04-18 decision log gives the reason for that order:

> DAW integration will be fragile if recipes and parameters remain prose-heavy
> or loosely typed.

This spike covers the `recipe_export_v1` contract, parameter normalization
needed by that contract, and generated `.scl` assets. It does not integrate the
contract with Convex, change a schema, publish files, generate MIDI or `.kbm`
files, map instruments/templates, or build OSC/WebSocket or DAW connectors.

### Parameter reality

The orchestrator supplied 10 live Recipe rows fetched from
`recipes:listByStatus`. They contain 61 parameters. Every row uses `type`; none
of the parameters sets `kind`, `canonicalKind`, or `registryStatus`. The table
shows representative values from those rows, including every observed type and
the tuning forms that affect exportability.

| Observed `type` | `kind` / `canonicalKind` | Real `value` example | v1 interpretation |
|---|---|---|---|
| `tempo` | absent / absent | `82 BPM` | `82`, `BPM` |
| `tempo` | absent / absent | `120 BPM` | `120`, `BPM` |
| `form` | absent / absent | `24-32 bar controlled comparison` | raw-only prose |
| `harmonicProfile` | absent / absent | `Sustained triadic texture with fixed voicing` | raw-only prose |
| `harmonicProfile` | absent / absent | `Octatonic scale (half-step/whole-step diminished): 8 tones, 4-fold rotational symmetry, maximally even` | raw-only prose |
| `tuningSystem` | absent / absent | `12-tone equal temperament` | `12`, `EDO` alias |
| `tuningSystem` | absent / absent | `12-Tone Equal Temperament (12-TET)` | `12`, `EDO` alias |
| `tuningSystem` | absent / absent | `72-EDO` | `72`, `EDO` |
| `tuningSystem` | absent / absent | `19-EDO` | `19`, `EDO` |
| `tuningSystem` | absent / absent | `31-EDO` | `31`, `EDO` |
| `tuningSystem` | absent / absent | `Golden ratio algebraic tuning (φ-octave, 8-note scale Sβ5)` | raw-only prose |
| `tuningSystem` | absent / absent | `Just Intonation` | raw-only prose |
| `tuningSystem` | absent / absent | `Quarter-comma meantone` | raw-only prose |
| `tuningSystem` | absent / absent | `Third-comma meantone` | raw-only prose |

Summary:

- 22 of 61 parameters are parseable as a normalized number plus unit: 10 BPM
  and 12 EDO/equal-temperament values. The other 39 are raw-only prose.
- 12 of 28 tuning parameters are directly parseable as EDO; 16 name a tuning
  but do not contain the intervals needed to emit a scale.
- 10 of 10 rows contain at least one parseable tuning parameter. **STOP-2 did
  not trigger.**
- The live rows prove the existing field precedence must fall back to `type`.
  The registry in `convex/vocabulary.ts` currently normalizes names and assigns
  status while storing Extractions, but the sampled Recipes do not carry that
  result.

The conclusion is narrower than “Recipe parameters are normalized.” EDO and
tempo values are usable now, but named temperaments remain prose. Generation-
time normalization is still required before those 16 tuning parameters can
produce trustworthy assets.

## 2. `parameter_value_v1`

The minimal export-facing value is:

```ts
type ParameterValueV1 = {
  canonicalKind: string;
  registryStatus?: "known" | "provisional" | "experimental" | "deprecated";
  value: {
    raw: string;
    number?: number;
    unit?: "Hz" | "BPM" | "cents" | "ratio" | "EDO";
  };
  lossy: boolean;
  details?: unknown;
};
```

The prototype keeps this schema local because the architecture wave has not
created `convex/shared/`. The eventual contract should be zod-first there, per
the Cross-Seam Contract rule in `CONTEXT.md`.

Normalization rules:

1. Choose `canonicalKind`, then `kind`, then `type`; trim the chosen value. Use
   `unknown` only when all three are missing.
2. Preserve `raw` exactly. Parsing operates on a trimmed copy, so normalization
   never removes the original evidence.
3. Recognize case-insensitive numeric `Hz`, `BPM`, and `cent`/`cents` values.
4. Recognize `a:b` and `a/b` ratios with a nonzero denominator; `number` is the
   decimal quotient and `unit` is `ratio`, while `raw` preserves the notation.
5. Recognize integer `N-EDO`. Treat explicit `N-TET` and `N-tone equal
   temperament` forms as aliases for `N-EDO`.
6. A parsed number and unit sets `lossy: false`. Anything else exports as
   `{ raw }` with `lossy: true`; consumers must not infer a control value from
   it.
7. Preserve `registryStatus` when present. The exporter does not promote a
   provisional kind or invent registry authority.
8. Preserve `details` as evidence, but do not generally interpret it in v1.
   The prototype recognizes only an explicit `details.intervals` array for the
   Scala proof.

`lossy` describes machine interpretability, not whether the prose is useful to
a musician. It lets a consumer accept the bundle while refusing unsafe
automation.

## 3. `recipe_export_v1` bundle

The envelope is JSON with this shape:

```ts
type RecipeExportV1 = {
  contract: "recipe_export_v1";
  recipeId: string;
  title: string;
  hypothesisId: string;
  generatedAt?: string;
  parameters: ParameterValueV1[];
  protocol: RecipeProtocol | null;
  dawChecklist: string[];
  assets: Array<{
    type: "scl" | "kbm";
    filename: string;
    sha256: string;
  }>;
};
```

| Field | Why it crosses the boundary |
|---|---|
| `contract` | Selects the immutable v1 decoder; incompatible changes require `recipe_export_v2`. |
| `recipeId` | Gives the bundle a stable source identity independent of its title. |
| `title` | Gives people and tools a readable label. |
| `hypothesisId` | Preserves Recipe-to-Hypothesis lineage. |
| `generatedAt` | Optionally records export-job provenance without contaminating deterministic asset bytes. |
| `parameters` | Carries normalized controls and raw-only fallbacks without prose scraping. |
| `protocol` | Preserves the comparison/litmus design; `null` distinguishes absence from omission. |
| `dawChecklist` | Carries concrete studio steps that are already structured as ordered strings. |
| `assets` | Declares generated files and their integrity hashes; an empty array is valid. |

Determinism is defined over an export made without `generatedAt`: the same
Recipe row produces the same normalized parameter order, filenames, Scala
bytes, SHA-256 hashes, JSON key order, and bundle bytes. The CLI never reads the
wall clock. A caller may explicitly inject `--generated-at`; that changes only
the envelope and is excluded from the determinism comparison. Production must
decide whether this field is optional or supplied from stable job metadata.

Bundle names are `<title-slug>-<recipe-id-suffix>.recipe-export.json`. The ID
suffix keeps repeated Recipe titles from overwriting one another.

## 4. `.scl` emission rules

An `.scl` candidate must have a normalized kind matching `tuning`,
`tuningSystem`, `temperament`, `scale`, or `EDO` (case-insensitive). The
prototype emits only when one of these forms supplies the full scale:

- An integer `N-EDO` value emits `N - 1` equal steps, each
  `step * 1200 / N` cents with five decimal places, followed by `2/1`. The note
  count is `N`.
- `details.intervals` may supply a complete ordered array of finite cent
  numbers and ratio strings. Numbers emit with five decimal places; ratios keep
  `a/b` form. The array length is the note count. This is a spike-only proof of
  the eventual typed interval model, not validation of arbitrary live
  `details`.

Each file follows the repository's Scala structure: filename comment,
description comment, note count, `!` separator, then ascending cents/ratios.
The geometric-temperament structural test reproduces its 12 documented
intervals and confirms line 3 is `12` and the final interval is `2/1`.

A normalized `frequency`/`referenceFrequency`/`concertPitch` value in Hz is
written as an `A=<n>Hz` description comment. A=432 versus A=440 does not change
interval cents: Scala `.scl` describes interval ratios, not MIDI note mapping.
Encoding the reference pitch belongs in a future `.kbm` or tuning payload.

Every exportable tuning parameter produces one asset, so a comparison Recipe
may produce several `.scl` files. Named systems such as Just Intonation,
quarter-comma meantone, third-comma meantone, or the golden-ratio tunings
cannot produce `.scl` files from the sampled rows because no interval set is
present. Recipes with only those values, or with no tuning parameter, receive
`assets: []`; the bundle remains valid.

## 5. Eventual integration

After the architecture wave lands, `parameterValueV1` and `recipeExportV1`
should become zod-first Cross-Seam Contracts under `convex/shared/`. A script
or internal export action can then validate a Recipe, build the bundle, and
write operator-requested output beneath `exports/recipes/`. Published exports
should enter the editorial export workflow only by a separate operator
decision.

Proposed Recipe changes, not commitments for this spike:

- Store a typed normalized value alongside `raw`, rather than reparsing at
  export time.
- Require `canonicalKind` and `registryStatus` after generation-time registry
  resolution; retain the original `kind`/`type` only for migration evidence.
- Replace export-relevant `details: any` with a discriminated tuning payload
  that can express EDO, explicit intervals, period, and reference mapping.
- Validate generated Recipe parameters at the generation boundary so named
  tunings either carry a registry-resolved interval definition or are
  explicitly marked raw-only.

Future MIDI seeds, automation/arrangement hints, instrument/template mapping,
OSC/WebSocket bridges, and DAW connectors consume this envelope. They are not
implemented by this spike.

## 6. Open questions

1. Which alias table and review workflow owns canonical kinds such as
   `tuningSystem`, and when may `provisional` become `known`?
2. What typed shape represents explicit intervals, non-octave periods,
   repeating ratios, and scale-degree labels without relying on
   `details: any`?
3. How are named systems such as quarter-comma meantone, Just Intonation, and
   the sampled golden-ratio tunings resolved to one authoritative interval
   set?
4. When a Recipe compares several tunings, should each asset carry an explicit
   comparison-arm ID rather than inherit source-array order?
5. Is `generatedAt` optional in the production contract, derived from stable
   export-job metadata, or separated into an un-hashed manifest?
6. What `.kbm`/tuning-payload contract maps A=432 or A=440, MIDI reference note,
   root note, and unmapped keys?
7. Where are export bundles stored, retained, authorized, and published, and
   which process garbage-collects superseded exports?
8. What maximum EDO size and interval-count limits should production enforce
   for safety and useful DAW interoperability?
9. Should a ratio's normalized numeric value remain a decimal quotient, or
   should v1 carry numerator and denominator as first-class integers?
10. Which Scala parser or target tools become the compatibility gate beyond
    the prototype's structural assertions?
