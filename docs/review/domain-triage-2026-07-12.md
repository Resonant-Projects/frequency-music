# Vocabulary Registry Triage — 2026-07-12

Decision-support review of the provisional vocabulary produced by the LLM concept classifier
(`vpx convex run vocabulary:reviewSummary '{}'`, snapshot 2026-07-12):

- **49 provisional concept domains**
- **19 provisional parameter kinds**
- **126 provisional relationship kinds**

Most of the inflation comes from arXiv ingestion — the classifier proposes ML/speech/engineering
domains that are off-mission, plus many near-synonyms of domains we already registered.

**Recommendation totals**

| List | Promote | Merge | Reject | Total |
|---|---|---|---|---|
| Concept domains | 2 | 34 | 13 | 49 |
| Parameter kinds | 5 | 5 | 9 | 19 |
| Relationship kinds | 9 | 71 | 46 | 126 |

---

## How to apply

All mutations require the auth bypass secret (varlock resolves it inside scripts; raw
`vpx convex run` calls need the literal value — never commit it).

```bash
export OP_SERVICE_ACCOUNT_TOKEN=$(cat ~/.config/op/agentic-workers.token)
```

**Step 1 — Promote approved domains.** Add each PROMOTE entry below to `DOMAIN_ENTRIES` in
`scripts/seed-concept-domains.ts` (name + one-line description), then:

```bash
vpx tsx scripts/seed-concept-domains.ts          # dry run — reports created/updated/unchanged
vpx tsx scripts/seed-concept-domains.ts --apply  # writes status="known"
```

`vocabulary:seedMissionConceptDomains` patches an existing provisional row of the same name up
to `known`, so promotion doubles as cleanup for those rows — no separate delete needed.
(Direct alternative for a one-off promote:
`vpx convex run vocabulary:seedMissionConceptDomains '{"entries": [{"name": "bioacoustics", "description": "..."}], "apply": true, "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'`.)

**Step 2 — Collapse exact-slug provisional duplicates.**

```bash
vpx convex run vocabulary:cleanupProvisionalConceptDomainDuplicates '{"apply": false, "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'  # dry run
vpx convex run vocabulary:cleanupProvisionalConceptDomainDuplicates '{"apply": true,  "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
```

Caveat: `normalizeConceptDomainSlug` (convex/conceptDomainNormalization.ts) folds whitespace and
repeated dashes but **not underscores**, so `audio_ml` is a distinct slug from `audio-ml` and this
mutation will not collapse it. The 49 current names are all distinct slugs, so today this step is
mostly a safety no-op — it matters after promotions create known/provisional slug collisions.

**Step 3 — Reclassify concepts against the updated registry.** The classifier only assigns
`known`/`experimental` domains; everything else lands `unreviewed`. After promoting, re-run:

```bash
vpx tsx scripts/classify-concepts.ts                  # dry run (30 concepts)
vpx tsx scripts/classify-concepts.ts --apply --force  # full backfill, reassigns everything
```

**Step 4 — Retire merged/rejected rows (gap).** There is currently **no mutation** to delete or
deprecate a provisional row whose slug does not collide with an established row (the
`registryStatusValidator` supports `deprecated`, but nothing sets it). Merged/rejected rows are
inert — the classifier never assigns them — but they will keep reappearing in `reviewSummary`.
Suggested small follow-up: a `vocabulary:retireProvisional` mutation that takes a name list and
either deletes rows or patches `status: "deprecated"`.

**Code fix worth doing alongside (parameter kinds):** `KNOWN_PARAMETER_KINDS` in
`convex/vocabulary.ts` contains camelCase names (`tuningSystem`, `harmonicProfile`, `rootNote`,
`chordProgression`, `synthWaveform`) but `ensureParameterKind` lowercases input before checking the
set, so those five can **never** match and always re-enter as provisional — that is exactly why
`tuningsystem` and `harmonicprofile` appear in the provisional list. One-line fix: store the set
lowercased (or compare case-insensitively).

---

## Registry reference (merge targets)

**Legacy known set** (`KNOWN_CONCEPT_DOMAINS`, convex/vocabulary.ts): `tuning`, `acoustics`,
`psychoacoustics`, `theory`, `production`, `mathematics`, `geometry`, `instrument`, `general`.

**Mission seed set** (`scripts/seed-concept-domains.ts`, 14 entries): `microtuning`,
`geometric-music-theory`, `psychoacoustics`, `wave-physics`, `mathematical-music-theory`,
`sacred-geometry`, `consciousness-sound`, `biofield`, `sound-healing`, `cymatics`, `earth-energy`,
`music-production`, plus two off-mission capture buckets: `ml-audio-engineering` and
`general-science`.

Merges below target whichever registered domain is the tightest fit; audio-ML material goes to the
purpose-built `ml-audio-engineering` capture bucket rather than being rejected outright, so the
concepts stay queryable.

---

## Concept domains (49)

### Promote (2)

| Domain | Rationale |
|---|---|
| `bioacoustics` | Sound in living systems — distinct from biofield (EM/biophotons) and mission-adjacent to sound-healing/resonance research. |
| `algorithmic-composition` | The pipeline literally generates compositions from recipes; generative/procedural composition research deserves its own shelf. |

### Merge (34)

**→ `psychoacoustics` (9)** — the perception/cognition cluster; all are the science of how humans hear.

| Domain | Rationale |
|---|---|
| `perception` | Bare synonym for the perceptual domain we already register. |
| `audio-perception` | Same field, classifier-invented compound name. |
| `music-perception` | Same field scoped to music — still psychoacoustics. |
| `audio-cognition` | Cognitive processing of sound = psychoacoustics' cognitive half. |
| `music-cognition` | Real subfield, but not distinct enough to warrant a split here. |
| `cognition` | Too broad alone; every captured use is auditory cognition. |
| `temporal-cognition` | Time perception in audition — psychoacoustics topic. |
| `listening` | Generic label for auditory perception. |
| `auditory-scene-analysis` | Bregman ASA is a core psychoacoustics research program. |

**→ `theory` (4)** — music-theoretic structure.

| Domain | Rationale |
|---|---|
| `music-theory` | Literal synonym of the registered `theory` domain. |
| `harmony` | Subtopic of music theory, not a peer domain. |
| `rhythm` | Subtopic of music theory (and already a parameter kind). |
| `music-analysis` | Analytic practice within music theory. |

**→ `music-production` (6)** — composition, performance, and studio practice.

| Domain | Rationale |
|---|---|
| `composition` | Named in music-production's own description. |
| `performance` | Performance practice sits with production/practice, not theory. |
| `performance-practice` | Duplicate of `performance` with a longer name. |
| `acousmatics` | Electroacoustic/acousmatic composition and listening practice. |
| `audio-engineering` | Recording/mixing engineering = studio practice. |
| `music-technology` | Instruments-and-tools umbrella; production is the working home. |

**→ `ml-audio-engineering` (10)** — the off-mission capture bucket built for exactly this arXiv material.

| Domain | Rationale |
|---|---|
| `signal-processing` | DSP-for-audio engineering literature. |
| `audio-signal-processing` | Same domain, longer name. |
| `ai-music` | ML music generation papers — capture, don't canonize. |
| `machine-listening` | ML audio classification/tagging field. |
| `listening-systems` | Classifier variant of machine listening. |
| `audio-machine-learning` | Same cluster, third spelling. |
| `audio_ml` | Same cluster, fourth spelling (underscore evades slug dedupe — retire manually). |
| `audio-analysis` | MIR/feature-extraction engineering. |
| `audio-systems` | Software audio-system engineering. |
| `real-time-audio` | Real-time audio software engineering. |

**→ `wave-physics` (2)**

| Domain | Rationale |
|---|---|
| `physics-of-sound` | Literal restatement of wave-physics. |
| `physics` | Every captured use is acoustic/wave physics; fold into the mission domain. |

**→ `acoustics` (2)**

| Domain | Rationale |
|---|---|
| `spatial-audio` | Sound-in-space/localization; acoustics with a psychoacoustic edge. |
| `room-acoustics` | Subset by name; also the home for cathedral-acoustics material. |

**→ `mathematics` (1)**

| Domain | Rationale |
|---|---|
| `information-theory` | Math applied to music/signals; registered math domain covers it. |

### Reject (13) — off-mission arXiv noise or unusably vague

| Domain | Rationale |
|---|---|
| `analysis` | Vague to the point of meaningless as a domain. |
| `audio` | The whole corpus is audio; zero discriminative value. |
| `methodology` | Research-methods label, not a subject domain. |
| `systems` | Generic CS-engineering label. |
| `representation` | ML representation-learning jargon. |
| `machine-learning` | Bare ML with no audio tie; below even the capture bucket. |
| `real-time-systems` | Pure systems engineering, no audio content. |
| `audio-datasets` | ML infrastructure (datasets), not a knowledge domain. |
| `audio-evaluation` | ML benchmarking infrastructure. |
| `speech` | Speech-technology literature, off-mission. |
| `speech-acoustics` | Speech-tech again with an acoustics veneer. |
| `prosody` | Speech prosody research (borderline — revisit if toning/chanting work needs it). |
| `voice` | Speech/voice-tech label; sound-healing toning is already covered there. |

### Duplicate clusters observed

- **audio-ML spellings:** `audio_ml` / `audio-machine-learning` / `machine-listening` /
  `listening-systems` / `audio-signal-processing` (+ bare `machine-learning`) — six names, one field.
  Note `audio_ml`'s underscore means the cleanup mutation will not catch it.
- **cognition:** `music-cognition` / `audio-cognition` / `cognition` / `temporal-cognition`.
- **perception:** `audio-perception` / `music-perception` / `perception` / `listening`.
- **theory:** `music-theory` vs registered `theory`; `physics-of-sound` vs `wave-physics`;
  `performance` vs `performance-practice`.

---

## Parameter kinds (19)

Registered set (`KNOWN_PARAMETER_KINDS`): tempo, key, tuningSystem, rootNote, chordProgression,
rhythm, instrument, synthWaveform, harmonicProfile, frequency, note. Reminder: the camelCase
entries never match due to the lowercasing bug above — fix that before/with this triage.

| Provisional | Recommendation | Rationale |
|---|---|---|
| `resonance` | PROMOTE | Mission-core recipe parameter (resonant frequency, Q, modes). |
| `dynamics` | PROMOTE | Loudness/dynamics is a legitimate composition parameter. |
| `duration` | PROMOTE | Note/section/piece duration; concrete and machine-usable. |
| `interval` | PROMOTE | Central to tuning/microtuning work; distinct from `note`. |
| `trackcount` | PROMOTE | Concrete arrangement parameter for generated compositions (register as `trackCount` once casing is fixed). |
| `harmonicprofile` | MERGE → `harmonicProfile` | Casing-bug shadow of the registered kind. |
| `tuningsystem` | MERGE → `tuningSystem` | Casing-bug shadow of the registered kind. |
| `timbre` | MERGE → `harmonicProfile` | Same concept as the registered spectral-content kind. |
| `scalesystem` | MERGE → `tuningSystem` | Scale system and tuning system are one registry entry. |
| `timbralsource` | MERGE → `instrument` | "Source of the timbre" is the instrument/synth kind. |
| `measurement` | REJECT | Meta-category, not a parameter. |
| `space` | REJECT | Too vague (spatialization would need a concrete name). |
| `perception` | REJECT | A research topic, not a settable parameter. |
| `language` | REJECT | Speech-corpus leakage. |
| `time` | REJECT | Ambiguous between tempo/duration, both already covered. |
| `layering` | REJECT | Vague arrangement notion; `trackCount` covers the usable part. |
| `structuralpattern` | REJECT | Too abstract to parameterize a recipe. |
| `pitchaccent` | REJECT | Speech-prosody leakage. |
| `pronunciation` | REJECT | Speech-tech leakage. |

**Counts: 5 promote / 5 merge / 9 reject.**

---

## Relationship kinds (126)

Registered set (`KNOWN_RELATIONSHIP_KINDS`): cites, related_to, contradicts, supports, mentions,
defines, tests, applies, is_a, part_of, derived_from, extracted_from, generated_from, implements.

Principles used: promote only relations that add real graph expressiveness (causal, dependency,
measurement, abstraction); merge inverse forms and spelling variants into one canonical direction;
reject one-off LLM inventions and metaphors. Convention: snake_case, active voice — inverse forms
(`measured_by`, `constrained_by`, `implemented_by`) merge into the forward relation.

### Promote (9)

| Kind | Rationale |
|---|---|
| `causes` | Causal edges are the highest-value relation for hypothesis generation. |
| `enables` | Weaker-than-causal facilitation; common and meaningful. |
| `requires` | Dependency relation; canonical target for all `depends_*` variants. |
| `constrains` | Limits/bounds relation; canonical target for the governs/bounded cluster. |
| `measures` | Links methods/metrics to phenomena; canonical for `measured_by`/`tracked_by`. |
| `models` | Theory-models-phenomenon; canonical for `formalizes`/`formalized_by`. |
| `generalizes` | Abstraction hierarchy; canonical for `specializes`/`abstracts`. |
| `extends` | Work-builds-on-work; canonical for `refines`/`extends_to`. |
| `produces` | Process-produces-output; canonical for `generates`. |

### Merge (71)

| Provisional | Merge into |
|---|---|
| `relates_to` | `related_to` |
| `related to` | `related_to` |
| `connects_to` | `related_to` |
| `connects` | `related_to` |
| `complements` | `related_to` |
| `informs` | `related_to` |
| `analogous_to` | `related_to` |
| `analogizes` | `related_to` |
| `analogized_by` | `related_to` |
| `parallels` | `related_to` |
| `parallel_to` | `related_to` |
| `maps onto` | `related_to` |
| `instance_of` | `is_a` |
| `example_of` | `is_a` |
| `exemplifies` | `is_a` |
| `instantiates` | `is_a` |
| `instantiated_by` | `is_a` |
| `is a form of` | `is_a` |
| `contains` | `part_of` |
| `includes` | `part_of` |
| `operates_within` | `part_of` |
| `derives_from` | `derived_from` |
| `emerges_from` | `derived_from` |
| `inspired by` | `derived_from` |
| `inspired_by` | `derived_from` |
| `informed_by` | `derived_from` |
| `supported_by` | `supports` |
| `evidence_for` | `supports` |
| `reinforces` | `supports` |
| `contributes_to` | `supports` |
| `grounds` | `supports` |
| `implies` | `supports` |
| `explains` | `supports` |
| `satisfies` | `supports` |
| `contrasts_with` | `contradicts` |
| `contrasts with` | `contradicts` |
| `implemented_by` | `implements` |
| `implemented_as` | `implements` |
| `operationalizes` | `implements` |
| `operationalized_by` | `implements` |
| `applies_to` | `applies` |
| `uses` | `applies` |
| `tested_by` | `tests` |
| `names` | `defines` |
| `clarifies` | `defines` |
| `specifies` | `defines` |
| `depends on` | `requires` |
| `depends_on` | `requires` |
| `depends-on` | `requires` |
| `constrained_by` | `constrains` |
| `bounded_by` | `constrains` |
| `governs` | `constrains` |
| `conditions` | `constrains` |
| `conditioned_by` | `constrains` |
| `shaped_by` | `constrains` |
| `structures` | `constrains` |
| `structured_by` | `constrains` |
| `parameterizes` | `constrains` |
| `measured_by` | `measures` |
| `tracked_by` | `measures` |
| `formalizes` | `models` |
| `formalized_by` | `models` |
| `specializes` | `generalizes` (inverse) |
| `abstracts` | `generalizes` |
| `generalizes_to` | `generalizes` |
| `generalizes_from` | `generalizes` |
| `refines` | `extends` |
| `extends_to` | `extends` |
| `extends_through` | `extends` |
| `generates` | `produces` |
| `drives` | `causes` |

### Reject (46)

Vague/metaphorical (relation adds no graph value): `separates`, `interacts with`,
`contextualizes`, `bridges`, `reveals`, `preserves`, `anchors`, `performs`, `qualifies`,
`stabilizes`, `organizes`, `filters`, `guides`, `signals`, `frames`, `inhabits`, `translates`,
`motivates`, `modulates`, `synthesizes`, `reframes`, `balances`, `decides`, `composes with`, `complicates`,
`complicated_by`, `expressed_as`, `is_located_by`, `weighted_by`, `allocates`, `allocates_to`.

Modal/non-relational: `can be`, `can_be`, `can-miss`.

Off-mission or infrastructure leakage: `diagnoses`, `warns_about`, `trades_off_with` (revisit if
trade-off edges prove useful), `varies_inside`, `varies_into`, `has-property`.

One-off LLM artifacts (full phrases, never reusable): `contrasts with premature collapse`,
`contrasts_distance_function`, `preserves_identity_layer`, `compositionally_expresses`,
`defines-practice`, `uses-strategy`.

**Counts: 9 promote / 71 merge / 46 reject.**

---

## Notes on applying relationship/parameter decisions

`ensureRelationshipKind` and `ensureParameterKind` are internal mutations invoked by the extraction
pipeline — there is no public seed mutation for these lists yet (the `seedMissionConceptDomains`
pattern only covers concept domains). Two options: extend `KNOWN_RELATIONSHIP_KINDS` /
`KNOWN_PARAMETER_KINDS` in `convex/vocabulary.ts` with the promoted names and redeploy
(`vpx convex deploy -y` — codegen alone does not ship functions), then retire the provisional rows
once a retire mutation exists; or add a `seedMissionVocabulary`-style mutation mirroring the
concept-domain one. Either way, edge rewriting (repointing existing graph edges from merged kinds
to their canonical target) needs a small migration script — nothing in the repo does this today.
