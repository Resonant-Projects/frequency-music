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
| 3. Human versus machine listening, rated blind | Needs Keith's studio renders. The path that carries them into a blind group on `/listen` merged in #155 (`16ed588`) and is deployed since 2026-10-17 (`6fb562b2`); see [Comparison path](#comparison-path). |
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

## Comparison path

The earlier blocker (no human upload could create a `litmusRender` artifact,
and nothing grouped a machine render with a human one) is closed in source by
the [studio comparison contract](studio-comparison-contract.md):
`convex/studioComparisons.ts`, a `studioComparison` blind-group purpose and a
studio section on `/listen`. It merged in #155 (`16ed588`) and is not
deployed. Using it needs its own attested backend release and deploy; the
[rollout work order](wave2-rollout-packet.md#combined-rollout-work-order-2026-10-17)
pins `91cb3047`, which does not contain it.

Once deployed, one comparison runs:

1. **Machine baseline in production.** Save a kit's `render-plan.json` as a
   real recipe's typed plan (`renders.setPlan`) and render it
   (`renders.request`) with media renderer 0.3.0 on ai-5090-02. Only a
   finished single-member, loudness-normalized render qualifies, and each
   machine render joins at most one comparison. Study families still need
   `renderValidation=go`.
2. **Studio master.** Render that kit in the studio as in
   [Keith's studio pass](#keiths-studio-pass): a 48 kHz, 24-bit WAV of
   exactly the plan length, -18 LUFS within 0.5 LU, true peak at most
   -1 dBTP.
3. **Metadata-free MP3.** Encode the WAV with the documented command, the
   same ffmpeg arguments the litmus engine uses for its delivery
   (`STUDIO_ENCODE_COMMAND` in `convex/shared/studioComparison.ts`; a test
   holds the two equal):

   ```sh
   ffmpeg -i studio-master.wav -map_metadata -1 -fflags +bitexact -ar 48000 -ac 2 -c:a libmp3lame -b:a 256k -id3v2_version 0 -write_xing 1 studio-delivery.mp3
   ```

4. **Signed-in human upload with the exact plan.** On `/listen`, a Clerk user
   (service identities are refused) picks the machine baseline, attaches the
   same `render-plan.json` and the MP3, and fills in the provenance record
   from `provenance.md`. The server refuses a plan that differs from the
   machine job's frozen plan, a file over 95 MB or more than one second over
   the plan length at the delivery bitrate, and a loudness declaration
   outside the bounds above. After upload it checks the declared size and
   SHA-256, refuses tags, junk, variable bitrate, malformed frames, a
   different encoding or encoder header, a sample count different from the
   machine delivery, and a byte-identical copy of the machine file. Then it
   pairs the studio file with a fresh storage copy of the machine delivery
   under random labels A and B.
5. **Blind comparison in `audioRatings`.** Rate both members at once under
   one set of listening conditions, on the six render scales (overall
   optional). The ratings and the reveal commit together; afterwards the page
   shows which label was which, with the declaration, studio SHA-256, plan
   digest, recipe revision and renderer version. The ratings are general
   audio ratings, not `listeningSessions`: the path creates no composition,
   so listening debt, evidence and tournament fitness are unchanged, and
   every member stays `unvalidated`.
6. **Written contamination assessment and go or no-go.** See
   [After the comparison](#after-the-comparison).

Limitations to carry into the outcome report:

- **Loudness is declared, not measured.** Convex does not decode audio. The
  server holds the declaration to the bounds and checks frame structure and
  sample count, not integrated loudness or true peak.
- **Decoding is partial.** The browser decodes the file before upload, and
  the server parses frame headers and side information without decoding the
  Huffman-coded audio. A file can pass and still sound wrong; the listener
  hears both takes before rating.
- **Blindness guards against system leaks, not the listener.** A listener who
  downloads and hashes both files, or plays local copies, can tell them
  apart. The uploader is usually the listener.
- **Not scientific validation.** One listener rating one pair is the human
  check plan 11 asks for, not a validated measurement. A rating does not
  validate a render.
- **Visual acceptance is incomplete.** The upload form was driven in a real
  local browser against no backend (labels, errors, focus, overflow on
  desktop and mobile). The comparison, rating and reveal views have only
  backend tests; no browser has rendered them against real data.

The offline fallback stays available if the path is not deployed: someone
other than the listener assigns A and B to each kit's machine and studio
file, Keith rates with `session-sheet.md` before the mapping is revealed, and
the sheets go into the plan 11 outcome document. This is weaker, because the
blind guarantees depend on the person assigning labels.

## After the comparison

Plan 11 Task 4 asks for a report in `docs/plans/` and a decision-log entry,
whatever the outcome. `renderValidation=go` is set only after Keith's written
go, and only then are later renders stamped `validated`. A human rating of a
render does not validate it.
