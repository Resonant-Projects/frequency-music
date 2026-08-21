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
| Consumer | `rproj-website` SSR/ISR blog routes | the `/writing` editorial surface |

They share no scripts and no output paths. Changing one does not affect the
other. Do not merge them: the essay corpus is a static-Markdown route that
bypasses the `editorialArtifacts` review pipeline by design.

## Publishing path

```text
docs/essays/*.md
  -> docs/essays/metadata.json
  -> exports/blog/manifest.json + exports/blog/essays/*.md
  -> GitHub Raw on frequency-music/main
  -> rproj-website request-time loader
  -> Vercel SSR + ISR
  -> https://www.resonantprojects.art/blog
```

`rproj-website` reads the checked-in export from `frequency-music/main` at
request time. Its blog pages use one-hour Vercel ISR, so the publishing
workflow calls the website's authenticated revalidation endpoint after it
commits a changed export rather than rebuilding the website at the same Git
SHA.

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
5. **When the commit step changed something**, it calls
   `https://www.resonantprojects.art/api/revalidate`. That authenticated route
   expires `/`, `/writing`, `/blog`, and `/rss.xml` so their next requests read
   the new export. A run that finds the export already current skips
   revalidation.

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
- `RPROJ_ISR_BYPASS_TOKEN`: the same value as `ISR_BYPASS_TOKEN` in the
  `resonant-projects` Vercel project. The website uses it to authorize the
  revalidation request and Vercel uses it internally to expire ISR pages.
- `RPROJ_VERCEL_AUTOMATION_BYPASS_SECRET`: a Vercel Protection Bypass for
  Automation secret for `resonant-projects`. It lets the workflow reach the
  API route without being stopped by Vercel's browser security challenge.

Create or rotate the automation credentials in Vercel:

1. Set `ISR_BYPASS_TOKEN` for the `resonant-projects` production environment
   and store the same value as the `RPROJ_ISR_BYPASS_TOKEN` Actions secret in
   `Resonant-Projects/frequency-music`.
2. Open **resonant-projects -> Settings -> Deployment Protection -> Protection
   Bypass for Automation** and create a secret named `Frequency essay exports`.
3. Store that value as the `RPROJ_VERCEL_AUTOMATION_BYPASS_SECRET` Actions
   secret in `Resonant-Projects/frequency-music`.
4. Redeploy `rproj-website` after adding or rotating either Vercel-side value.
5. Never paste either credential into a workflow, issue, log, or committed
   file. Revoke and recreate a credential if it is exposed.

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
- the website ISR revalidation request succeeded, or was correctly skipped
  because nothing changed.

Then check:

1. The newest item in `exports/blog/manifest.json` has the expected slug and
   publish date.
2. The revalidation response reports success for `/`, `/writing`, `/blog`, and
   `/rss.xml`.
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

### Website ISR is not revalidated

First confirm the export actually changed — an unchanged export skips
revalidation by design. If it did change, confirm both revalidation secrets
exist and still match the values configured for the `resonant-projects`
project. A 401 points to `RPROJ_ISR_BYPASS_TOKEN`; a Vercel security checkpoint
or 429 points to `RPROJ_VERCEL_AUTOMATION_BYPASS_SECRET`. Replace the affected
secret and manually dispatch **Publish Essays**. Do not commit or print either
value.

### Revalidation succeeds but the site is stale

Inspect the revalidation response in the workflow log and confirm all four
paths returned successful statuses. If revalidation succeeded, allow for
GitHub Raw propagation and request the stale route again. The site also expires
ISR entries automatically after one hour, so a transient revalidation failure
does not require a production rebuild.
