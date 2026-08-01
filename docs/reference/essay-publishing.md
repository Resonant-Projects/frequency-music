# Essay Publishing

This runbook covers the research essays published from `frequency-music` to the
Resonant Projects website.

## Relationship to the editorial export

Two publishing routes exist and they are deliberately kept separate:

| | **Publish Essays** (this doc) | **Public Editorial Export** |
|---|---|---|
| Workflow | `.github/workflows/publish-essays.yml` | `.github/workflows/public-editorial-export.yml` |
| Trigger | automatic on `docs/essays/*.md` push to `main`, plus manual | manual only (`workflow_dispatch`) |
| Source | static Markdown in `docs/essays/` | Convex evidence-card data |
| Output | `exports/blog/` committed to `main` | orphan `editorial-export` branch |
| Consumer | `rproj-website` Astro build → `/blog` | the `/writing` editorial surface |

They share no scripts and no output paths. Changing one does not affect the
other. Do not merge them: the essay corpus is a static-Markdown route that
bypasses the `editorialArtifacts` review pipeline by design.

## Publishing path

```text
docs/essays/*.md
  -> docs/essays/metadata.json
  -> exports/blog/manifest.json + exports/blog/essays/*.md
  -> GitHub Raw on frequency-music/main
  -> rproj-website Astro content loader
  -> Vercel project resonant-projects
  -> https://www.resonantprojects.art/blog
```

`rproj-website` reads the checked-in export from `frequency-music/main` during
its Astro build. Updating an essay does not update the public site until both
the export is committed and the website is rebuilt.

## Normal automated flow

`.github/workflows/publish-essays.yml` runs when a top-level
`docs/essays/*.md` file changes on `main`.

1. The generate step runs with `APP_ENV=ci` and `OP_SERVICE_ACCOUNT_TOKEN`, so
   `varlock/auto-load` resolves `OPENROUTER_API_KEY` (and the rest of
   `.env.schema`) through the 1Password service account. `APP_ENV=ci` is
   required: the schema commits `APP_ENV=dev` and only permits desktop-app auth
   in `dev`, which cannot work on a headless runner.
2. `scripts/generate-essay-metadata.ts` creates metadata only for new or
   content-changed essays.
3. `scripts/export-essays.ts` rebuilds the deterministic Astro export.
4. The workflow validates the manifest/file counts and commits changed
   metadata and export files back to `main`.
5. **When the commit step changed something**, it calls the
   `resonant-projects` Vercel deploy hook, which rebuilds the latest
   `rproj-website/main` against the new export. A run that finds the export
   already current stops before the deploy hook rather than spending a
   production build on a no-op.

The workflow can also be run manually from GitHub Actions with
**Publish Essays -> Run workflow**. Manual dispatch is the recovery path for a
stale export or a failed prior run.

### Why this cannot loop

The push trigger filters on `docs/essays/*.md`. The workflow's own commit only
touches `docs/essays/metadata.json` and `exports/blog/`. Neither path matches
the filter, so the bot's push cannot re-trigger the workflow. Keep that
invariant in mind before widening the `paths:` list — adding `docs/essays/**`
or `exports/**` would create an infinite run loop.

## Backlog snapshot, August 1, 2026

The automation exists because essay creation has badly outpaced publication.
Measured on `main` at the time this landed:

- **347** source essays in `docs/essays/`;
- **318** had current metadata (29 missing);
- the checked-in public export contained **106** essays;
- that export was last generated **April 11, 2026**.

So the public site trails the corpus by roughly 241 essays. The first
**Publish Essays** run after this lands will therefore be large: expect it to
generate 29 metadata entries and rewrite the export from 106 to ~347 items.
Budget for the OpenRouter spend of 29 generations and review that first commit
carefully rather than treating it as routine.

The equivalent snapshot taken July 18, 2026 recorded 312 source essays, 302
with metadata, and the same stale 106-item April export — the gap is widening,
not holding steady.

## Required configuration

The `frequency-music` GitHub repository needs these Actions secrets:

- `OP_SERVICE_ACCOUNT_TOKEN`: existing 1Password service-account token.
- `RPROJ_VERCEL_DEPLOY_HOOK_URL`: Vercel deploy hook for the
  `resonant-projects` project and `main` branch.

Create or rotate the deploy hook in Vercel:

1. Open **resonant-projects -> Settings -> Git -> Deploy Hooks**.
2. Create one hook named `Frequency essay exports` for branch `main`.
3. Store the generated URL as the `RPROJ_VERCEL_DEPLOY_HOOK_URL` Actions secret
   in `Resonant-Projects/frequency-music`.
4. Never paste the hook URL into a workflow, issue, log, or committed file. The
   URL is a credential; revoke and recreate it if exposed.

## Manual publishing and recovery

From `frequency-music`:

```bash
bun install --frozen-lockfile
OPENROUTER_API_KEY="$(op read 'op://Country Manor Lab/OpenRouter API Key - Frequency Music/credential')" \
  vp run essays:publish
jq '.items | length' exports/blog/manifest.json
git status --short
```

Review new entries in `docs/essays/metadata.json`, especially excerpts, tags,
and categories. Then commit these paths together:

```text
docs/essays/metadata.json
exports/blog/manifest.json
exports/blog/essays/
```

After the commit reaches `main`, manually run **Publish Essays** if the source
essay commit did not trigger it.

## Verification

The workflow should report all of the following:

- metadata generation completed with zero failures;
- the exporter skipped zero non-draft essays;
- the manifest item count equals the number of exported Markdown files;
- the export commit reached `frequency-music/main` when files changed;
- the Vercel deploy-hook request succeeded, or was correctly skipped because
  nothing changed.

Then check:

1. The newest item in `exports/blog/manifest.json` has the expected slug and
   publish date.
2. The latest `resonant-projects` production deployment is `Ready`.
3. `/blog` lists the essay.
4. `/blog/<essay-slug>` returns the complete essay.
5. The homepage latest-post section and `/rss.xml` include it when expected.

## Failure modes

### Metadata generation fails

Confirm `OP_SERVICE_ACCOUNT_TOKEN` is present and that the step still sets
`APP_ENV=ci`. Because `varlock/auto-load` resolves the **whole** schema, the
service account needs read access to every `op()` item in `.env.schema`, not
just the OpenRouter one — a newly added secret the account cannot read will
fail this step even though it is unrelated to essays. Re-run the workflow; the
generator is incremental, so already-current entries are not regenerated.
Locally, run through `op read` as shown above; an unresolved `op(...)` or
`op://` reference is rejected before any API calls are made.

### Export reports missing metadata

Run `vp run essays:metadata`, review the generated entries, and then run
`vp run essays:export`. The exporter deliberately exits nonzero rather than
silently omitting a public essay.

### Workflow cannot push its export commit

The commit step rebases onto the latest `main` and retries up to three times, so
an ordinary concurrent push no longer fails the run — generation takes minutes
and `main` moves under it regularly. A failure here means one of:

- **Rebase conflict.** Someone hand-edited `docs/essays/metadata.json` or a file
  under `exports/blog`. Those are generated; reconcile by re-running
  `vp run essays:publish` locally rather than resolving the conflict by hand.
- **Still rejected after three attempts.** `main` is taking sustained concurrent
  writes. Re-run once it settles.
- **Permissions.** Confirm the workflow still declares
  `permissions: contents: write`. If `main` gains branch protection requiring
  reviews, this step cannot push at all and the workflow would need to open a PR
  instead.

### Website deployment is not triggered

First confirm the export actually changed — an unchanged export skips the hook
by design. If it did change, confirm the deploy-hook secret exists. If the hook
was revoked, create a new one, replace the GitHub secret, and manually dispatch
**Publish Essays**. Do not commit or print the hook URL.

### Deployment succeeds but the site is stale

Confirm the deployment built `rproj-website/main`, not an older local checkout
or preview branch. The website loader consumes GitHub Raw during the build, so
redeploying the current production build is required after the export changes.
