# Always-on agent image. node:22 provides the Codex CLI + langgraphjs dev server;
# Bun is the worker runtime (runner uses top-level await + .js ESM specifiers).
FROM node:22-slim AS base
WORKDIR /app

ARG CODEX_CLI_VERSION=0.142.5
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Bake the Codex CLI binary (fine to bake) and Bun. Codex AUTH is never baked —
# auth.json is seeded once at runtime into the CODEX_HOME volume (see runbook).
ENV BUN_INSTALL=/usr/local
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && npm install -g @openai/codex@${CODEX_CLI_VERSION} \
    && curl -fsSL https://bun.sh/install | bash \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/bash agent \
    && mkdir -p /data/codex-home /data/codex-scratch \
    && chown -R agent:agent /data

# File-backed Codex credential store (no OS keyring exists in a container).
ENV CODEX_HOME=/data/codex-home
ENV CODEX_WORKDIR=/data/codex-scratch
ENV CODEX_ENABLED=true

# npm-managed deps (package-lock authoritative); Bun runs them from node_modules.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN chown -R agent:agent /app
USER agent
EXPOSE 2024

# Default to the always-on worker. The LangGraph Studio dev server is opt-in via
# the `dev` compose profile.
CMD ["bun", "run", "worker"]
