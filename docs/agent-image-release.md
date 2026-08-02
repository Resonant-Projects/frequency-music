# Agent image release

The production Frequency worker consumes a prebuilt OCI image. The source repository
builds it on GitHub-hosted runners; the Proxmox LXC is a runtime, not a builder.

`.github/workflows/publish-agent-image.yml` is the release boundary:

- pull requests build and scan without publishing;
- a relevant `main` change publishes
  `ghcr.io/resonant-projects/frequency-music-agent:sha-<full-commit>`;
- manual dispatch accepts an exact `source_ref`, which supports an artifact-only
  migration of an already-deployed commit;
- the pinned, multi-stage image uses a minimal Node Alpine runtime, contains
  production dependencies only, retains neither Bun, npm, peer-only compiler
  tooling, nor development dependencies, and must pass a runtime-tooling smoke test;
- `bun audit --prod` must report no vulnerable production packages;
- the pushed image carries BuildKit SBOM and provenance attestations;
- Trivy rejects every high or critical runtime vulnerability, including findings
  without an available fix, before the digest is promoted;
- GitHub attaches a build-provenance attestation to the digest; and
- the run uploads `deployment.json` with the exact `image@sha256:...` reference.

Do not deploy the readable tag by itself. Copy the `deploy` value from the manifest
into the reviewed infrastructure declaration. A later release automation step may
open that infrastructure pull request, but it must use a narrowly installed GitHub
App rather than a personal access token or the source repository's `GITHUB_TOKEN`.

For the first migration from an in-guest Git build, dispatch the workflow with the
commit already declared by infrastructure. This proves the artifact path without
also changing application behavior. Subsequent application changes publish from
`main` normally.
