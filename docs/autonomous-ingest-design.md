# Autonomous ingest design

## 1. Goal

Phase A's goal is:

> every supported source type can move from raw input to `text_ready` or a clear blocked state without manual paste work

Its definition of done is:

> - inbox actions match real backend capabilities
> - a user can submit a URL or YouTube link without pasting content
> - blocked items expose exact failure reasons and retry paths

This design also binds the workstream requirement that "manual text paste becomes optional rather than expected" and the workflow-operations requirement that "users can tell whether automation is working without checking logs." In project vocabulary, every **Source Intake** path shares one **Dedupe Key** contract; only `convex/sourceUtils.ts` may compute it.

The spike validates only the narrowest risky seam: a DB-write-free `fetchUrlText` internal action can make the same Jina Reader request as the hand-run URL script. It does not wire intake, persistence, retries, or extraction.

Requirement traceability:

| Binding must | Quoted source | Design response |
|---|---|---|
| Automated terminal state | Roadmap: "every supported source type can move from raw input to `text_ready` or a clear blocked state without manual paste work" | Sections 3–4 define the common intake/workflow contract |
| Retry and exact failure | Roadmap: "blocked items expose exact failure reasons and retry paths" | Sections 3–5 define stable error codes and retry rules |
| Visible operations | Workstream: "users can tell whether automation is working without checking logs" | Section 5 assigns source and system status surfaces |
| Shared identity | `CONTEXT.md`: "All intake paths share one dedupe contract" | Section 3 requires `sourceUtils` at every Source Intake boundary |

## 2. Capability table

| Source type | Current mechanism | Environment names | Runtime requirements | Observed failure modes |
|---|---|---|---|---|
| URL — plain | `fetch-full-articles.ts` and `smart-fetch.ts` call `https://r.jina.ai/<url>`; smart-fetch falls back to direct HTML extraction | Jina needs no key; script writes need `CONVEX_URL`/`CONVEX_SELF_HOSTED_URL` and `AUTH_BYPASS_SECRET` | Plain outbound `fetch`; direct fallback needs HTML cleanup | non-2xx, 30-second timeout/network failure, empty or ≤500-character result, fetched text no longer than the stored excerpt, oversized content |
| RSS | `ingest.pollFeed` fetches XML and stores embedded content/description; short items later use the URL scripts | No fetch-provider key; feed configuration is in Convex | Plain outbound `fetch`, XML parsing, then Jina for linked full text | feed HTTP errors, malformed/truncated entries silently omitted, missing title/link, description-only text too short |
| URL — blocked/Cloudflare | `fetch-article-kernel.ts`, `smart-fetch.ts`, and blocked batches use Kernel remote Playwright | `KERNEL_API_KEY`; script writes also use Convex URL and auth-bypass names | Bun/Node SDK plus a remote stealth browser session; current scripts run sequentially or within the five-session service limit | CAPTCHA/Cloudflare, navigation timeout, provider/rate failure, zero or ≤500 characters, selector miss, session cleanup failure, Convex write failure with `/tmp` fallback |
| YouTube | `fetch-youtube-transcripts.ts` shells out to Fabric; `convex/fabric.ts` separately tries Supadata then Tactiq with plain fetch | Fabric uses `HOME`/`PATH`; script writes need Convex URL; no transcript-provider key is currently configured | Fabric path requires `Bun.spawn`; existing Supadata/Tactiq path needs only outbound fetch | invalid/missing video ID, no captions, subprocess nonzero/empty output, third-party non-2xx or response-shape drift, language/consent restrictions |
| PDF | `ingest-robert-grant.ts` sends public PDF URLs through Jina; `smart-fetch.ts` explicitly declines direct PDF parsing | Jina needs no key; script writes need Convex URL | Plain fetch for public Jina-readable PDFs; uploaded/private files need binary download plus a PDF parser | Jina non-2xx/zero text, ResearchGate access block, scanned/image-only PDF, encrypted/corrupt PDF, parser memory/time limit, text too short |
| Notion | `fetch-notion-full-text.ts` sends a source's public `canonicalUrl` through Jina; Notion sync is a separate intake path | `NOTION_API_KEY` for private API access; Jina needs no key; script writes need Convex URL | Plain fetch for public pages; Notion API fetch for private pages | missing URL, private/login page, Jina non-2xx, ≤500 characters, rate limit, expired access |

The inventory remains script-based: `scripts/lib/` contains only essay parsing helpers, not a partial ingest-script migration. Existing source-level failures mostly collapse to `blockedReason: "no_text"`; exact provider details currently live in `blockedDetails` or console output.

## 3. Target architecture

### Common Source Intake contract

Each intake starts with an authenticated mutation or guarded HTTP route, not a fetch action. That boundary canonicalizes identifiers and calls `generateDedupeKey` from `convex/sourceUtils.ts` before creating or locating the source. URL/RSS use the canonical URL/feed GUID inputs, YouTube uses the extracted video ID, Notion uses the page ID, and PDF intake must hash the file before calling the PDF branch. No new intake path may construct a Dedupe Key locally.

After dedupe, the boundary creates a queued fetch job and starts a per-source durable workflow. Fetch actions return data but do not write it. A narrow internal mutation verifies the source/job pair, stores `rawText` or `transcript`, sets the source to `text_ready`, clears prior fetch-block fields, and records completion. A terminal failure records a structured job error and a blocked state. This keeps retries idempotent and prevents a late attempt from overwriting a newer job.

### Executor by source type

| Source type | Primary executor | Fallback | Decision |
|---|---|---|---|
| URL/RSS/Notion public URL | Convex action using Jina through plain `fetch` | direct HTML fetch for safe content types, then Kernel | Default path; it matches the proven scripts and requires no provider secret |
| Blocked URL | Convex action calling Kernel's HTTP API | worker-side Kernel adapter if the SDK/runtime requires Node | Use only after a classified access block; cap concurrency and always close sessions |
| YouTube | Worker-side Fabric job | bounded timedtext/direct-fetch experiment; Kernel only for a high-value manual retry | Fabric is the current subprocess-capable path and cannot run in the default Convex runtime |
| Public PDF URL | Convex action using Jina | PDF parser action for a downloaded binary | Promote only after size/content-type checks |
| Uploaded/private PDF | PDF parser action, or worker if runtime limits fail | OCR/manual review | No library is selected in this spike |

**Transcript recommendation:** use a worker-side Fabric adapter as the production path. The timedtext family is attractive because it is plain fetch, and the existing Supadata/Tactiq action proves the shape can run in Convex, but those unauthenticated/undocumented endpoints have response, availability, and language risk. Kernel adds browser latency and cost without improving caption availability enough to justify being the default. Implement timedtext or the existing provider chain as an instrumented experiment; retain it only if a representative corpus meets an agreed success rate. Kernel is a manual, high-value fallback.

For worker dispatch, do not overload `agentRuns`: project vocabulary defines an Agent Run as agent work, and that table carries graph, review-draft, and agent-audit semantics. Add a focused `fetchJobs` queue while reusing the `agentRuns` implementation contract for atomic claim, worker ID, heartbeat, events, terminal states, and stale sweeping. The existing worker can poll a second guarded claim endpoint and dispatch a transcript adapter without pretending the fetch is a LangGraph run. Shared status/error validators should be extracted when both tables exist so this becomes a second job domain, not a third lifecycle vocabulary.

### Structured blocked state

The build should use stable machine codes and human-safe details. Proposed terminal `blockedReason` values are:

- `invalid_source_url`
- `fetch_access_blocked`
- `fetch_timeout`
- `fetch_http_error`
- `no_text`
- `response_too_large`
- `transcript_unavailable`
- `pdf_parse_error`
- `provider_error`
- the existing domain reasons `copyright`, `needs_metadata`, `needs_human_review`, and `duplicate`

`fetchJobs.lastError` should additionally carry `{ code, message, retryable, httpStatus?, provider? }`; `blockedDetails` receives a safe summary, never raw provider bodies or secrets. Existing `no_text` rows remain valid and can be refined only when retried.

### PDF parser shortlist

No PDF package is a current dependency, so S5 must probe before choosing:

- `unpdf`: serverless-oriented API and buffer input; verify Convex bundling, memory, and text fidelity.
- `pdfjs-dist`: mature parser with broad format support; verify bundle size and worker configuration.
- `pdf-parse`: simple Node-facing API; reconsider only if a Node action/worker probe passes, because the unused dependency was deliberately removed.

The probe corpus must include text-native, large, encrypted/corrupt, and scanned PDFs. Image-only documents need a separate OCR decision rather than being reported as successful empty text.

### Spike verdict

The riskiest assumption is **supported for Jina-backed URL fetches at the code seam, but not yet proven in the deployed runtime**. The additive action uses the script's exact Jina URL form and `Accept`/`User-Agent` headers; pure tests cover URL validation, HTTP/empty/oversize response shaping, and failure classification. The scoped typecheck still reports the same 11 pre-existing `convex/ingest.ts` diagnostics and no new ones. Because deployment and the smoke call are operator-gated, outbound egress, TLS, latency, actual response size, and action-timeout headroom remain open. This is not a blanket finding that Convex can replace browser or subprocess scripts.

## 4. Durable orchestration

Define one workflow per source, modeled on `extractSourceWorkflow`:

1. Mark the fetch job `running` and record the attempt.
2. Run the selected fetch action with workflow retry enabled only for retryable failures.
3. Persist text and `text_ready`, or persist the structured blocked state.
4. On success, start/run extraction as the next durable step and store its workflow ID.
5. Complete the fetch job only after the text persistence step succeeds; extraction gets its own visible state rather than hiding both operations behind one flag.

Default retry policy: three attempts with exponential delay and jitter for network failures, timeouts, HTTP 408/429/5xx, and transient provider errors. Honor `Retry-After`. Do not automatically retry invalid URLs, HTTP 401/403/404, empty captions, copyright blocks, deterministic PDF parse errors, or oversized responses. Kernel gets at most two attempts because sessions are expensive. Every attempt must be idempotent against `(sourceId, job kind, input fingerprint)`.

Add a 15-minute stale sweep analogous to `sweep-stale-agent-runs`. Convex-executed jobs become stale when `updatedAt` has not moved beyond the executor-specific action deadline; worker jobs use explicit heartbeats. A stale job becomes `failed` with `worker_stale`, releases its claim, and exposes retry rather than silently remaining `running`.

This implements the roadmap musts "explicit retry and failure reporting" and "visible workflow status in the app" while preserving the workstream dependency on the durable workflow infrastructure already in `convex/workflows.ts`.

## 5. Workflow status surface

Proposed `fetchJobs` metadata (schema proposal only):

```text
sourceId, kind(url_text | youtube_transcript | pdf_text), executor,
status(queued | running | failed | completed | cancelled),
workflowId?, attemptCount, maxAttempts, inputFingerprint,
lastError?, nextAttemptAt?, workerId?, heartbeatAt?,
startedAt?, finishedAt?, createdAt, updatedAt
```

Indexes are needed for `(sourceId, updatedAt)`, `(status, updatedAt)`, and stale worker claims. Retrying is an event plus an incremented attempt count, not a separate long-lived status.

`/display` is the source-facing home: each inbox row shows its current fetch/extract phase, attempt count, last safe error, and a retry action. `/ingest` returns the source ID plus fetch job/workflow receipt immediately. `/admin` is the operational view for all jobs, provider/error filters, stale jobs, and cancellation. That split keeps source decisions in the inbox and system-wide intervention in admin.

The public mutation contract should be `retryFetchJob({ jobId, devBypassSecret? }) -> { jobId, workflowId, status: "queued" }`. It authenticates, accepts only failed retryable jobs, refuses when an equivalent job is active, clears only transient claim fields, and appends a retry event. A separate cancel contract can follow when cancellation semantics are proven. These surfaces satisfy the workstream musts to persist user-facing metadata, show per-source/per-batch states, and expose retry/cancel where appropriate.

## 6. Environment and secrets

| Runtime/path | Names read | Rule |
|---|---|---|
| Convex Jina URL/PDF action | none for Jina | Keep provider key-free unless Jina policy changes; never include secrets in jobs/errors |
| Convex Kernel action | `KERNEL_API_KEY` | Set only in the Convex deployment environment; prefer direct HTTP over bundling the SDK |
| Worker transcript/Kernel | `CONVEX_SITE_URL`, `AGENT_TOOL_SECRET`, `KERNEL_API_KEY` when used; `HOME` and `PATH` for Fabric | Worker claims through a guarded surface; do not persist any value |
| Guarded HTTP Source Intake | `INGEST_SHARED_SECRET` (legacy alias remains `N8N_INGEST_SECRET`) | Authenticate before dedupe or job creation |
| Local migration scripts retained during rollout | `CONVEX_URL`/`CONVEX_SELF_HOSTED_URL`, `AUTH_BYPASS_SECRET`, `NOTION_API_KEY`, `KERNEL_API_KEY` | Continue using Varlock/1Password; scripts remain fallback until each slice ships |

Supadata/Tactiq currently have no configured key; that is an observation, not a production availability guarantee. If a paid transcript provider is selected, add its canonical variable to `.env.schema` and deployment configuration in that build slice.

## 7. Build slices

1. **S1 — URL/RSS readable text (M):** add minimal fetch-job persistence, compose the tested Jina action into a per-source workflow, persist through an internal mutation, use `sourceUtils` for intake dedupe, and expose retry to the existing inbox action.
2. **S2 — Workflow operations surface (M):** add per-source status to `/display`, receipts to `/ingest`, and the filtered operational list to `/admin`; add stale sweeping and safe error events.
3. **S3 — Blocked-source Kernel fallback (M):** classify access blocks, call the Kernel HTTP API with bounded concurrency/session cleanup, and add cost-aware retry/fallback controls.
4. **S4 — YouTube transcript worker (M):** add a `fetchJobs` worker claim/heartbeat adapter for Fabric, measure a timedtext/direct-provider experiment, and keep Kernel manual-only.
5. **S5 — PDF extraction (M–L):** probe the shortlist, implement public-URL and uploaded-file paths with size/type checks, and route scanned documents to a clear OCR/manual blocked state.

Each slice must preserve the Phase A requirement that Source Intake reaches `text_ready` or an exact blocked state without pasted content. S1 precedes S2; S3–S5 depend on the shared S1 job/error contract but can then be carded independently.

## 8. Open questions

- Does the deployed self-hosted Convex runtime allow the Jina request with acceptable TLS, latency, payload size, and timeout headroom? Run the operator-gated smoke after deployment.
- What Jina rate, retention, and acceptable-use limits apply to automated article and PDF traffic?
- Is 100,000 characters the correct action-return/storage cap, or should actions persist chunks to storage without returning full text through workflow state?
- On a representative YouTube corpus, what success rate do timedtext and the existing Supadata/Tactiq chain achieve versus Fabric, including non-English and auto-generated captions?
- Should the existing `agentRuns` lifecycle helpers be generalized before `fetchJobs`, or copied once and unified in a follow-up?
- Which PDF candidate passes Convex bundle/memory limits, and where does OCR run?
- Should terminal fetch failures leave a source `ingested` with a block, or move it to `review_needed`? The inbox currently supports both but the build needs one invariant.
- Which error details may be shown to collaborators versus admins, and how long should fetch-attempt records be retained?

Pending operator smoke:

```bash
vpx convex run ingest:fetchUrlText '{"url": "https://en.wikipedia.org/wiki/Cymatics"}'
```
