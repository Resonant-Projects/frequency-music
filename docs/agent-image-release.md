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

The readable `sha-<full-commit>` tag is a lookup aid and remains mutable in GHCR;
the manifest digest is the immutability boundary. Do not deploy the tag by itself.
Copy the `deploy` value from the manifest into the reviewed infrastructure
declaration. A later release automation step may open that infrastructure pull
request, but it must use a narrowly installed GitHub App rather than a personal
access token or the source repository's `GITHUB_TOKEN`.

## Lab Harbor copy

The image is published to GHCR and, for `main` builds, also to the Lab's
internal Harbor at `registry.rproj.art/frequency-music/frequency-music-agent`.
Harbor is reachable only from the Lab LAN, so the workflow's `harbor` job runs on
a self-hosted GARM runner after `publish` succeeds. It copies the GHCR digest
under the immutable tag `sha-<full-commit>-<first 12 hex of the digest>`, so a
rebuild of the same commit never collides, and signs it keylessly with cosign
under this workflow's identity,
`https://github.com/Resonant-Projects/frequency-music/.github/workflows/publish-agent-image.yml@refs/heads/main`
(issuer `https://token.actions.githubusercontent.com`). It then verifies the
signature, records Harbor's vulnerability scan in the run summary, proves an
anonymous pull, and uploads `harbor-deployment.json` with the Harbor `deploy`
reference. The Kubernetes worker is promoted to that Harbor reference in
`keithce/homelab-infra`. A manual dispatch reaches Harbor only when it runs from
`main` with a `source_ref` already on `main`. The `harbor-publish` environment,
limited to `main`, holds `HARBOR_PUBLISH_ROBOT_SECRET` for Harbor robot
`robot$frequency-music-publisher`.

For the first migration from an in-guest Git build, dispatch the workflow with the
commit already declared by infrastructure. This proves the artifact path without
also changing application behavior. Subsequent application changes publish from
`main` normally.
