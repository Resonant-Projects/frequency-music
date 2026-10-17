# Plan 11 studio validation packet

Prepared 2026-10-17. This packet carries the render ladder validation gate
([render ladder §2](superpowers/specs/2026-09-28-render-ladder-and-listen-page-design.md),
[plan 11](plans/2026-07-07-11-loop-selfrender-spike.md)) from the merged
renderer to Keith's studio comparison. It produces local files and local
machine renders only. It contacts no deployment, uploads nothing, and does not
change `renderValidation`. The go or no-go decision remains Keith's.

## Where the gate stands

| Step | State |
| --- | --- |
| 1. Bounded spike: three kits with the litmus engine | Done on 2026-10-13 (4-second renders, [SC README](../media/src/engines/sc/README.md)). Repeated on 2026-10-17 at 30 seconds with the published media image; see evidence below. |
| 2. Pitch check under 0.5 cents | Done on 2026-10-13 for six sustained notes; on 2026-10-17 every distinct key of the three 30-second renders measured within 0.01 cent of the packet's pitch table. Necessary, not sufficient. |
| 3. Human versus machine listening, rated blind | Needs Keith's studio renders. The blind `/listen` route cannot hold them yet; see [Blocker](#blocker-studio-renders-cannot-join-a-blind-group). |
| 4. Contamination assessment and go or no-go | Keith's decision, written up in `docs/plans/` as the plan 11 outcome. |

## The three kits

The kits are the three bounded kits from the October 13 smoke run, lengthened
to the plan 11 floor of 30 seconds. Each uses the shared seed generator with
no recipe parameters: 8 bars of quarter notes at 120 BPM, 32 seed notes looped
to 60 notes.

| Slug | Tuning | Degree 0 |
| --- | --- | --- |
| `edo19-432hz` | 19-EDO | 432 Hz |
| `ji5-261.63hz` | 5-limit JI (1/1 9/8 5/4 4/3 3/2 5/3 15/8) | 261.63 Hz |
| `edo12-440hz` | 12-EDO | 440 Hz |

These are reference kits, not recipes from the corpus. Plan 11 asks for real
recipes. Choosing real recipes requires reading production recipes and saving
a typed render plan on each (`renders.setPlan`), which is a production write.
If Keith prefers real recipes, name them and the coordinator can approve the
reads; the generator accepts other kit definitions through
`buildStudioPacket(kits)`.

## Generate the packet

```sh
vpx tsx scripts/studio-validation-kit.ts --out <new directory>
```

The command reads no environment and makes no network call. It refuses a
non-empty directory. Output:

| File | Purpose |
| --- | --- |
| `<slug>/render-plan.json` | The admitted render plan. Byte-for-byte what the machine render uses, and what `renders.setPlan` would store. |
| `<slug>/seed-degree.mid` | Type 0 MIDI, 960 PPQ, the full 30-second note list. Key = 60 + octave × degrees + degree. |
| `<slug>/tuning.scl`, `<slug>/tuning.kbm` | Scala scale and a linear keyboard map: key 60 is degree 0 and sounds the plan's `referenceHz`. |
| `<slug>/notes.csv` | Exact start, end, key, degree and Hz of every note. |
| `<slug>/card.md` | The constraint sheet for the studio pass, with the pitch table. |
| `<slug>/provenance.md` | Template Keith fills in for his render. |
| `session-sheet.md` | Blind rating sheet with the six subjective `listeningSessions` scales. |
| `machine-render.mjs` | Driver that renders every kit inside the media image. |
| `manifest.json` | Size and SHA-256 of every file. |

The starter kit's `seed.mid` is a lossy 12-TET export (19-EDO degrees 1 and 2
share a semitone), so it cannot serve this comparison. `seed-degree.mid` with
`tuning.kbm` reproduces the renderer's frequencies exactly. Tests check the
note list against the renderer's own score expansion, decode the MIDI back to
the same notes, and recompute every key's frequency from the `.scl` and
`.kbm` text (asserted under 1e-5 cent; Scala stores EDO steps to five decimals).

## Machine renders

Run the published media image offline. The tag below is the image built from
`main` at `0cc0592` (renderer 0.3.0), the newest media runtime on `main`.

```sh
docker run --rm --network none --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e TMPDIR=/tmp \
  -v <packet>:/packet:ro -v <output>:/out -w /app/media \
  --entrypoint node_modules/.bin/tsx \
  ghcr.io/resonant-projects/frequency-music-media:sha-0cc05921d05c53dd6a3076824b19aab68215a77a \
  /packet/machine-render.mjs /packet /out
```

Each kit gets `machine-master.wav` (48 kHz, 24-bit) and
`machine-delivery.mp3` (256 kbps) through the production `renderLocal`
path, including its loudness policy.

Evidence from 2026-10-17 on the rollout worker host:

| Kit | Master | Delivery | True peak |
| --- | --- | --- | --- |
| `edo12-440hz` | 30.000 s, -18.0 LUFS | 30.000 s, -18.0 LUFS | -11.2 dBFS |
| `edo19-432hz` | 30.000 s, -18.0 LUFS | 30.000 s, -18.0 LUFS | -11.1 dBFS |
| `ji5-261.63hz` | 30.000 s, -18.0 LUFS | 30.000 s, -18.0 LUFS | -10.7 dBFS |

A Hann-windowed DTFT peak search at the first occurrence of each of the 38
distinct keys found a maximum error of 0.01 cent, the search resolution.
These renders are local files. They are not production artifacts and carry no
`validation` stamp.

## Keith's studio pass

For each kit, follow `card.md`:

1. Load `seed-degree.mid` unchanged into one instrument track.
2. Load `tuning.scl` and `tuning.kbm` in the instrument, or in MTS-ESP Master
   for an MTS-ESP client. Diva, Zebra and Repro accept MTS-ESP. Check one held
   note with a tuner against the card's pitch table.
3. Use one instrument and patch for all three kits. Avoid vibrato, detune,
   unison spread, chorus, pitch envelopes and glide. Time-based effects that
   leave pitch alone are allowed and must be recorded.
4. Export exactly 30 seconds: 48 kHz, 24-bit stereo WAV, -18 LUFS within
   0.5 LU, true peak at most -1 dBTP, reached with gain.
5. Fill in `provenance.md`, including the file's SHA-256.

Studio time is Keith's; no paid service is involved.

## Blocker: studio renders cannot join a blind group

The render ladder design says Keith's studio renders are "uploaded as
`litmusRender` artifacts with `engine.name: "human-studio"` so they join a
blind group like any other member". On `main` at `ec04c7c` that path does not
exist:

- Audio artifacts are minted only by a leased media job
  (`convex/mediaToolsInternal.ts`); no human upload creates a `litmusRender`
  artifact.
- Blind groups are created only by media job effects
  (`convex/mediaJobEffects.ts`), for a voice shootout or for the members of
  one render's study family. Nothing groups a machine render with a human
  one.
- Study families require `renderValidation=go`, which is the decision this
  comparison exists to make.

Building that path changes shared Convex schema and functions, which this
rollout lane does not own. Two ways forward, for Keith and the coordinator to
choose:

1. **Implement the human-studio path first.** A separately authorized change
   adds a Clerk-gated studio upload that mints an unvalidated `litmusRender`
   delivery with `engine.name: "human-studio"` and the recipe reference, and a
   blind-group purpose that pairs one machine delivery with one studio
   delivery per kit. Ratings then land in `listeningSessions` through the
   existing panel. This matches the design.
2. **Run the comparison offline now.** Someone other than the listener
   assigns A and B to the machine and studio file of each kit; Keith rates
   with `session-sheet.md` before the mapping is revealed. Record the sheets
   in the plan 11 outcome document. This is weaker: the sessions are not in
   `listeningSessions`, and the design's blind panel guarantees (no labels
   before reveal) depend on the person assigning labels.

Either way the machine side must eventually be rendered in production through
`renders.request` so the compared artifact is the one later stamped. That
needs the Convex deployment, media image 0.3.0 on ai-5090-02, and a recipe
with a typed render plan, each per the [rollout packet](wave2-rollout-packet.md).

## After the comparison

Plan 11 Task 4 asks for a report in `docs/plans/` and a decision-log entry,
whatever the outcome. `renderValidation=go` is set only after Keith's written
go, and only then are later renders stamped `validated`. A human rating of a
render does not validate it.
