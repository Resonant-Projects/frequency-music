# Always-on agent image. node:22 provides the Codex CLI + langgraphjs dev server;
# Bun is the worker runtime (runner uses top-level await + .js ESM specifiers).
FROM node:22-slim AS base
WORKDIR /app

# Bake the Codex CLI binary (fine to bake) and Bun. Codex AUTH is never baked —
# auth.json is seeded once at runtime into the CODEX_HOME volume (see runbook).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && npm install -g @openai/codex \
    && curl -fsSL https://bun.sh/install | bash \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:${PATH}"

# File-backed Codex credential store (no OS keyring exists in a container).
ENV CODEX_HOME=/data/codex-home
ENV CODEX_ENABLED=true

# npm-managed deps (package-lock authoritative); Bun runs them from node_modules.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
EXPOSE 2024

# Default to the always-on worker. The LangGraph Studio dev server is opt-in via
# the `dev` compose profile.
CMD ["bun", "run", "worker"]
