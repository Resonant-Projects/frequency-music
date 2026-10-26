# Agent image release

The production Frequency worker consumes a prebuilt OCI image from
`registry.rproj.art/frequency-music/frequency-music-agent`. The agent release
workflow publishes only to Harbor. The media workflow continues to publish to
GHCR for its live consumer; existing GHCR packages are retained.

## Build and publication gates

`.github/workflows/publish-agent-image.yml` runs the same artifact build on pull
requests and releases. GitHub-hosted runners build once, with BuildKit provenance
`mode=max` and SBOM enabled, and export an OCI archive without pushing anywhere.
The build records the index digest from the archive's single root descriptor.
Skopeo loads its linux/amd64 image into Docker for the hardened runtime smoke
test, and Trivy scans the same archive with `--input`. Trivy blocks all HIGH and
CRITICAL findings, including unfixed vulnerabilities. `bun audit --prod` remains
a separate production dependency gate. The OCI archive and coordinate manifest
are uploaded as an Actions artifact with three-day retention.

Only a run from `main` can enter the protected `harbor-publish` environment.
Manual dispatch requires a full `source_ref` commit SHA already on main. The
LAN-only, self-hosted GARM runner downloads the exact artifact and pushes its
BuildKit index to Harbor. Crane reads the extracted OCI layout's single index
descriptor; `--index` would publish the outer layout catalog instead. The pushed
index digest must equal the digest recorded by the build.

Harbor tags use `sha-<full-commit>-<first 12 hex of the digest>` and are immutable:
a retry accepts the existing identical digest and refuses a conflicting tag.
The manifest digest remains the deployment boundary; never deploy a tag alone.

The Harbor job attaches GitHub build-provenance attestation to the Harbor subject
with `push-to-registry: true`, signs recursively with cosign, and verifies both
the index and linux/amd64 manifest with identity
`https://github.com/Resonant-Projects/frequency-music/.github/workflows/publish-agent-image.yml@refs/heads/main`
and issuer `https://token.actions.githubusercontent.com`. It waits for Harbor's
vulnerability scan, records its summary, proves anonymous manifest access for
both signed digests, and uploads `harbor-deployment.json` with the exact `deploy`
reference. Harbor scan findings are recorded; the blocking HIGH/CRITICAL gate is
Trivy. The `harbor-publish` environment retains its existing main-only protection
and `HARBOR_PUBLISH_ROBOT_SECRET` for `robot$frequency-music-publisher`.

## Infrastructure promotion PR

After all Harbor gates succeed, the main-only `deploy-pr` job opens or updates
one PR in `keithce/homelab-infra`, on `deploy/frequency-worker-agent`. It updates
exactly three agent pins in `kubernetes/infra/frequency-worker/deployment.yaml`
and one in `hosts/frequency-process-monitor/check.cjs`, failing if either count
changes. `kubernetes/apps/frequency-worker.yaml` only declares the Argo Application.

For an existing branch, the job checks it out, merges current infrastructure main
into it, commits the digest updates, and pushes normally. A conflict or concurrent
non-fast-forward update fails for review. It never rewrites branch history,
force-pushes, deletes branches, pushes main, or merges a PR. The PR body includes
the Harbor reference, source commit and run links, the Trivy gate summary, the
actual Harbor scan summary, and the verified cosign identity and issuer.

### One-time operator setup

1. Create a dedicated GitHub App with repository Contents **read and write** and
   Pull requests **read and write**. GitHub also grants required Metadata read.
   No other repository permissions, organization permissions, or webhook
   subscriptions are needed for this workflow.
2. Install the App on the `keithce` account, choosing **Only select repositories**
   and selecting **homelab-infra only**. Generate a private key and record the
   App ID. A PAT is neither required nor supported.
3. In **Resonant-Projects/frequency-music**, create the Actions environment
   `homelab-deploy-pr` and restrict deployment branches to **main only**. Add
   environment secrets `HOMELAB_DEPLOY_APP_ID` (the App ID) and
   `HOMELAB_DEPLOY_APP_PRIVATE_KEY` (the complete PEM private key). Apply the
   desired human environment approval policy. This separate environment keeps
   infrastructure-write credentials separate from the Harbor robot credential.
4. Keep `harbor-publish` restricted to main and its existing robot secret and
   runner access intact. The App token is minted for `keithce/homelab-infra`
   only, requesting just Contents write and Pull requests write.

PR CI exercises the OCI build, smoke test, dependency audit, and Trivy scan. It
cannot exercise Harbor network access, publication, OIDC signing/attestation,
Harbor scanning, anonymous access, environment secrets, or creation of the
infrastructure PR: those jobs are main-only. A successful main run is required
to establish those release and promotion results.
