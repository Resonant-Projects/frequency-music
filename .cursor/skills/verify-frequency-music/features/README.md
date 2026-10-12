# Frequency Music verification map

Read this index before driving the web app. These files are the maintained verification recipes, not an inventory of everything the product supports.

## Baseline preconditions

- Launch a fresh `offline-local-ui` instance with `scripts/control.py launch <run-id>` from the repository root.
- Require `scripts/control.py doctor <run-id>` to pass. Resolve the actual URL from the receipt, never assume 4173 or reuse another process.
- Use the committed `docs/essays/*.md` corpus. The current baseline has more than 48 archive entries. No backend seed exists in this mode.
- The existing client auth-bypass flag allows local rendering. This is not a Clerk login or server-side identity proof.
- Use `scripts/control.py drive <run-id> <feature>`. The controls and assertions below match shipped Playwright helpers.

## Driving conventions

- Every recipe starts in a fresh context at `/essays`, desktop 1440 by 900, unless its step changes viewport.
- Prefer ARIA roles and accessible names. Scope essay titles to `main` so header and back links cannot collide.
- Capture commands, exit status, the run ID and feature ID. Mutation proof requires a second persisted read and a verified cleanup plan.
- Cleanup instances and scratch, not evidence. Artifacts live in `../evidence/<run-id>/` and are Git-ignored local files.

## Proof and skip reporting

- Prove every entry point listed by the selected feature, or report exactly which one failed or was skipped.
- Screenshot plus ARIA snapshot must show Frequency Music identity and the relevant state. The action log and trace show the preceding action.
- The default mode has no usable backend. Search can return real local page and essay results while research remains unavailable. Do not call a pending search a no-matches result.
- No full ingest, triage, synthesis, listening, or publication journey is verified by this baseline. Those need an approved isolated backend and feature-specific seed/cleanup.

## Feature entry contract

Every feature has an H1, a user-facing summary and exactly these four H2s, in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with Playwright`, and `Gotchas`. Commands and selectors are literal.

## Features

- [Read essays](essays.md) covers archive and detail entry points, pagination, body reads, reload and missing slugs. This is the end-to-end proof target.
- [Use navigation](navigation.md) covers grouped desktop and mobile menus and keyboard access. Local menus only, not every backend route's behavior.
- [Search Frequency](search.md) covers toolbar and keyboard entry, local page/essay results, selection reset and dismissal. Full research search remains blocked.
- [Ingest a source](ingest.md) describes real URL/YouTube ingestion and persistent readback. It fails the baseline's backend precondition, not a weakened substitute journey.
