# Always-on agent image. The worker runs under `tsx` (Node + esbuild loader),
# which strips TypeScript and resolves the worker's `.js`-specifier -> `.ts`
# source imports. Bun and the LangGraph development CLI stay in the dependency
# stage; the runtime receives production node_modules only.
ARG BUILD_NODE_IMAGE=node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc
ARG RUNTIME_NODE_IMAGE=node:24.18.1-alpine3.23@sha256:c2cc26d8f991c2db236ad51a61efee843c482372d6d22570787309d511694110

FROM ${BUILD_NODE_IMAGE} AS dependencies
WORKDIR /app/agent

ARG BUN_VERSION=1.3.14
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV BUN_INSTALL=/usr/local
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY agent/package.json agent/bun.lock ./
RUN bun install --frozen-lockfile --production --omit=peer

FROM ${RUNTIME_NODE_IMAGE} AS runtime
WORKDIR /app/agent

ARG CODEX_CLI_VERSION=0.146.0
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Codex AUTH is never baked — auth.json is seeded once at runtime into the
# CODEX_HOME volume. npm is needed only to install the pinned CLI; removing it
# also removes its package-manager dependency tree from the runtime image.
RUN npm install -g "@openai/codex@${CODEX_CLI_VERSION}" \
    && codex --version \
    && npm cache clean --force \
    && rm -rf /root/.npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
RUN adduser -D -h /home/agent -s /bin/sh agent \
    && mkdir -p /data/codex-home /data/codex-scratch \
    && chown -R agent:agent /data

# File-backed Codex credential store (no OS keyring exists in a container).
ENV CODEX_HOME=/data/codex-home
ENV CODEX_WORKDIR=/data/codex-scratch
ENV CODEX_ENABLED=true

COPY --from=dependencies --chown=agent:agent /app/agent/node_modules ./node_modules
COPY --chown=agent:agent agent/. ./
COPY --chown=agent:agent convex/shared /app/convex/shared
# convex/shared files resolve their imports (zod, convex-helpers, convex)
# upward from /app/convex — link them to the agent install.
RUN ln -s /app/agent/node_modules /app/node_modules
USER agent
EXPOSE 2024

# Default to the always-on worker, run under tsx. The LangGraph Studio dev
# server is opt-in via the `dev` compose profile.
CMD ["node_modules/.bin/tsx", "src/worker/runner.ts"]
