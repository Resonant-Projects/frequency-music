# Access and discovery

[Feature map](../feature-map.md) · [Evidence](../evidence/feature-map-20261022/README.md) · [Gap classifications](gaps.md)

Snapshot: `a9b728466f9254938e40761e012451b4d896825b`, 2026-10-22. Backend descriptions below are source findings; only the named evidence establishes execution. Happy paths are acceptance recipes, not claims that every path ran. All rows are covered by the audit PR linked in the parent map; “—” means no gap identified within the stated boundary.

Current selected-row checkpoint: [V26, 2026-10-26](../evidence/effect-verification-20261026/README.md), source `ca495094`, [PR #229](https://github.com/Resonant-Projects/frequency-music/pull/229). It adds fresh local proof without completing unexercised stages. The table below retains its dated baseline except where V26 is named.

| Feature / stage intent | Backend status | UI exposure / entry point | Happy path | Edge cases | How to verify / evidence | Status | Next step / gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="a01"></a>**A01 — Authentication and authorization** | Clerk provider, JWT adapter, `auth.ts`; `users` and visibility contracts. | All routes under AuthGate; hosted sign-in/sign-out. | Sign in → Convex token; signed out → return URL. | SDK load failure, anonymous access, human versus service identity, private rows. | U3 (4 fixture tests), V; hosted identity and database authorization together unexercised. | **partial** | G05 |
| <a id="a02"></a>**A02 — Grouped navigation and route reachability** | 28 registered routes; shared menu and keyboard controls. | Home + Research/Compose/Library/Operations; mobile menu. | Open group → choose Essays → URL changes and menu closes. | Escape/focus, phone menu; Docket target assertions now pass in V26. | N1: nine guarded navigation actions and two affected Playwright tests pass in #200. Menu targets are proved; backend destination workflows remain partial. | **partial** | G01 |
| <a id="a03"></a>**A03 — Site search: pages, essays, concepts, research** | Local page/essay search; `graph.searchConcepts`, `dashboard.pipelineItems`, compositions. | Search button, Ctrl+K, Meta+K on app shell. | Type → matching page/essay → open detail. Research requires backend results. | Selection reset, dismissal, pending research versus no results; permissions. | B1/B3 prove local subset only (25/9 actions); no live research proof. | **partial** | G05 |
| <a id="a04"></a>**A04 — Essay archive and reading** | 413 committed Markdown essays; Vite index and lazy bodies; no backend data required. | Library → Essays; /essays; /essays/$essaySlug; related/search cards. | Archive → latest/archive/revealed/related essay → body → reload/back. | Show more focus, desktop/mobile entry, unknown slug, stale body. | V26: 25 actions, zero page errors/external requests, inspected archive/body PNGs and clean teardown. | **done** | — |

Follow-up L1–L4/N1/A1 evidence is scoped to the linked unmerged PR branches; [commands and output](../evidence/feature-map-gap-fixes-20261022/README.md). Source-anchor work links below retain the original audit references; current fixes and decision issues are in the parent map and gap ledger.

## Source anchors and linked work

| Feature | Current code / documented intent | Linked implementation PR or issue |
| --- | --- | --- |
| A01 | [web/src/components/auth-gate.tsx](../../web/src/components/auth-gate.tsx); [web/src/integrations/clerk/provider.tsx](../../web/src/integrations/clerk/provider.tsx); [convex/auth.ts](../../convex/auth.ts) | commit `9a9720c6` (auth integration) |
| A02 | [web/src/router.tsx](../../web/src/router.tsx); [web/src/lib/app-navigation.ts](../../web/src/lib/app-navigation.ts); [web/src/components/app-navigation.tsx](../../web/src/components/app-navigation.tsx) | — (audit PR in parent map; no new issue opened) |
| A03 | [web/src/components/site-search.tsx](../../web/src/components/site-search.tsx); [web/src/components/site-search-results.tsx](../../web/src/components/site-search-results.tsx) | — (audit PR in parent map; no new issue opened) |
| A04 | [web/src/routes/essays.tsx](../../web/src/routes/essays.tsx); [web/src/routes/essay-detail.tsx](../../web/src/routes/essay-detail.tsx); [web/src/lib/essays.ts](../../web/src/lib/essays.ts); [web/vite.config.ts](../../web/vite.config.ts) | — (audit PR in parent map; no new issue opened) |
