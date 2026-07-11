# Always-on agent image. node:24 provides the Node.js runtime + Codex CLI +
# langgraphjs dev server. The worker runs under `tsx` (Node + esbuild loader),
# which strips TypeScript and resolves the worker's `.js`-specifier -> `.ts`
# source imports (e.g. `../tools/convexTools.js` -> convexTools.ts) the same way
# Bun did. Bun is retained ONLY as the lockfile-authoritative installer
# (bun.lock); it is no longer the runtime.
#
# UNBUILT / UNTESTED: this Dockerfile was updated as part of the Bun -> Vite+
# migration but has not been built or run. Validate the image build and a worker
# boot before shipping.
FROM node:24-slim AS base
WORKDIR /app/agent

ARG CODEX_CLI_VERSION=0.142.5
ARG BUN_VERSION=1.3.14
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Bake the Codex CLI binary (fine to bake) and Bun (installer only). Codex AUTH
# is never baked — auth.json is seeded once at runtime into the CODEX_HOME
# volume (see runbook).
ENV BUN_INSTALL=/usr/local
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && npm install -g @openai/codex@${CODEX_CLI_VERSION} \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/bash agent \
    && mkdir -p /data/codex-home /data/codex-scratch \
    && chown -R agent:agent /data

# File-backed Codex credential store (no OS keyring exists in a container).
ENV CODEX_HOME=/data/codex-home
ENV CODEX_WORKDIR=/data/codex-scratch
ENV CODEX_ENABLED=true

# bun.lock is authoritative; Bun installs dependencies into node_modules. The
# worker then runs under Node, not Bun.
COPY agent/package.json agent/bun.lock ./
RUN bun install --frozen-lockfile

COPY agent/. ./
COPY convex/shared /app/convex/shared
# convex/shared files resolve their imports (zod, convex-helpers, convex)
# upward from /app/convex — link them to the agent install.
RUN ln -s /app/agent/node_modules /app/node_modules
RUN chown -R agent:agent /app
USER agent
EXPOSE 2024

# Default to the always-on worker, run under tsx. The LangGraph Studio dev
# server is opt-in via the `dev` compose profile.
CMD ["node_modules/.bin/tsx", "src/worker/runner.ts"]
