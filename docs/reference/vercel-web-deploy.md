# Vercel Deployment (web/)

The `frequency-music` Vercel project deploys the SolidJS app in `web/`.

- **Project:** `frequency-music` (owner `rproj`, Resonant Projects; verified October 5, 2026)
- **Root Directory:** `web`
- **Framework preset:** Vite
- **Install / Build:** defaults — `bun install` then `bun run build`, run **inside `web/`**

## SPA route fallback

The Solid app uses client-side routing, so requests for routes such as
`/essays` and `/recipes/:recipeId` must serve `index.html` and let the router
resolve the page. `web/vercel.json` defines the catch-all rewrite; without it,
direct navigation and browser refreshes return Vercel's 404 even though
in-app navigation works.

## Listen page RSS proxy

The signed-in Listen page obtains its private feed address from the existing
`podcast.subscription` query. It fetches that address's path from the web
origin; the first rewrite in `web/vercel.json` forwards
`/podcast/:token/feed.xml` to `https://listen.rproj.art`. Keep this rewrite
before the SPA fallback so the browser receives RSS rather than `index.html`.
The Vite development server has a matching proxy.

The page parses episode titles, publication dates, durations and enclosure
URLs from RSS, refreshes each minute while visible and when visibility returns,
and offers manual refresh. Unchanged episode rows retain their audio players
so refreshing does not interrupt playback. Feed failures keep the last loaded
episodes and offer retry. The feed token stays in the authenticated subscription
flow and is never embedded in source or logs. This change needs only a web
release; it adds no backend function or schema.

For a manual Vercel deployment, upload an isolated tree of tracked source and
reviewed changes. Do not upload the operator worktree's ignored `out/` evidence,
audio masters, `.env.local`, or local preview harness. Vercel CLI's upload
selection can include `out/` despite Git ignoring it. Link the existing
`rproj/frequency-music` project and deploy the repository root so `web/` can
still import the generated Convex client and repository essays.

## The `convex/server` resolution gotcha

The web app imports the repo-root generated Convex client, e.g.:

```ts
import { api } from "../../../convex/_generated/api";
```

That root file (`convex/_generated/api.js`) contains:

```js
import { anyApi, componentsGeneric } from "convex/server";
```

Because Vercel's Root Directory is `web`, it only installs `web/node_modules`.
It never runs `bun install` at the repo root, so `/vercel/path0/node_modules`
does not exist. Rolldown (via `vite-plus`) resolves the bare `convex/server`
import **from the importing file's location** — the repo-root `convex/` dir —
walks up to `/vercel/path0/node_modules`, finds nothing, and fails:

```
Error: [vite+]: Rolldown failed to resolve import "convex/server"
from "/vercel/path0/convex/_generated/api.js"
```

This builds fine locally only because a root `node_modules/convex` happens to
exist there.

## The fix

`web/vite.config.ts` sets:

```ts
resolve: { dedupe: ["convex"] },
```

`dedupe` forces every bare `convex` import — even from the out-of-tree root
generated file — to resolve to `web/node_modules/convex`, which Vercel always
installs. No root install step is required.

To reproduce the failure locally: `mv node_modules/convex node_modules/.hidden`,
run `cd web && vp run build` (fails), then restore. With the `dedupe` fix the
build passes even while the root copy is hidden.
