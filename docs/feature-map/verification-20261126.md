# Verification follow-up, 2026-11-26

This follow-up covers the four items that the [2026-11-24 upkeep](gaps.md#upkeep-2026-11-24) ([#269](https://github.com/Resonant-Projects/frequency-music/pull/269)) left unverified. Base is `342f79c0` (main after #269). Two of the four items needed a read-only production query, and Keith approved both before they ran. Nothing was written to production, and nothing was deployed.

| Item | Feature | Result |
|---|---|---|
| Browser-pool listen path | M06 / [#260](https://github.com/Resonant-Projects/frequency-music/pull/260) | **Verified in CI.** Six green `push` runs on main, each 3/3 through the pool. |
| Scout census on real data | R06 / [#264](https://github.com/Resonant-Projects/frequency-music/pull/264) | **Not live.** Production still returns the pre-#264 census. |
| Live LangSmith trace link | O01 / [#261](https://github.com/Resonant-Projects/frequency-music/pull/261) | **API-verified.** Production worker URLs use the new form, and every id in them resolves. |
| FORBIDDEN surfacing | A01 / O05 / G15 / [#258](https://github.com/Resonant-Projects/frequency-music/issues/258) | **Observed locally.** Every control shows an inline alert, and nothing persists. On /ingest, the Ingest URL alert renders off screen. |

## 1. Browser-pool path for the listen fixtures (M06)

```sh
gh run list --workflow browser-pool-pilot.yml --limit 30 \
  --json databaseId,event,headBranch,headSha,conclusion,createdAt
gh run view <id> --log   # grep Runner name / pool endpoint / Running / passed
```

Every `push` run on main since #260 merged (2026-11-18T16:43Z) ran job *Listen suite through the browser pool (pilot)* on the `frequency-arc` runner. In each run's log, `PLAYWRIGHT_BROWSER_POOL_WS_ENDPOINT` is `ws://moon.browser-pool:4444/playwright/chromium?arg=--host-resolver-rules%3DMAP%20localhost%20<pod IP>`, and the line `Running 3 tests using 1 worker` is followed by `3 passed`.

| Run | Head | Runner | Result |
|---|---|---|---|
| 44350554532 | `998a83a7` (#260) | frequency-arc-runner-sqjvd | 3 passed (6.2s) |
| 44352291484 | `f8718c6b` (#259) | frequency-arc-runner-8w8tr | 3 passed (12.3s) |
| 44550006469 | `efc12b39` (#261) | frequency-arc-runner-92hf2 | 3 passed (4.7s) |
| 45200793594 | `1f0abd34` (#262) | frequency-arc-runner-hf2x5 | 3 passed (6.2s) |
| 45220883015 | `5384c590` (#223) | frequency-arc-runner-fgzjn | 3 passed (5.8s) |
| 45236983912 | `170bcfc2` (#267) | frequency-arc-runner-xhcwx | 3 passed (6.6s) |

- **Cancelled runs:** four `push` runs (45220818302, 45220751321, 45220703071, 45200736235) were cancelled when a later merge superseded them under `cancel-in-progress`.
- **Failed PR run:** one `pull_request` run failed, 44677693162 on `renovate/vite-plus` (2026-11-20). Its web server would not start because of a `vite-plus-core` version mismatch in that Renovate branch. It is not a pool failure.
- **No dispatch needed:** green main runs already existed, so I didn't trigger one.

This is CI evidence only. Local fixture runs keep the endpoint unset.

## 2. Scout census on real data (R06)

This was one read-only query, approved by Keith, run at 2026-11-26T02:00:48Z. `correspondences:scoutTargets` takes no arguments and has no auth check, so no credential was used.

```sh
curl -sS -X POST https://convex.resonantprojects.art/api/query \
  -H 'Content-Type: application/json' \
  -d '{"path":"correspondences:scoutTargets","args":{},"format":"json"}'
```

The query returned HTTP 200, `status: success`:

| Domain | Sector | On-mission concepts | Sources |
|---|---|---|---|
| biofield | music | 1 | 0 |
| production | synthesis | 4 | 0 |
| geometry | geometry | 5 | 2 |
| mathematics | math | 5 | 4 |
| acoustics | wave | 3 | 6 |

`starvedConjectures` is `[]`.

This matches the **Before** column of #264 row for row. `biofield` is in `SCOUT_EXCLUDED_DOMAINS` on main (`convex/shared/researchTopics.ts`) and cannot be returned by the merged census. So the live deployment is still running pre-#264 functions.

Convex deploys are manual: no workflow deploys on merge, and `convex-provenance.yml` only prepares an artifact. The source-scout runs on 2026-11-25 therefore used the old census.

**Remaining step:** an operator deploys main to the Convex deployment, then repeats the query above. The expected result is no `biofield`, and synthesis pooled per sector (about 13 Sources / 9 concepts on the fixture-shaped data).

## 3. Live LangSmith trace link (O01)

This was a read-only query, approved by Keith. `agentRuns:listRecentPublic` is an ungated public query.

```sh
curl -sS -X POST https://convex.resonantprojects.art/api/query \
  -H 'Content-Type: application/json' \
  -d '{"path":"agentRuns:listRecentPublic","args":{"limit":50},"format":"json"}'
```

Runs created on or after 2026-11-24 carry the #261 form: `https://smith.langchain.com/o/<org>/projects/p/<project>/trace/<trace>/run/<run>`. Runs from 2026-11-18 and earlier carry the old `/r/<id>?trace_id=…` form, so the worker picked up #261 between those dates.

I checked both new-form URLs against the LangSmith REST API. The key came from `op://Homelab Runtime/langsmith-api-key/credential` through `vpx varlock run` at the repo root, and was never printed. `agent/.env.schema` failed to resolve unrelated items, so it couldn't be used.

| Check | HTTP | Matches URL |
|---|---|---|
| `GET /api/v1/runs/01a2136f-bc8e-…` (source-scout, 2026-11-25) | 200 | id = trace_id = run segment; `session_id` = project `139f5a1c-…`; status `success` |
| `GET /api/v1/runs/01a20bed-23c1-…` (correspondence-miner, 2026-11-24) | 200 | same checks |
| `GET /api/v1/sessions/139f5a1c-…` | 200 | name `frequency-music-agents`; `tenant_id` = org `fbde542e-…` |

Every path segment resolves to a real, consistent record. Opening a link in a browser needs a LangSmith login, so one click by Keith is the remaining visual check.

Of the 22 runs since #261 merged, only 2 carry a `traceUrl`. One source-scout run at 16:00 had a link, while two operator runs at 16:04 and 16:07 did not. Before calling that a defect, check which `markCompleted` callers pass a trace URL.

## 4. How FORBIDDEN surfaces for a non-writer (A01 / O05 / G15)

This used only the throwaway local Convex, with the `--role` option from [#270](https://github.com/Resonant-Projects/frequency-music/pull/270). App code is unchanged.

```sh
(cd web && vp exec playwright install chromium && vp run codegen)
python3 scripts/local-convex/control.py run forbidden-none-04 --role none          # exit 0, 5/5
python3 scripts/local-convex/control.py run forbidden-follower-04 --role follower  # exit 0, 5/5
python3 scripts/local-convex/control.py run admin-control-02                       # exit 0, 4/4 journeys
python3 scripts/local-convex/test_control.py                                       # 22 OK
```

- **`none`:** the identity is a well-formed users id whose row was deleted, so the user is signed in with no `users` row.
- **`follower`:** the identity has a `follower` row.
- **Probe:** each probe clicks one control at 1280×720. It matches the Convex write that the click sent, by `requestId`, to its response. It then hashes every application table before and after.

Both roles gave identical results:

| Control (route) | Write sent | Backend | What the user sees | In viewport | Rows changed |
|---|---|---|---|---|---|
| Ingest URL (/ingest) | `sources:createFromUrlAndQueue` | FORBIDDEN | Red alert in the page-header card: "URL ingest failed: You do not have access to this." | **No** | none |
| Add Feed (/ingest) | `admin:createFeed` | FORBIDDEN | "Feed creation failed: You do not have access to this." | yes | none |
| Poll Feeds Now (/ingest) | `admin:pollFeedsNow` | FORBIDDEN | "Feed poll failed: You do not have access to this." | yes | none |
| Create Hypothesis (/hypotheses) | `hypotheses:create` | FORBIDDEN | Inline alert beside the button: "Failed to create hypothesis: You do not have access to this." | yes | none |
| Queue Batch Extraction (/admin) | `workflows:startBatchExtraction` | FORBIDDEN | "Batch extraction failed: You do not have access to this." | yes | none |

- **Other signals:** no page errors and no toast. Each refusal also logs one `console.error` with the raw ConvexError.
- **Enabled controls:** every button stays enabled, and /admin renders in full. The refusal shows up only after a submit, which matches G15.
- **Bug (UX):** on /ingest, the page's single notice lives in the header card. After Playwright scrolls to Ingest URL and clicks it, the alert sits above the viewport. The user sees no feedback near the button, and the form keeps its values.
  - Repro: start a role run, open /ingest, fill Source URL and Title, click **Ingest URL**, and don't scroll.
  - The same notice placement applies to success messages and other errors on that page, not only FORBIDDEN.

Screenshots (viewport, as seen right after the click) and the raw observation JSON are in [`docs/evidence/forbidden-surfacing-20261126/`](../evidence/forbidden-surfacing-20261126/). They include `forbidden-none-ingest-url.png`, which shows no visible feedback, and `forbidden-none-create-hypothesis.png`, which shows the inline alert.

## Gates

- `APP_ENV=test vp run verify` on the docs branch: see the PR body for the exit code and counts.
- codex-first review: run on #270 and on this branch.
