# Implementation Plans

Three improve-skill waves live here. Each executor: read the plan fully before
starting, honor its STOP conditions, and update your row when done.

- **Wave 1 (2026-07-07)** at `a30f10c`, plans 001–010. Only 008 remains active.
- **Wave 2 (2026-07-15)** at `86f0751`, plans 011–015. All DONE 2026-07-18.
- **Wave 3 (2026-11-09)** at `cf4a8174`, plans 017–024. All TODO. (016 was
  used informally for a lint cleanup; the number is skipped.)

Waves 1 and 2 are archived verbatim:
[status ledger](./archive/ledger-waves-1-2.md) and
[findings not planned](./archive/ledger-not-planned-waves-1-2.md). Cross-repo
plan status is in `docs/plans/README.md`.

## Standing constraints for every plan

- `vpx convex codegen|dev|deploy|run` and the `bunx convex` equivalents
  contact the LIVE self-hosted backend. No plan here requires them; executors
  never run them. Deploying a Convex change is operator-gated.
- A new Convex module with registered functions is added by hand to
  `convex/_generated/api.d.ts` and `harness/modules.ts`.
- `AUTH_BYPASS_ENABLED=true` in production is intentional (decision log
  2026-07-16). Do not file plans to disable it.
- Never commit with `--no-verify`. If the size hook blocks a file, report it.

## Wave 3 (2026-11-09): execution order and status

Maintainer decisions recorded 2026-11-09 (Keith): the size hook becomes a
ratchet; reads require a signed-in user or the service secret; writes,
deletes and paid inference require the `admin` or `collaborator` role.

Plan review answered 2026-11-10 (Keith), all four kept as written: the
operator grants the first writer role with `users:setRole` (018); tier 1 of
login-required reads is Sources, inbox and listening (020); hypothesis
generation uses `retry: false` plus a known-fields projection (021); a
rejected draft rests its Correspondence for 28 days (024). The plans are
approved for execution as they stand.

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 017 | [Size hook becomes a ratchet](./017-size-hook-ratchet.md) | P1 | S–M | — | DONE 2026-11-10 |
| 018 | [Role-gated writes](./018-role-gated-writes.md) | P1 | M | — | DONE 2026-11-10; deploy needs the operator's users row confirmed first |
| 019 | [Creator identity and safe URL resubmit](./019-creator-identity-and-safe-resubmit.md) | P1 | S–M | 017, 018 | TODO |
| 020 | [Login-required reads, tier 1](./020-login-required-reads.md) | P1 | M | 017, 018, 019 | TODO |
| 021 | [Hypothesis generation retry safety](./021-hypothesis-generation-retry-safety.md) | P2 | S | — | TODO |
| 022 | [CI workflow hardening](./022-ci-workflow-hardening.md) | P2 | S | 017 (step 5 only) | TODO |
| 023 | [Listening UI fixes](./023-listening-ui-fixes.md) | P2 | S | 017; 018 (step 4 only) | TODO |
| 024 | [Agent target rotation](./024-agent-target-rotation.md) | P2 | M | 017 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

**Recommended order**: 017 first. Then 018 → 019 → 020 in sequence. 021 and
022 can run at any time, in parallel with the rest. 023 and 024 after 017.

### Dependency notes

- **017 before 019, 020, 023, 024**: those plans edit files that are over the
  20,000-byte limit (`convex/sources.ts`, `convex/campaigns.ts`,
  `convex/correspondences.ts`, `convex/editorialArtifacts.ts`,
  `convex/agentDrafts.ts`, `convex/correspondenceCandidates.ts`,
  `web/src/routes/composition-detail.tsx`). Without the ratchet they cannot be
  committed at all.
- **Do not run `--prune-baseline` between 019 and 020**: 019 shrinks
  `convex/sources.ts`, and 020 uses that room.
- **018 before 019 and 020**: 018 adds `requireReader`, `seedUser` and
  `convex/users.ts`; 019's tests and 020's gate use them.
- **018 and 020 deploy together**, operator-gated. Before that deploy the
  operator confirms their own `users` row has a writer role, or the web app
  becomes read-only for them.
- **018, 019, 021 all touch `convex/hypotheses.ts`** at different lines; land
  them sequentially or expect a small merge.
- **022 step 5** adds the size check to CI and needs 017's baseline file.

## Wave 1 item still open

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 008 | Run first eval baseline sweep (operational) | P2 | S–M | Golden datasets ratified; needs live API keys | STAGE 1 DONE 2026-10-17: extraction and hypothesis are baselined. Stage 2 (weekly briefs) stays BLOCKED: STOP 4 applies, at 2 rows and 0 production theses, and stage 2 has no approval. Full status text and evidence links: [archived ledger](./archive/ledger-waves-1-2.md) |

## Wave 3: vetted but not planned

Confirmed in code by the advisor unless marked "reported". Promote any of
these in a later wave.

- **Agent-run terminal transitions are unfenced** (`convex/agentRuns.ts:215-243`,
  `:428-459`): `markCompleted`/`markFailed` patch status without reading it,
  so a run swept as stale can flip back to completed. Related (reported):
  graph-owned graphs swallow a failed final write
  (`agent/src/graphs/shared/audit.ts:63-96`).
- **YouTube submissions report "queued" but never extract**
  (`convex/workflows.ts:62`): the workflow checks only `rawText`, never
  `transcript`. S-effort.
- **Home page reads every concept row** (`convex/graph.ts:905-915`,
  `web/src/routes/zodiac-3d.tsx:95`): six subscriptions `.collect()` whole
  domains, inline embeddings included. Needs an index, so it needs
  `convex/schema.ts` to shrink first.
- **Reported, not individually vetted**: list queries ship full Source text
  to the browser (`convex/inbox.ts:99`, `convex/dashboard.ts:569`); the weekly
  embedding sweep scans by filter (`convex/embeddingsStore.ts:139-161`); the
  media worker cannot stop cooperatively mid-narration (`media/src/main.ts:26-42`);
  header-only TTS audio is retained as a valid chunk
  (`media/src/retained.ts:124`); `ingest.ingestUrl` (`convex/ingest.ts:503`)
  has no caller and fetches directly; `pollFeed` does not validate the feed
  URL; DOI suffix gaps (`convex/shared/doi.ts:42-61`); a retained extraction
  whose Source was deleted retries forever (`convex/operationFailures.ts:413`);
  stored URLs rendered as `href` without a scheme check; no response headers
  in `web/vercel.json`; the paid-character cap in
  `scripts/essay-audio/episodes.ts:414-509` and the editorial publish state
  machine (`convex/editorialArtifacts.ts`) are untested; three dashboard
  queries have no caller (`convex/dashboard.ts:283-527`, `:985`); the media
  worker has a weaker private copy of `redactError` (`media/src/log.ts:5-11`);
  `@convex-dev/action-cache` is mounted but unused; `test:recovery`, four web
  unit tests and `scripts/check-model-catalog.ts` run in no workflow;
  `docs/schema.md` covers 11 of 41 tables; the research-pipeline scope loader
  drops two tools' results (`agent/src/graphs/research-pipeline/nodes.ts:99-223`);
  the drafter's self-check discard leaves no record (see plan 024's notes);
  five more create forms lack double-submit guards (see plan 023's notes).
- **Wave 2 carry-overs, still present**: weekly-brief `weekOf` on a Sunday
  (now `convex/weeklyBriefs.ts:786-789`); the unvalidated extraction cast (now
  `convex/extract.ts:162`, partly mitigated by a validator at retention). The
  Wave 2 "already-linked" bug is planned as 021.

### Considered and rejected

- **Fork pull requests on self-hosted runners**: `ci.yml` routes forks to
  ephemeral GARM runners on purpose. What remains is an operator check of
  GitHub's fork-approval setting and the runners' network egress.
- **Podcast enclosure URLs not bound to the feed token**: Convex storage URLs
  are capability links by design. Document it; rotation does not revoke them.
- **Codex fallback subprocess inherits the worker environment**: off by
  default (`CODEX_ENABLED`), read-only sandbox.

### Direction options (for the maintainer, not planned)

- **RSS and URL full text**: polled feed items stop at the feed's excerpt
  (`convex/ingest.ts:358-376`), while PDFs, YouTube and scouted URLs reach
  full text unattended. The fetch must go through the worker or Lab Firecrawl.
- **Recipe eval runner**: plan 13 is cleared to change recipe drafting, and
  `docs/eval-baselines.md:105-114` has an empty recipe table and no runner.
- **Theses**: production holds zero thesis rows, which blocks the
  weekly-brief baseline (plan 008 stage 2). Seed a few by hand, or drop the
  thesis gate from the brief evaluator.

## Audit coverage note (Wave 3)

Standard effort, audited at `cf4a8174` by four parallel read-only passes
(Convex correctness; security; agent, media and web correctness; performance,
tests, debt, dependencies, DX, docs and direction), weighted to the change
since `86f0751`. Every finding that became a plan was re-read in code by the
advisor. No test, typecheck or build was run: the audit worktree had no
installed dependencies and the audit is read-only.

NOT audited: `convex/hypothesisTournament*.ts`, the decision-signer modules
beyond their auth checks, `docketBlurbs.ts`, `narration.ts`, `campaigns.ts`,
most `web/src` JSX and the 3D scene code, agent prompts, `scripts/lib/`,
`files.zip`, `scripts/archive/`, and anything that needs a live system (Clerk,
Vercel and GitHub settings; production row counts). No secrets were
reproduced; no prompt-injection content was found.
