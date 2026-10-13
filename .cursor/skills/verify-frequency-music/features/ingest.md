# Ingest a source

Users add URL or YouTube material to the research inbox and may queue extraction. A successful submission must persist the intended source, not merely show a notice.

## Sub-features

- `ingest-url` submits a URL, optional title, tags and text excerpt.
- `ingest-youtube` submits a YouTube URL, optional title, tags and transcript.
- `ingest-readback` shows the same source after reload and in Display.
- `ingest-required` refuses a blank URL without creating a source.
- `ingest-feeds` adds/enables feeds and polls them. Separate production-affecting operations, not part of this initial safe journey.

## How to get to it (user POV)

- Navigate to `/ingest`.
- Desktop header Research, then Ingest; mobile Menu, then Ingest under Research.
- Header search button or Meta+k/Control+k, type `Ingest`, choose `Ingest Page`.
- URL Ingest and YouTube Ingest forms in the Ingest Console.

## Driving it with Playwright

Preconditions:

- An explicitly approved isolated Convex backend, authenticated write identity, source extraction policy and a verified row/workflow cleanup plan are mandatory.
- The repository has one standing live self-hosted backend. This skill does not provision an isolated one or seed its tables. Its default `http://127.0.0.1:9` target is intentionally unusable.
- A harmless real source URL and a tagged run-specific title must be chosen for the isolated deployment. Queued extraction can contact fetch/model providers, so require approval for those effects too.

`./.cursor/skills/verify-frequency-music/scripts/control.py drive <run-id> ingest` returns nonzero with the unmet backend precondition before any browser mutation. This is an honest failed journey, not a passing UI-only surrogate.

After the preconditions are supplied, use the installed Playwright harness on that separately owned instance. Do not repoint the offline helper or run the existing whole live E2E suite blindly.

- Entries: use `page.goto(base + '/ingest')`, Research then `/^Ingest/`, mobile Open navigation menu then `/^Ingest/`, and each Search Frequency entry followed by the option `Ingest Page`. Require `getByRole('heading', { name: 'Ingest Console', exact: true })` for each.
- URL: `page.locator('#url-input-url').fill(sourceUrl)`, `#url-input-title` with the run-specific title, `#url-input-tags` with the run tag, and `#url-input-raw-text` with the approved excerpt. Click the exact `Ingest URL` button. Require the actual notice, which may say ingested into private inbox or ingested/updated and extraction queued, plus the matching Recent Sources title.
- Readback: `page.reload()`. Require the same unique title and canonical URL in Recent Sources, then open `/display` and locate `getByTestId('display-row').filter({ hasText: sourceTitle })`. If the row is not in the current window, find that exact source through supported user pagination/filtering or fail with the reason. Never substitute a different visible row.
- YouTube: fill `#yt-input-url`, `#yt-input-title`, `#yt-input-tags`, `#yt-input-transcript`, click `Ingest YouTube`, then require the matching notice, persisted title and canonical URL after reload.
- Required: on a fresh empty form, click Ingest URL without text and require `URL is required.`. Click Ingest YouTube without text and require `YouTube URL is required.`. Read-only backend observation must confirm no new source for these actions.
- Proof: action/response trace, before/after screenshots and ARIA state, persisted readback, exact source/workflow IDs and approved cleanup results. Capture the whole journey, including each supported entry point, before calling ingestion verified.

## Gotchas

- Current URL and YouTube forms call queueing actions, not necessarily a private-inbox-only write. A notice does not establish that no model/network work occurred.
- Existing `pipeline-happy-path.spec.ts` has a fallback to triage a different visible row; that is not acceptable evidence for this exact-source journey.
- Feed polling, feed toggles and extraction triggers contact shared external services. Do not use them as harmless startup seed steps.
- The authenticated existing harness needs Clerk credentials and its cleanup needs a write secret. Never print either or include storage state in evidence intended for sharing.
- No local backend seed exists here. Ingestion remains blocked until the preconditions above are met; client validation alone cannot satisfy persistent ingestion.
