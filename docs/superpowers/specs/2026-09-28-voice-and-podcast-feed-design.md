# Voice and Podcast Feed Design (wave 1)

Choose the house voice by blind listening, then deliver the Friday brief and
Thursday docket as episodes in a private Pocket Casts feed.

Parent: [Listen-first program](./2026-09-28-listen-first-program-design.md).
Requires the wave 0 substrate (`audioArtifacts`, `blindGroups`, `mediaJobs`,
media service, podcast routes).

## 1. Outcome

- Episode 1 in Pocket Casts is a blind voice shootout. Keith rates each take on
  the listen page or by voice; the system unblinds and stores the winner as the
  house voice.
- Every Friday brief after that arrives as an episode within an hour of the
  brief's generation. Every Thursday docket arrives as a short episode.
- Voice quality is judged by Keith's ears, never by a leaderboard.

## 2. Voice catalog

`convex/shared/voices.ts` declares the candidates. Each entry has `id`,
`provider`, `model`, `voiceId`, `runsOn: "hosted" | "local"`, `license`, and
`tags: string[]` (supported inline delivery tags such as `[pause]`).

| id | Provider and model | Runs on | Notes |
| --- | --- | --- | --- |
| `gemini-flash-tts` | Google, Gemini 3.1 Flash TTS | hosted | Top of the Artificial Analysis speech arena; inline style tags. Needs a Gemini key. |
| `inworld-max` | Inworld TTS-1.5 Max | hosted | Near-top quality at the lowest price. |
| `elevenlabs-v3` | ElevenLabs v3 | hosted | Best narrative pacing; 5 000-character request cap, so scripts are chunked at paragraph boundaries. |
| `breeze-2` | Breeze TTS 2, 3B, local | local | Open weights, research licence, personal use only. Voice designed from a text description. |
| `qwen3-tts` | Qwen3-TTS 1.7B, local | local | Apache licence; included so a permissive local option gets a fair hearing. |

Kokoro and Piper are excluded on quality. The house voice is stored in a
new `settings` table (`key: string`, `value: string`, unique by key; the
existing `stats` table holds numbers only) under key `houseVoiceId`, read by
every narration job; a per-artifact
`voice` override exists for the shootout and for later comparisons.

## 3. Narration scripts

Markdown is not speakable. A Convex action `narration.buildScript` turns a
source document into a spoken script with `DEFAULT_MODEL`:

- Input kinds: `weeklyBrief`, `docket` (wave 2 supplies the docket), `passage`
  (a fixed 90-second calibration passage for the shootout).
- Output: plain prose with no headers, lists, links, or code; numbers spelled
  where a reader would say them; tuning ratios spoken as "three to two";
  section breaks as a blank line plus `[pause]`; a `chapters` array of
  `{ title, startParagraph }` for episode chapter marks.
- The prompt is versioned (`NARRATION_PROMPT_VERSION`) and stored on the
  artifact as `voice.promptVersion`. Length target: 8–14 minutes for a brief,
  3–5 minutes for a docket, so the brief prompt's "3–10 cards" is trimmed to the
  cadence cap of 3 before scripting.
- Studio prompts (10/30/90 minute variants) become the closing chapter, read as
  three short options.

Scripts are stored as `audioArtifacts.scriptMd` on the narration artifact so
the listen page can show text alongside audio and so re-renders with a new
voice reuse the script.

## 4. The shootout episode

A `mediaJobs` job of kind `shootout` with input `{ passageArtifactId, voiceIds }`:

1. Render the same calibration passage with every voice in the catalog.
   Local voices run in the `tts-local` container; hosted voices are called
   directly. A voice whose key is absent is skipped and logged, not failed.
2. Normalize all takes to −16 LUFS and trim leading and trailing silence to
   300 ms so level and timing cannot give a voice away.
3. Create a `blindGroups` row with `purpose: "voiceShootout"` and shuffled
   labels "take one" through "take N".
4. Assemble one episode: a 20-second spoken intro (rendered once by the first
   hosted voice that has a key, stated aloud as the intro voice and excluded
   from rating),
   then for each take a 1 kHz tone at −20 dBFS for 0.5 seconds, a spoken "take
   N", 1 second of silence, the take, 2 seconds of silence.
5. Register the episode artifact with `refs.blindGroupId` and the per-take
   artifacts with `blindLabel`.

Rating happens on `/listen` (wave 3 builds the full page; wave 1 ships the
minimal shootout panel of that page) or by voice through freq (wave 2). A
`voiceRatings` table records per take: `naturalness`, `prosody`,
`artifacts` (audible glitches, inverted so 5 is clean), `clarity`, `overall`,
each 0–5, plus `notes`. When every take in the group has a rating, the
mutation sets `blindGroups.revealedAt`, and the listen page shows the mapping.
Setting `houseVoiceId` is a separate explicit click or voice confirmation; the
system never auto-selects.

If the winner is hosted, its key stays in the media compose env and the
`tts-local` container is stopped. If the winner is local, hosted keys can be
removed.

## 5. Scheduled episodes

- `convex/crons.ts` gains `narrate-weekly-brief` (Friday 17:00 UTC, one hour
  after `generate-weekly-turn`) which finds the newest brief without a
  narration artifact and enqueues `narrate` then `assembleEpisode` jobs.
- `narrate-thursday-docket` (Thursday 17:00 UTC) does the same for the docket
  once wave 2 exists; until then the cron is registered but exits when no
  docket source exists.
- `assembleEpisode` input: `{ narrationArtifactId, title, chapters }`. Output:
  an `episode` artifact with ID3 chapters and a 1-second lead-in of silence.
- Episode titles: `Weekly turn, week of <Monday date>` and
  `Thursday docket, <date>`.

## 6. Feed

Built by the wave 0 route. Feed metadata: title "Frequency Music, private",
author "Freq", one category "Music", `itunes:block yes`, `itunes:explicit
false`, artwork from `web/public/podcast-cover.png` served through the same
route. Episode GUIDs are the artifact ids. Episode order is newest first,
capped at 100.

## 7. Error handling

- A hosted TTS request failure retries twice with backoff; a third failure
  fails the job with the provider's status code in `error`, never the response
  body.
- Chunked scripts (ElevenLabs cap) render chunk by chunk and are concatenated
  with 400 ms of silence at paragraph breaks; a failed chunk fails the take.
- Loudness normalization that cannot reach target within ±1 LU logs the
  measured value and proceeds; a take with clipping above −0.1 dBTP after
  limiting fails.
- Feed generation with zero ready episodes returns a valid empty feed.

## 8. Testing

- `convex/shared/voices.test.ts`: catalog ids unique, every entry has a
  provider and licence.
- `convex/narration.test.ts`: script builder strips markdown, keeps chapter
  boundaries, respects length targets on fixture briefs; prompt version is
  stamped.
- `media/src/shootout.test.ts`: label shuffling is a permutation, tone and
  spacing timings are exact, a missing key skips a voice.
- `media/src/loudness.test.ts`: fixture WAVs normalize to −16 ±0.5 LUFS.
- `convex/podcast.test.ts`: wrong token gives 404; feed validates against an
  RSS schema fixture; episode audio route sets content headers.
- Manual acceptance: episode appears in Pocket Casts within one refresh; Keith
  rates the shootout and the reveal matches the labels.

## 9. Out of scope

- Essay narration (follow-on after the house voice is chosen).
- OpenClaw voice replies (wave 2).
- Range requests on the audio route (see umbrella §3.5 risk).
