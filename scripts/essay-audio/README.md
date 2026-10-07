# Essay audio editions

Operator tool that reads the essays in `docs/essays/` aloud and publishes
them to the private podcast feed, one batch at a time.

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
vpx tsx scripts/essay-audio/episodes.ts prepare --batch 20261006-inworld-01 --voice inworld --next 8
vpx tsx scripts/essay-audio/episodes.ts render --batch 20261006-inworld-01 --cap-chars 90000
vpx tsx scripts/essay-audio/episodes.ts publish --batch 20261006-inworld-01
```

- `queue` lists unpublished essays, those with a feedback round first. Essays
  that lose tables or code come after the ones that read whole. It reads
  production Convex and skips any essay whose source already has an episode,
  including the October 5 trial editions.
- `prepare` writes `out/essay-audio/<batch>/manifest.json` and a readable
  `<slug>.txt` per essay. Read those before rendering. It refuses an essay
  with unconverted notation; add an entry to `overrides.json`, keyed by slug:
  `{"replace": [{"from": "ℤ[i]", "to": "the Gaussian integers"}]}`. `replace`
  edits the spoken text; `source` edits the markdown before conversion, which
  is how a display equation or table gets a spoken form. Use
  `{"skip": "reason"}` to keep an essay out of the queue.
- `render` works only in `out/`. Chunks are cached by text and settings, so a
  rerun resumes; a finished essay is re-rendered if its manifest entry
  changed, and `publish` refuses audio made from another entry. Paid
  attempts, including rejected ones, are logged in `attempts.jsonl`;
  `--cap-chars` stops the batch before it exceeds the cap.
- `publish` checks that the house voice is still `inworld-max` and the media
  queue is idle. It then stops the production media worker on ai-5090-02,
  publishes each rendered essay through the leased narrate and assemble
  lifecycle, and restarts the worker. It renders nothing and changes no
  research data.

The private feed lists the newest 100 episodes (`FEED_LIMIT` in
`convex/podcast.ts`). Publish in batches you will listen to.

## Voices

- `inworld`: Inworld TTS 1.5 Max, Dennis, at 48 kHz. This is the house voice
  and the default for the series.
- `elevenlabs`: Eleven v4 with `--eleven-voice-id`/`--eleven-voice-name`
  (default George), stability 0.5, 192 kbps MP3. This plan refuses 44.1 kHz
  PCM (`output_format_not_allowed`, Pro tier). Eleven v4 has no speed or SSML
  controls.
- `voxtral`: Voxtral 4B TTS (`neutral_male`) on a temporary vLLM-Omni GPU pod.
  Pass `--voxtral-url`. Uses 360-character chunks, up to three re-renders with
  a new seed, and `--asr`.
