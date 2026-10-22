# Stage 6 passage probe results, 2026-10-22

Keith approved: “Run the three probes, capped at $0.01.” GPT-6.1 Sol ran
exactly three `passages:probe` actions on `https://convex.resonantprojects.art`
at 21:05 UTC, with query `432 Hz precise temperament tuning`, `limit: 8`,
and types omitted, `["youtube"]`, then `["url"]`. An operator wrapper used the
same action and arguments as `scripts/probe-passages.ts`, preserving full
responses instead of the CLI's 90-character excerpts. No query was repeated
or substituted. Credentials came through Varlock with `APP_ENV=ci` and were
not saved in the receipts.

**Acceptance failed.** Mechanical bounds and source filters passed, but the
untyped result contained no transcript. The YouTube passage was only broadly
related, so the by-eye relevance check also did not pass in full. Criterion 5
remains unmet. This is a retrieval acceptance failure, not evidence that the
embedding API or source filters failed.

| Variant | Passages | Characters | Omitted | Returned types | Verdict |
| --- | --- | --- | --- | --- | --- |
| All sources | 3 | 10,551 | 5 | 2 URL passages, 1 PDF passage | Bounds pass; mixed article/transcript expectation fails |
| YouTube | 1 | 968 | 4 | YouTube transcript only | Bounds and filter pass; broad tuning relevance only |
| Articles (`url`) | 4 | 11,381 | 4 | URL only | Bounds, filter and topic relevance pass |

All responses had `truncated: true`; all returned source statuses were
`triaged`, with no archived source. Three subsequent read-only `sources:get`
queries confirmed each unique source's live type and whether it had a
transcript or raw text. They made no embedding calls.

## By-eye evaluation

- **All sources:** “Precise Temperament Tuning” is the leading source, with
  432.081 Hz examples and the proposed 1.26 major-third ratio. The other source
  is “Music in Terms of Science”, an arXiv PDF discussing just intonation and
  equal temperament. These are relevant tuning passages, but none is a
  transcript. Links to YouTube inside article text do not count as transcript
  results.
- **YouTube:** “Join the Shiva’s Eye Activation at Tanah Lot, Bali | July 10”
  returns a real transcript passage about equal temperament, chords,
  overtones, sine waves and “Shimmer”. It does not name 432 Hz or precise
  temperament. It has broad topic overlap, but does not establish the
  phrase-specific relevance expected for acceptance. None of the predicted
  “Easter IG LIVE” or expedition sources appeared.
- **Articles:** all four passages come from “Precise Temperament Tuning” and
  explicitly discuss 432/432.081 Hz tuning, its ratios, or linked musical
  examples. Neighboring windows overlap and repeat some prose; this check
  does not establish source diversity.

## Budget and evidence

The approved cap is $0.01. The prepared bound is 33 query characters × three
tokens per character × three embedding attempts per action × three actions
× $0.13 per million tokens = **$0.00011583**, below $0.00012. This is a
conservative ceiling, not measured provider billing: responses do not expose
embedding token usage or retry counts. No indexing or backfill was invoked.

[Probe receipts](probe-receipts-20261022.json) contain timestamps, result
metadata, source-type checks and SHA-256 hashes of full raw responses. Full
responses are retained privately on devbox under
`~/.local/state/frequency-parallel/20261022/artifacts/runtime/passage-probes-approved/`.
They were inspected in full for this judgment.

## Decisions still open

The historical [acceptance record](acceptance.md) is unchanged. Its failure
rule calls for R1 (disable paid indexing). Keith's approval expressly kept
the keep-indexing decision separate, so no switch was changed by these
probes; the coordinator has asked whether to apply R1. This report grants no
exception to criterion 5 and no approval to keep indexing enabled.

The separate criterion 6 log-gap waiver also remains open. No deployment,
publication, backfill, additional probe or human render validation occurred.
