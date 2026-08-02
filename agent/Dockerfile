# Always-on agent image. The worker runs under `tsx` (Node + esbuild loader),
# which strips TypeScript and resolves the worker's `.js`-specifier -> `.ts`
# source imports. Bun and the LangGraph development CLI stay in the dependency
# stage; the runtime receives production node_modules only.
ARG NODE_IMAGE=node:24.18.1-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7

FROM ${NODE_IMAGE} AS dependencies
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
RUN bun install --frozen-lockfile --production

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app/agent

ARG CODEX_CLI_VERSION=0.142.5
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Codex AUTH is never baked — auth.json is seeded once at runtime into the
# CODEX_HOME volume. npm is needed only to install the pinned CLI; removing it
# also removes its package-manager dependency tree from the runtime image.
RUN npm install -g "@openai/codex@${CODEX_CLI_VERSION}" \
    && codex --version \
    && npm cache clean --force \
    && rm -rf /root/.npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
RUN useradd --create-home --shell /bin/bash agent \
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
