# Proxmox Agent Deployment Notes

The Proxmox cluster for this project is reachable at:

```text
prox.rproj.art
```

The root `.env.local` now carries Proxmox API credentials:

```text
PROXMOX_TOKEN_ID
PROXMOX_TOKEN_SECRET
```

Recommended derived API URL for scripts:

```text
PROXMOX_API_URL=https://prox.rproj.art:8006/api2/json
```

## Secret handling

- Never print the token id or token secret in logs.
- Do not pass the secret as a command-line argument.
- Prefer reading `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` from environment variables or runtime container secrets.
- Do not bake Proxmox credentials into Docker images.
- Do not commit populated `.env`, `.env.local`, or compose override files.

## Intended deployment shape

Use Proxmox for the always-on LangGraph runtime once local dry-run graphs are verified.

Suggested services:

1. `langgraph-worker`
   - Runs the registered LangGraph graphs from `agent/`.
   - Needs Convex tool env vars, model-provider env vars, and LangSmith env vars.

2. `agent-runner` or queue poller
   - Optional later service that polls Convex `agentRuns` for queued runs.
   - Should not exist until `agentRuns` audit tables are implemented.

3. reverse proxy / internal route
   - Optional, depending on whether LangGraph needs inbound access or only outbound Convex/model access.

Run the Proxmox connectivity spike with:

```bash
cd agent
bun run smoke:proxmox
```

It reads `PROXMOX_TOKEN_ID` and `PROXMOX_TOKEN_SECRET` from the environment, falling back to the repository root `.env.local` when run from `agent/`. It prints cluster version and sanitized node summaries only. If the cluster certificate is not trusted locally, set `PROXMOX_ALLOW_SELF_SIGNED=true` for the spike/container runtime.

## Local build/smoke sequence

Before preparing any Proxmox runtime, verify the local agent package and LangGraph image build:

```bash
cd agent
bun run verify
bun run automation:local
```

`bun run automation:local` runs TypeScript verification and the local LangGraph Docker build, producing the local image tag configured by `agent/package.json` (`resonant-projects-agent:local`). It intentionally skips Proxmox connectivity by default so normal local automation remains low-friction and does not require cluster credentials.

To include the secret-safe Proxmox API smoke check in the same fail-fast sequence:

```bash
cd agent
RUN_PROXMOX_SMOKE=true bun run automation:local
```

The automation must not print token values. The optional smoke step delegates to `agent/scripts/spike-proxmox.ts`, which reads credentials from environment variables or the root `.env.local` fallback and prints only sanitized cluster metadata.

Do not use this sequence to deploy yet: it is build/smoke preparation only. Do not copy Proxmox tokens, Codex sessions, or other secrets into Docker images.

## Near-term deployment sequence

1. Keep running locally while `research-pipeline` is dry-run only.
2. Add `agentRuns` and `agentRunEvents` in Convex.
3. Add narrow write tools for agent run audit events.
4. Containerize `agent/`.
5. Deploy the container to Proxmox with runtime secrets mounted/injected.
6. Run weekly brief and research-pipeline in parallel with existing Convex workflows.
7. Disable Convex-side orchestration only after LangGraph output is stable and auditable.

Always-on Proxmox deployment is gated on the Convex audit tables because the runner needs durable run state, event history, and failure visibility before it can safely replace or parallelize existing orchestration. Until `agentRuns`/`agentRunEvents` and narrow audit/write tools exist, deployment work should stay limited to local builds, smoke checks, and documentation.
