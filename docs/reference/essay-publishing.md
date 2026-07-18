# Essay Publishing

This runbook covers the research essays published from `frequency-music` to the
Resonant Projects website. It intentionally does not cover the separate public
editorial / `/writing` export.

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

1. The official 1Password action resolves `OPENROUTER_API_KEY` using the
   existing `OP_SERVICE_ACCOUNT_TOKEN` GitHub Actions secret.
2. `scripts/generate-essay-metadata.ts` creates metadata only for new or
   content-changed essays.
3. `scripts/export-essays.ts` rebuilds the deterministic Astro export.
4. The workflow validates the manifest/file counts and commits changed
   metadata and export files back to `main`.
5. It calls the `resonant-projects` Vercel deploy hook, which rebuilds the
   latest `rproj-website/main` against the new export.

The workflow can also be run manually from GitHub Actions with
**Publish Essays -> Run workflow**. Manual dispatch is the recovery path for a
stale export or a failed prior run.

## Initial backlog recorded July 18, 2026

The automation was added after essay creation had outpaced publication:

- 312 source essays existed;
- 302 had current metadata;
- the checked-in public export contained 106 essays and had last been generated
  April 11, 2026;
- the `resonant-projects` production deployment dated from May 6, 2026.

The ten essays missing metadata were:

```text
perceptual-resolution
pitch-is-a-negotiation
the-access-layer
the-basis-is-an-intervention
the-evaluator-in-the-room
the-judge-has-a-lineage
the-proxy-that-listens
the-survival-test
the-three-question-listener
the-voice-vector
```

The setup run generated the ten missing entries and rebuilt a 312-item export
in the working tree. Once those files reach `main`, a manual **Publish Essays**
run should trigger a current website build. Keep this snapshot as a diagnostic
baseline; do not update the numbers after the backlog is cleared.

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
vp install --frozen-lockfile
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
essay commit did not trigger it. A successful run ends by triggering the
website deployment even when the export was already current.

## Verification

The workflow should report all of the following:

- metadata generation completed with zero failures;
- the exporter skipped zero non-draft essays;
- the manifest item count equals the number of exported Markdown files;
- the export commit reached `frequency-music/main` when files changed;
- the Vercel deploy-hook request succeeded.

Then check:

1. The newest item in `exports/blog/manifest.json` has the expected slug and
   publish date.
2. The latest `resonant-projects` production deployment is `Ready`.
3. `/blog` lists the essay.
4. `/blog/<essay-slug>` returns the complete essay.
5. The homepage latest-post section and `/rss.xml` include it when expected.

## Failure modes

### Metadata generation fails

Confirm `OP_SERVICE_ACCOUNT_TOKEN` is present and can read the OpenRouter item
referenced by the workflow and `.env.schema`. Re-run the workflow. The generator
is incremental, so already-current entries are not regenerated. Locally, run
through `op read` as shown above; an unresolved `op(...)` reference is rejected
before any API calls are made.

### Export reports missing metadata

Run `vp run essays:metadata`, review the generated entries, and then run
`vp run essays:export`. The exporter deliberately exits nonzero rather than
silently omitting a public essay.

### Workflow cannot push its export commit

Confirm the workflow still declares `permissions: contents: write` and that
the default-branch rules allow fast-forward GitHub Actions commits. Re-run
after any concurrent push to `main` has settled.

### Website deployment is not triggered

Confirm the deploy-hook secret exists. If the hook was revoked, create a new
one, replace the GitHub secret, and manually dispatch **Publish Essays**. Do not
commit or print the hook URL.

### Deployment succeeds but the site is stale

Confirm the deployment built `rproj-website/main`, not an older local checkout
or preview branch. The website loader consumes GitHub Raw during the build, so
redeploying the current production build is required after the export changes.
