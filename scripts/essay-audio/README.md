# Essay audio editions

Operator tool that reads the essays in `docs/essays/` aloud and publishes
them to the private podcast feed, one batch at a time. Weekly Turns stay in
text; brief generation and cron jobs no longer enqueue their narration.
The default for new essay batches is ElevenLabs so the monthly subscription
allowance goes toward essays. Use included credits only, with no paid overage.
Keep batches small. Each essay gets one audio edition, regardless of voice;
try voices on different essays. Existing manifests retain their chosen voice.

## What it fixes over the October 5 listening trials

- **Speakable text** (`spoken.ts`). Ratios and fractions (`3/2`, `81:80`),
  tuning shorthand (`12-TET`, `31-EDO`), units (`kbps`, `Hz`), common Unicode
  math, sharps and flats, and abbreviations become spoken English. LaTeX,
  inline or display, is never read automatically: the essay waits for a
  `source` override, and the warning suggests a reading to start from. Any
  notation left unconverted also holds the essay for an override. Convex
  record ids, repository paths, `[S2]` citation markers, links, `Sources`
  sections, and `_Sources:`/`_Related:` footers are left out. Tables and code
  listings are replaced by a one-line spoken notice.
- **Section delineation** (`media/src/audio/pacing.ts`). Each `##` heading
  is announced as "Part two. …", with a 2 s pause before it and 1 s after.
  Paragraphs get 0.7 s, a horizontal rule 1.6 s, and sentence chunks 0.25 s.
  Every chunk is trimmed to its speech first, so provider silence does not
  set the spacing.
- **Runaway chunks** (`checkChunk`). A chunk far slower or faster than
  speech, which is how the Voxtral take mumbled for nearly three minutes, is
  re-rendered and never assembled. `--asr` adds a Groq Whisper word-error
  check, worth using for local models.
- **Noise floor** (`roomTone`). For ElevenLabs, a pink-noise bed at the take's
  measured floor runs under the narration, so pauses keep the voice's room
  tone instead of dropping to digital silence.

## Use

```sh
vpx tsx scripts/essay-audio/episodes.ts queue --limit 10
vpx tsx scripts/essay-audio/episodes.ts prepare --batch 20261010-elevenlabs-01 --voice elevenlabs --next 8
vpx tsx scripts/essay-audio/episodes.ts render --batch 20261010-elevenlabs-01 --cap-chars 90000
vpx tsx scripts/essay-audio/episodes.ts publish --batch 20261010-elevenlabs-01
```

- `queue` lists unpublished essays, those with a feedback round first. Essays
  that lose tables or code come after the ones that read whole. It reads
  production Convex and skips any essay whose source already has an episode,
  including the October 5 trial editions. It also skips essays reserved by
  local batch manifests, including unpublished voice trials. Keep those
  manifests with their audio so the history remains available. Run one
  operator batch at a time; local reservations are not a distributed lock.
- `prepare` checks the full production publication history and local batch
  manifests even for explicit `--slugs`. It rejects duplicates, including
  repeated slugs within a batch, and refuses to overwrite an existing batch.
  Resume an interrupted batch with `render` or `publish`.
  It writes `out/essay-audio/<batch>/manifest.json` and a readable
  `<slug>.txt` per essay. Read those before rendering. It refuses an essay
  with unconverted notation; add an entry to `overrides.json`, keyed by slug:
  `{"replace": [{"from": "ℤ[i]", "to": "the Gaussian integers"}]}`. `replace`
  edits the spoken text; `source` edits the markdown before conversion, which
  is how a display equation or table gets a spoken form. Use
  `{"skip": "reason"}` to keep an essay out of the queue.
- `render` rechecks production publication history before synthesis and skips
  published essays, including ones older than the newest 100 feed entries.
  It rejects essays reserved by another local batch. It writes only in
  `out/`. Chunks are cached by text and settings, so interrupted work resumes
  in its original batch. A finished render cannot be replaced by changing
  its manifest settings, and `publish` refuses mismatched audio. Paid
  attempts, including rejected ones, are logged in `attempts.jsonl`;
  `--cap-chars` is required and stops the batch before it exceeds the cap.
  Check the provider's current included allowance and API-key limit first.
  The cap counts characters attempted in this batch, not credits remaining
  across the account or other batches. Do not assume unused subscription
  credits override a lower API-key allowance.
- `publish` checks that the house voice is still `inworld-max` and the media
  queue is idle. It then stops the production media worker on ai-5090-02,
  publishes each rendered essay through the leased narrate and assemble
  lifecycle, and restarts the worker. It renders nothing and changes no
  research data. If publication parks an essay job, rerunning `publish` requeues
  its exact narration or assembly snapshot under the original job ID, preserving
  retained output and attached uploads. Keep the batch's `publisher/retained`
  directory while a job is parked; successful completion removes its checkpoints.

The private feed lists the newest 100 episodes (`FEED_LIMIT` in
`convex/podcast.ts`). Publish in batches you will listen to.

## Voices

- `inworld`: Inworld TTS 1.5 Max, Dennis, at 48 kHz. This is the house voice
  but new essay batches default to ElevenLabs.
- `elevenlabs`: Eleven v4 with `--eleven-voice-id`/`--eleven-voice-name`
  (default George), stability 0.5, 192 kbps MP3. This plan refuses 44.1 kHz
  PCM (`output_format_not_allowed`, Pro tier). Eleven v4 has no speed or SSML
  controls.
- `cartesia-nandi` and `cartesia-quentin`: the catalog's pinned Sonic model
  with Nandi and Quentin, respectively, delivered as 48 kHz PCM WAV. Both
  use the essay pipeline's spoken-text conversion, section pacing, chunk
  checks, and optional ASR. Each synthesis call makes one request so all
  paid attempts remain visible to the character cap. Resolve
  `CARTESIA_API_KEY` through the root Varlock schema.
- `voxtral`: Voxtral 4B TTS (`neutral_male`) on a temporary vLLM-Omni GPU pod.
  Pass `--voxtral-url`. Uses 360-character chunks, up to three re-renders with
  a new seed, and `--asr`.

## Trying another voice

Use a different, unpublished essay for each voice. Same-essay comparison
renders are no longer part of the workflow. Choose the next available essay
through the queue instead of reusing an essay you have already heard.

```sh
vpx tsx scripts/essay-audio/episodes.ts prepare --batch cartesia-nandi-next --voice cartesia-nandi --next 1
vpx tsx scripts/essay-audio/episodes.ts render --batch cartesia-nandi-next --cap-chars 12000 --asr
```

Read the prepared script and check the provider's allowance before rendering.
Use `out/essay-audio/<batch>/<slug>/normalized.wav` for listening before
publishing. Voice selection for a batch does not change the saved house voice.
ASR checks transcription, not how natural the delivery sounds.
