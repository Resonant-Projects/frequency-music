# Studio comparison contract

Plan 11 step 3 needs one of Keith's studio renders rated blind against the
machine litmus render of the same plan
([packet](plan11-studio-validation-packet.md#comparison-path)).
This change adds that path: `convex/studioComparisons.ts`, a
`studioComparison` blind-group purpose, and a section on `/listen`. No Convex
codegen, deploy, run or production command was run; the generated API
declarations were edited by hand.

## What it does

1. **Declare** (`studioComparisons.beginUpload`, a Clerk user only). The
   person names one machine delivery, the `render-plan.json` they rendered
   from, the file's byte length and SHA-256, and a provenance record that
   mirrors the kit's `provenance.md`. The server checks, before any state
   exists:
   - the machine delivery is the ready, private, metadata-free MP3 delivery
     of a `done` single-member, loudness-normalized (`normalize: true`)
     `litmusRender` job that lists it, with its master and recipe present
     and no blind group (origin is proved by the job, not the row);
   - the submitted plan, re-admitted, is identical to the job's frozen
     snapshot (same recipe revision and constraints);
   - the size is at most `MAX_UPLOAD_BYTES` (95 MB, now in
     `convex/shared/uploadLimits.ts` and re-exported by `media/src/upload.ts`)
     and at most one second over the plan length at the delivery bitrate;
   - the declared loudness is -18 LUFS within 0.5 LU and the true peak at
     most -1 dBTP.

   It creates a pending `litmusRender` delivery with
   `engine.name: "human-studio"`, `validation: "unvalidated"`,
   `refs.recipeId`, `createdBy` the user, and `engine.params` holding the
   recipe revision, plan digest, machine artifact and job, byte length,
   SHA-256 and the declaration. Then it mints one upload URL. Repeating the
   same declaration returns the same row; the same file with a different
   plan, size or provenance is refused rather than reported as saved.
2. **Upload** the bytes to that URL (browser `fetch`).
3. **Finish** (`studioComparisons.finishUpload` action, a Clerk user only, the
   uploader only). The blob must match the declared size and SHA-256 and be
   unreferenced. The action reads it and refuses, deleting the blob and
   marking the row `failed`, when it is not bare MPEG-1 Layer III frames
   (`convex/shared/mp3Inspect.ts` rejects ID3, APE and Lyrics tags, junk,
   truncation, variable bitrate, and side information no decoder accepts:
   `big_values` over 288, a reserved block type, a reservoir pointer before
   the stream, or more coded bits than the frame and reservoir hold), differs from the machine delivery's
   bitrate, sample rate, channels, channel mode or encoder header, lasts more
   than 0.15 s off the plan, decodes to a different number of samples than
   the machine delivery, or is byte-identical to the machine delivery.
   It then stores a fresh copy of the machine delivery bytes, and one
   mutation:
   - attaches the studio blob and marks the row ready and metadata-stripped;
   - inserts the copy as a ready `litmusRender` delivery (`refs: {}`,
     `validation: "unvalidated"`, engine params `comparisonCopyOf`);
   - creates a `studioComparison` blind group of exactly those two members,
     labels A and B assigned at random, no X member;
   - stamps the group on the machine original and its master, so playback,
     recipe listings, the rating queue and the docket hide them until reveal.

   If another comparison took the machine render first, the upload is
   refused, its blob and the copy are deleted, and the row is failed.
4. **Rate** (`studioComparisons.submitRatings`, a Clerk user only). Both
   members at once, under one required `conditions` record, using the
   general render scales of `audioRatings` (`RENDER_SCORE_KEYS`; the six
   subjective scales are required, `overall` optional). One `audioRatings`
   row per member, keyed `studioComparison:<group>:<member>`, and the reveal
   commit in the same mutation. An identical resubmission after reveal is a
   replay; any other is refused.
5. **Read** (`studioComparisons.list`, `get`, `machineCandidates`, Clerk
   users only). Before reveal `get` returns only the recipe title and state.
   After reveal it returns which label was which, each member's engine, the
   machine original the copy came from, the ratings, the declaration, the
   studio SHA-256, the plan digest, the recipe revision and the renderer
   version.

The Huffman-coded audio itself is not decoded on the server. The web client
decodes the file with the browser's audio decoder before declaring it, and
the listener hears both takes before rating.

## Blindness

- Members are a studio row first readable in the grouping mutation and a
  copy whose storage id has never been served. Neither URL can be recognised
  from an earlier recipe page or cache.
- `blindGroups.create` stores members ordered by their random `memberId`,
  so the projected order does not depend on which member is the studio
  render; labels A and B are assigned independently at random.
- The studio file must decode to exactly the machine delivery's sample
  count (frame count less the LAME-tag delay and padding), so the native
  player shows the same duration for both. Export exactly the plan length.
- `blindGroups.projection` omits `durationSecs` for an unrevealed
  `studioComparison`: frame-counted lengths differ by milliseconds.
- Both files must share the machine delivery's encoding and encoder header.
  Encode the studio WAV with `STUDIO_ENCODE_COMMAND`, which uses the same
  ffmpeg arguments as `media/src/engines/sc`.
- Not defended: a listener who downloads and hashes the files, or who plays
  local copies. The uploader is usually the listener and made the studio
  render; the comparison guards against system leaks, not against the
  listener.

## Gate isolation

The path is an explicit exception to `renderValidation`, kept narrow:

- it never reads or writes the setting, and every member is `unvalidated`;
- it creates no `compositions` or `listeningSessions`, so docket
  composition debt, loop debt, evidence and tournament fitness are unchanged;
- it accepts only variable-free baselines, so study families still need
  `renderValidation=go` (`renders.request` is untouched);
- `voiceRatings.submit` and the shootout list ignore the new purpose, and
  `blindGroups.reveal` creates compositions only for `studyFamily`.

A rating does not validate a render. Go or no-go remains Keith's written
decision outside this workflow.

## Storage

Every blob the path keeps is referenced by an `audioArtifacts` row, so
`mediaSweeper` sees it. An abandoned pending row is deleted after 24 hours as
before, and a copy orphaned by a crashed action is an unreferenced blob the
sweeper removes. No table gained a `_storage` reference.

## Decisions

The coordinator accepted these for the bounded first version on 2026-10-17.

- Ratings go to `audioRatings`, the existing form for litmus renders, not to
  `listeningSessions`: a session needs a composition, and a composition for
  an unvalidated render would count as listening debt and evidence.
- Loudness is declared, not measured; Convex cannot decode audio. An
  `analyze` media job could measure both members later.
- Only normalized plans are accepted. A `normalize: false` plan keeps its
  level by design, so a -18 LUFS declaration would not express the same
  constraints.
- A machine render joins one comparison. Its original keeps the group stamp
  after reveal, so a second studio take needs a new machine render.

## Remaining human steps

1. Done 2026-10-17: the backend release `6fb562b2` contains this change, and
   post-deploy coverage reported the seventh group, `studio-comparison`,
   deployed with nothing missing
   ([window record](evidence/wave2-rollout-20261017/candidate-6fb562b2/window.md)).
   No signed-in browser has rendered the `/listen` studio section against
   production data yet.
2. Save a typed render plan on a real recipe (`renders.setPlan`) and render
   it in production (`renders.request`) with media 0.3.0 on ai-5090-02.
3. Generate the studio kit from that plan, render in the studio per the kit
   card, measure loudness, and encode with the command above.
4. On `/listen`, upload the studio MP3 with the plan file and provenance,
   then rate both takes blind.
5. Write the plan 11 outcome and decision-log entry. Setting
   `renderValidation` stays a separate, human act.
