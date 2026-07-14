# Vercel Deployment (web/)

The `frequency-music` Vercel project deploys the SolidJS app in `web/`.

- **Project:** `frequency-music` (org `keithces-projects-5000a883`)
- **Root Directory:** `web`
- **Framework preset:** Vite
- **Install / Build:** defaults — `bun install` then `bun run build`, run **inside `web/`**

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
