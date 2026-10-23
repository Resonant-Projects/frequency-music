# Local Convex persistence verification

This Linux/Docker workflow deploys the repository functions, schema and components
to a fresh self-hosted Convex on localhost. It uses no existing deployment, account,
`.env` file, provider key or production admin key. Dependencies must already be
installed with `vp install` in root and `web/`; generate ignored Panda output with
`cd web && vp run codegen` and install the matching Playwright Chromium if absent.

Run from the repository root with a fresh lowercase run id:

```sh
python3 scripts/local-convex/control.py run local-proof-01
```

`run` performs these steps with teardown in `finally`. To inspect between steps:

```sh
python3 scripts/local-convex/control.py start local-proof-02
python3 scripts/local-convex/control.py deploy local-proof-02
python3 scripts/local-convex/control.py exercise local-proof-02
python3 scripts/local-convex/control.py stop local-proof-02
```

Always stop a manually started run after success, failure or interruption. Each
exercise requires an empty deployment. Use a new id for a retry. Source changes
between start and exercise require teardown and a new run.

The image is pinned by digest in `control.py`. Docker can pull it automatically;
its current public namespace is `ghcr.io/convex/convex-backend`. Start creates an
owned named volume and `--internal` network. The backend has no external route;
its telemetry beacon is disabled. A host relay binds only `127.0.0.1` for backend
and HTTP-action ingress, because internal Docker networks do not publish ports.
This relay expects a native Linux Docker bridge reachable by the host; Docker
Desktop networking is not verified. Docker commands use only the local
`unix:///var/run/docker.sock`, ignoring inherited remote contexts and credentials.

The run receipt under `web/artifacts/local-convex/<id>/instance.json` records the
allocated frontend/backend/site loopback origins, image, source digest and process
identity. Backend version currently reports `unknown`; the image digest identifies
what ran. Local credentials are generated from the new instance only, stored with
mode 0600, never printed, and deleted at teardown.

The CLI runs in a disposable source copy with an explicit environment containing
only the local target and generated key. The frontend uses an isolated Vite config
with its env directory set to the run directory and no podcast proxy. Neither
process loads checkout `.env` files or inherits deployment/provider variables.
CLI and browser `TMPDIR` points to the run's owned scratch directory; teardown
removes it while retaining screenshots, traces and snapshots.

Two deployment exceptions are explicit:

- The disposable `convex/crons.ts` registers no cron jobs, so verification cannot
  start scheduled producers. The checked-in application cron module is unchanged.
- A test-only seed/snapshot module is added to the disposable copy. It creates one
  synthetic user and missing-text Source and exposes direct table reads for proof.
  It is never added to the product's `convex/` directory.

The browser renders the real App/routes, Convex client and adapters. Its local-only
bootstrap uses the new instance's admin credential with a synthetic user identity;
it does not test hosted Clerk or JWT validation. Browser HTTP/WebSocket traffic is
restricted to the three owned loopback origins. Tests save through actual controls
and independently inspect persistence with a separate Convex HTTP client.

Four journeys cover URL-only intake/dedupe, missing-text recovery, a manually
created hypothesis → recipe → composition → Listening Session chain, lineage
readback, and feed creation/disable. They do not claim automatic URL capture,
extraction, generator quality, real audio, renderer/media operation, signers,
publication, hosted authentication or every lifecycle edge case.

Screenshots, traces, independent synthetic row snapshots, deploy output and cleanup
receipts remain in the ignored run directory. Teardown removes only resources whose
Docker labels match this checkout/run, stops the recorded relay, checks that its
listeners disappear, removes credentials and the disposable release, and preserves
evidence. The downloaded image cache remains available for later runs.

Bounded commands require Linux pidfd support and refuse to launch when it is
unavailable. Polling releases exited descendants’ descriptors while preserving
the original root descriptor. Cleanup retains live identities and also finds
reparented members of the command’s session. The root stays unreaped until cleanup
finishes discovery, keeping its PID reserved while finding descendants. A bounded
exit-and-rescan drain catches children forked during the final signal phase and
reclaims exited descriptors between batches, allowing cleanup to stop more
concurrent children than its descriptor limit. Observed PID/start-time pairs stay
available across batches even if detached children reparent during cleanup.
Processes in detached branches
that become orphaned before any scan observes them remain outside this sampling
boundary.

Safety checks are offline:

```sh
python3 -m unittest discover -s scripts/local-convex -p 'test_*.py' -v
```
