# Render Ladder and Listen Page Design (wave 3)

Make recipes audible without a DAW: one validated plain renderer, study
families compared blind, ratings that land in listening sessions, and a
machine analysis that stays on the artifact.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Requires wave 0. Absorbs plan 11 and keeps its gate. Episodes need wave 1.

## 1. Outcome

- A recipe with a typed render plan renders as a litmus study by a media job.
- After the plan 11 gate passes, litmus renders count as evidence, close
  listening debt, and appear on the docket.
- A comparison recipe becomes a blind study family on `/listen`, rated with
  the six subjective scales, and optionally as a podcast episode.
- Every render carries raw machine analysis on its artifact.

## 2. Validation gate first (plan 11, preserved)

Before any render is trusted:

1. **Bounded spike**: render three existing kits with the litmus engine.
2. **Pitch check**: per-note frequency error under 0.5 cents against the
   tuning table. Necessary, not sufficient.
3. **Human versus machine listening**: Keith renders the same kits in the
   studio; both versions are rated blind on `/listen`.
4. **Contamination assessment**: do ratings track the hypothesis or the
   synthesis? Written up in `docs/plans/` as the plan 11 outcome with a
   go/no-go.

Until go, every render artifact has `validation: "unvalidated"` and is
excluded from evidence, debt closure, docket `compositionNoListening`, and
tournament fitness. Go flips a setting `renderValidation = "go"` and later
renders are stamped `validated`.

Step 3 needs the blind panel, so the build order inside this wave is:
renderer, blind projection and panel with the minimal `/listen` page, the
spike, the go/no-go, and only then study families and debt closure. Keith's
studio renders are uploaded as `litmusRender` artifacts with
`engine.name: "human-studio"` so they join a blind group like any other
member.

## 3. The ladder, first release

| Tier | Artifact | Engine | Status |
| --- | --- | --- | --- |
| 0 | `tuning.scl`, `tuning.kbm`, `seed.mid`, `card.md` | existing starter kit | exists |
| 2 | Litmus render | SuperCollider NRT, fixed plain timbre | this wave |
| 3 | Study family | tier 2, baseline plus variants | this wave, after go |
| 5 | Analysis | roughness, loudness, centroid | this wave |

Deferred to a later release (§9): Strudel patterns, quality renders with
physical-modelling instruments, ACE-Step expansion, waveform region tools.

### 3.1 Litmus timbre

One instrument, defined once in `media/src/engines/sc/litmus.scd`: four
partials at exact integer multiples with amplitudes 1, 0.5, 0.25, 0.125,
20 ms attack, 300 ms release, no vibrato, reverb, or widening. Pitch is
given to SuperCollider in Hz per event, computed by the shared tuning lib,
never by MIDI note number and never by parsing `.scl` files. 48 kHz, 24-bit
master, then the umbrella loudness policy for music.

### 3.2 Typed render contract

`whatVaries` is free text and cannot drive a renderer. Recipes gain:

```
renderPlan?: {
  version: 1
  engine: "sc-litmus"
  tuning: TuningSpec                 // baseline, from parameters via the shared lib
  referenceHz: number                // frequency of degree 0 in octave 0
  normalize: boolean                 // false when level or dynamics is the variable
  variable?:
    | { kind: "temperament", variants: TuningSpec[] }   // max 3; each must have the
                                                        // same degree count as the baseline
    | { kind: "referenceHz", variants: number[] }       // max 3; 20 to 2000 Hz
  seed: { degree: number, octave: number, startBeat: number, beats: number, velocity: number }[]
        // degree in [0, degreeCount); octave is the tuning's formal period
        // relative to the reference; every resulting Hz must be in 20 to 20000
  tempoBpm: number
  durationSecs: number               // from protocol.durationSecs
}
```

Pitch: `hz(degree, octave) = referenceHz × period^octave × 2^(cents[degree]/1200)`,
where `period` is the tuning's formal octave ratio (2 for octave-repeating
tunings) and `cents` comes from `tuningIntervalsInCents`. A new
`degreeToHz` in `convex/shared/tuning/` implements this; the KBM writer's
MIDI-69 anchoring is not used by the renderer.

Seed events are generated degree-native by a new `generateSeedEvents` in the
shared lib, before any conversion to MIDI: the existing `generateSeedMidi`
rounds cents to semitones and merges pitch classes (19-EDO degrees 1 and 2
both become one semitone), so degrees cannot be recovered from `seed.mid`.
`seed.mid` for the starter kit is derived from the degree events afterwards
so both stay consistent. The event list is generated once from the baseline
and frozen; variants change only the degree-to-Hz mapping. A temperament
variant with a different degree count is rejected at plan validation. The
renderer loops or truncates the event list to `durationSecs`.

Any recipe whose variable is not `temperament` or `referenceHz` is rejected
by `render.request` with "needs a typed render plan", and the recipe editor
on the web gets a small form to set one. The LLM recipe prompt is unchanged
in this release.

### 3.3 Study families

Job `studyFamily`, input `{ recipeId, recipeUpdatedAt, renderPlan,
rendererVersion }` (a snapshot, per umbrella §3.3, so an edited plan yields a
new job and a stale job can never render a different revision than the one
requested), requires `renderPlan.variable`. Renders baseline plus variants
with the litmus timbre; the X member, when present, is a separate re-encoded
delivery with its own storage id and stripped metadata. `completeMediaJob`
creates, in one mutation, one `compositions` row per render with every
required field (`title`, `recipeId`, `artifactType: "microStudy"`,
`version: "m0.1"`, `status: "rendered"`, `visibility: "private"`,
`createdBy: "system"`, `revisionParentId` to the baseline,
`revisionVariable`), sets `audioArtifactId`, and creates the `blindGroups`
row. Two-member families get labels A and B and one optional X member
duplicating A or B at random; families of three or four get A, B, C, D and no
X. Group membership is immutable.

### 3.4 Analysis

Job `analyze` on every master: Sethares pairwise roughness (`dissonant`
package, version pinned) over 100 ms frames, top 20 spectral peaks per
frame, amplitudes normalized per frame, frames below −60 dBFS skipped,
median and 90th percentile across frames stored raw; integrated LUFS; true
peak; spectral centroid. Stored under `audioArtifacts.analysis` with
`version`. No 0 to 5 mapping ships until at least ten human sessions on
validated renders exist to calibrate one; the metrics document's 0 to 1
`computedConsonanceAudio` is then derived and shown beside ear ratings, never
written into a session.

## 4. Listen page

Route `/listen` (wave 1 ships its shootout section; this wave completes it),
Clerk-gated.

1. **Queue**: ready artifacts with no human rating. Blind members show only
   label and duration; everything else shows kind, source, engine.
2. **Player**: `wavesurfer.js` with play, scrub, loop, and keys: space play,
   `[` `]` for A and B, `x` for X, 1 to 5 for ratings. Audio URLs come from
   the blind projection query or the Clerk-gated artifact query.
3. **Blind panel**: labels only; switching keeps the playhead. For an X trial
   the listener records "X is A" or "X is B", stored as `xGuess` and
   `xCorrect` on the group, never as a rating. Then each label gets the six
   subjective ratings plus conditions (`listeningMethod`, `timeOfDay`).
   Submit creates one `listeningSessions` row per member with `blindLabel`,
   sets `revealedAt`, and returns the mapping, all in one mutation. This is a
   preference workflow; the single X trial is a sanity check, not evidence.
4. **Voice note**: record (MediaRecorder, Opus), upload as a `voiceNote`
   artifact attached to the in-progress session, enqueue `transcribe`
   (faster-whisper in the media container); the transcript prefills ratings
   with the same extraction prompt freq uses and appends to `feedbackMd`.
   Submission waits for the attachment, not for the transcript.
5. **Episodes**: podcast episodes with chapters.

Recipe and composition pages embed the player for non-blind artifacts.

## 5. Data changes

- `compositions.audioArtifactId?`.
- `recipes.renderPlan?`.
- `listeningSessions.blindLabel?`, `listeningSessions.conditions?:
  { listeningMethod, timeOfDay }`.
- `blindGroups.xMember`, `xGuess`, `xCorrect`.
- `settings.renderValidation`.
- `loopReport.experimentDebt` keeps `composed_no_listening` but uses
  `isHumanListeningSession` and skips unvalidated renders.

## 6. Error handling

- SuperCollider non-zero exit: job fails with the last 20 lines of output;
  the kit stays on the media volume.
- Missing render plan: `render.request` rejects; the docket shows "needs a
  render plan".
- Loudness out of tolerance: job fails (umbrella policy), unless
  `normalize: false`.
- Transcription failure: the note stays attached; ratings are entered by hand.

## 7. Testing

- `convex/shared/tuning/*.test.ts`: moved tests pass; degree-to-Hz for the
  geometric temperament at 432 Hz matches known values to 0.01 cents.
- `media/src/engines/sc/litmus.test.ts`: generated score from a fixture plan
  carries the right Hz values; a two-second smoke render runs in the media
  image.
- `media/src/studyFamily.test.ts`: only the mapping differs between variants;
  event lists are byte-identical; labels shuffle with a seed.
- `media/src/analysis.test.ts`: a pure fifth scores lower roughness than a
  minor second on synthetic input; silence frames are skipped.
- `convex/blindGroups.test.ts`: projection, immutability, atomic reveal,
  X recorded separately.
- `web`: listen route renders; blind panel never receives labels before
  reveal; conditions required.
- Manual: the plan 11 gate (§2).

## 8. Instrument requirements for later quality tiers

A quality-render instrument must: run headless on Linux (native CLI, or
loadable in a scriptable host such as Spotify's `pedalboard` or Carla without
a display); accept exact per-note pitch (Hz input, `.scl`/`.kbm`, MTS-ESP, or
per-channel pitch bend with a wide range so any MPE-capable synth works);
render deterministically offline (no free-running modulation or unseeded
unison drift); have a licence that permits unattended use on a server (no
dongle, no per-launch online activation); and ship with no effects engaged
by default so timbre stays honest.

Candidates that meet this on Linux: Pianoteq (commercial, native CLI,
`.scl` support, physical-modelled pianos and keyboards); Surge XT CLI
(free, `.scl`/`.kbm`, includes waveguide string and modal oscillators);
Cardinal and VCV Rack headless with the Rings and Elements modal-resonator
ports (open source); the Faust physical-modelling library compiled to
SuperCollider or standalone (open source); STK models exposed through
Csound opcodes or C++ (open source); u-he Diva and Zebra (commercial,
Linux builds, MTS-ESP, host via pedalboard). Windows-only or macOS-only
physical models such as SWAM and Chromaphone are out.

## 9. Deferred

- Strudel pattern generation (needs an isolated execution boundary for
  generated code).
- Quality renders with §8 instruments.
- ACE-Step expansion (only after human `expandVerdict`, labelled not
  microtonal-precise).
- Loop-region tools and multi-listener panels.
