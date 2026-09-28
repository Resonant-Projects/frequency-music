# Voice and Podcast Feed Design (wave 1)

Choose the house voice by blind listening, then deliver the Friday brief and
Thursday docket as episodes in a private Pocket Casts feed.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Requires wave 0. This wave is the first acceptance boundary of the program.

## 1. Outcome

- Episode 1 in Pocket Casts is a blind voice shootout. Keith rates each take
  on a minimal panel that ships with this wave; the system reveals the
  mapping after the last rating; Keith explicitly picks the house voice.
- Every Friday brief after that becomes an episode as soon as the brief is
  generated, and every Thursday docket becomes a short episode once wave 2
  produces dockets.

## 2. Voice catalog

`convex/shared/voices.ts` declares the candidates: `id`, `provider`,
`model`, `voiceId`, `runsOn`, `licence`, `openclawProvider` (how OpenClaw's
TTS reaches the same voice in wave 2), `verifiedOn`.

| id | Provider and model | Runs on | OpenClaw TTS provider |
| --- | --- | --- | --- |
| `gemini-flash-tts` | Google, Gemini 3.1 Flash TTS | hosted | `google` |
| `inworld-max` | Inworld TTS-1.5 Max | hosted | `inworld` |
| `elevenlabs-v3` | ElevenLabs v3 | hosted | `elevenlabs` |
| `breeze-2` | Breeze TTS 2 (3B), local, research licence | local on ai-5090-02 | OpenAI-compatible `baseUrl` |

Exact model ids, voice ids, and pricing were researched on 2026-09-28; the
plan's first task re-verifies each against the provider's current API and
records the result in `verifiedOn`. Qwen3-TTS is deferred: it needs its own
server and the shootout is already four takes. Kokoro and Piper are excluded
on quality.

The house voice lives in a new `settings` table (`key`, `value` strings,
unique by key) under `houseVoiceId`. The `stats` table holds numbers only and
is not reused.

## 3. Narration scripts

A Convex action `narration.buildScript` turns a source into a spoken script
with `DEFAULT_MODEL` and a versioned prompt (`NARRATION_PROMPT_VERSION`):

- Input kinds: `weeklyBrief`, `docket` (wave 2), `passage` (the fixed
  90-second calibration passage, checked into `media/fixtures/`).
- Output: plain prose, no headers or lists or links; numbers spoken as a
  reader would; ratios spoken as "three to two"; paragraph breaks marked
  `[pause]`; a `chapters` array of `{ title, startParagraph }`.
- Length: 8 to 14 minutes for a brief, 3 to 5 for a docket. The brief's
  experiment cards are trimmed to the cadence cap of 3 before scripting.
- The studio prompts (10, 30, 90 minutes) close the episode as three short
  options.

The script is stored on the narration artifact's `scriptMd`; chapter start
times are computed by the media service from per-paragraph render timings and
stored in `chapters` with seconds.

## 4. Shootout

Job `shootout`, input `{ passageArtifactId, voiceIds }`:

1. Render the passage with every listed voice. A hosted voice without a key
   is skipped and logged. `tts-local` must be up before the job is enqueued;
   the plan includes a smoke test of the local endpoint.
2. Apply the umbrella loudness policy (−16 LUFS ±0.5, ≤ −1 dBTP on the
   decoded MP3). Trim leading and trailing silence to 300 ms.
3. Complete with a `blindGroups` row: `purpose: "voiceShootout"`, members with
   opaque ids and labels "take one" through "take four" in shuffled order,
   `requiredRatings` = all members, no X member.
4. Assemble the episode: an intro rendered once by the first hosted voice
   with a key, spoken as "this intro voice is not a candidate"; then per take
   a 0.5 s 1 kHz tone at −20 dBFS, a spoken "take N", 1 s silence, the take,
   2 s silence. Episode chapters mark each take.

Rating panel: a `/listen` route ships in this wave with only the shootout
section: blind projection query, player, and a `voiceRatings` form per take
(`naturalness`, `prosody`, `clean` (5 is artifact-free), `clarity`, `overall`,
each 0 to 5 and range-checked, plus `notes`). The last required rating and
the reveal happen in one mutation; a repeat submission returns the earlier
result. Choosing the house voice is a separate button that writes
`settings.houseVoiceId`; the system never picks.

If the winner is hosted, `tts-local` stops. If it is local, hosted keys can
be removed from the compose env.

## 5. Scheduled episodes

Event-driven, with crons only for reconciliation:

- `weeklyBriefs.generateInternal` enqueues `narrate` for the new brief as its
  last step. If it throws "No recent hypotheses or recipes found", there is
  no brief and no episode; wave 2's freq reports that on Friday.
- `completeMediaJob` for a `narrate` job whose input carries
  `assembleOnDone: true` enqueues `assembleEpisode` in the same mutation, so
  readiness is guaranteed by the data, not by a timer.
- Cron `reconcile-episodes` (Saturday 02:00 UTC) enqueues narration for any
  brief in the last 14 days without a ready episode; `dedupeKey` makes this
  safe.
- Titles: `Weekly turn, week of <Monday date>` and `Thursday docket, <date>`.

## 6. Feed

Umbrella §3.5 route. Feed metadata: title "Frequency Music, private", author
"Freq", category "Music", `itunes:block yes`, `itunes:explicit false`,
artwork at `web/public/podcast-cover.png` copied into storage once and
referenced by URL. Episode GUIDs are artifact ids, newest first, capped at
100. Only `access: "feed"` episode artifacts appear.

## 7. Error handling

- Hosted TTS failure: two retries with backoff, then the take fails with the
  provider status code, never the body.
- ElevenLabs' 5 000-character cap: scripts chunk at paragraph boundaries;
  chunks concatenate with 400 ms silence; a failed chunk fails the take.
- Loudness outside tolerance or true peak above ceiling after limiting: the
  take fails; the job reports which voice.
- Zero ready episodes: a valid empty feed.

## 8. Testing

- `convex/shared/voices.test.ts`: unique ids, every entry has licence and
  OpenClaw mapping.
- `convex/narration.test.ts`: markdown stripped, chapters preserved, length
  targets on fixture briefs, prompt version stamped.
- `media/src/shootout.test.ts`: label shuffle is a permutation, timings exact,
  missing key skips a voice, member ids are opaque.
- `media/src/loudness.test.ts`: fixtures land within ±0.5 LU; true peak
  checked on decoded MP3.
- `convex/blindGroups.test.ts`: projection hides everything but label and
  duration; reveal only after all required ratings; duplicate submit is
  idempotent.
- `convex/podcast.test.ts`: wrong token 404; feed validates; private
  artifacts never appear.
- Manual: episode appears in Pocket Casts; scrubbing works or the mirror
  fallback is enabled; Keith rates and the reveal matches.

## 9. Out of scope

- Essay narration (follow-on once bulk local TTS is in place).
- OpenClaw spoken replies (wave 2).
- Qwen3-TTS (deferred).
