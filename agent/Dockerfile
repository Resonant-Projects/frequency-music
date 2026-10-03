# Always-on agent image. The worker runs under `tsx` (Node + esbuild loader),
# which strips TypeScript and resolves the worker's `.js`-specifier -> `.ts`
# source imports. Bun and the LangGraph development CLI stay in the dependency
# stage; the runtime receives production node_modules only.
ARG BUILD_NODE_IMAGE=node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc
ARG RUNTIME_NODE_IMAGE=node:24.18.1-alpine3.23@sha256:c2cc26d8f991c2db236ad51a61efee843c482372d6d22570787309d511694110

FROM ${BUILD_NODE_IMAGE} AS dependencies
WORKDIR /app/agent

ARG BUN_VERSION=1.4.2
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV BUN_INSTALL=/usr/local
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY agent/package.json agent/bun.lock ./
RUN bun install --frozen-lockfile --production --omit=peer

# YouTube audio for transcript capture (src/tools/youtubeTranscript.ts): a
# pinned, checksum-verified musl yt-dlp and the bgutil PO-token plugin. The
# bgutil token server itself runs as a sidecar in the worker pod.
ARG YTDLP_VERSION=2026.08.19
ARG YTDLP_SHA256=f3dec9cfeaf304cec98290fe41c6ad465d4b747d302473559643e7af24929722
ARG BGUTIL_PLUGIN_VERSION=2.0.1
ARG BGUTIL_PLUGIN_SHA256=6fc9d757578949ba3cad2f561f57dfbc16142dbf8d485fe1bf9f0733f23bf9e3
RUN curl -fsSLo /tmp/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_musllinux" \
    && echo "${YTDLP_SHA256}  /tmp/yt-dlp" | sha256sum -c - \
    && chmod 0755 /tmp/yt-dlp \
    && mkdir -p /tmp/yt-dlp-plugins \
    && curl -fsSLo /tmp/yt-dlp-plugins/bgutil-ytdlp-pot-provider.zip "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${BGUTIL_PLUGIN_VERSION}/bgutil-ytdlp-pot-provider.zip" \
    && echo "${BGUTIL_PLUGIN_SHA256}  /tmp/yt-dlp-plugins/bgutil-ytdlp-pot-provider.zip" | sha256sum -c -
# The bgutil PO-token server at the plugin's version, built from its pinned
# source tarball. The worker pod runs it from this same image as a sidecar on
# 127.0.0.1:4416. canvas is never imported by the server; skipping install
# scripts leaves its native build out (jsdom loads it only if present).
ARG BGUTIL_SERVER_SHA256=bae71b7971fa22376af57edca8d3487724ac9a8ada56d1cccf07a547b4b9b62c
RUN curl -fsSLo /tmp/bgutil.tar.gz "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/archive/refs/tags/${BGUTIL_PLUGIN_VERSION}.tar.gz" \
    && echo "${BGUTIL_SERVER_SHA256}  /tmp/bgutil.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/bgutil \
    && tar -xzf /tmp/bgutil.tar.gz -C /tmp/bgutil --strip-components=1 \
    && cd /tmp/bgutil/server \
    && npm ci --ignore-scripts --no-audit --no-fund \
    && npx tsc \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
    && mkdir -p /tmp/bgutil-server \
    && cp -R package.json build node_modules /tmp/bgutil-server/

FROM ${RUNTIME_NODE_IMAGE} AS runtime
WORKDIR /app/agent

# Patch the pinned base for CVE-2026-14456; keep Node/Codex unchanged.
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0

ARG CODEX_CLI_VERSION=0.146.0
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# ffmpeg re-encodes YouTube audio over Groq's 25 MB upload limit into short
# Opus segments (src/tools/youtubeTranscript.ts). Under pipefail, a failing
# ffmpeg fails the build even if it printed libopus.
RUN apk add --no-cache ffmpeg=8.0.1-r1 \
    && ffmpeg -hide_banner -encoders | grep libopus >/dev/null

# Codex AUTH is never baked — auth.json is seeded once at runtime into the
# CODEX_HOME volume. npm is needed only to install the pinned CLI; removing it
# also removes its package-manager dependency tree from the runtime image.
RUN npm install -g "@openai/codex@${CODEX_CLI_VERSION}" \
    && codex --version \
    && npm cache clean --force \
    && rm -rf /root/.npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=dependencies /tmp/yt-dlp /usr/local/bin/yt-dlp
COPY --from=dependencies /tmp/yt-dlp-plugins /opt/yt-dlp/plugins
COPY --from=dependencies /tmp/bgutil-server /opt/bgutil-server
RUN yt-dlp --version
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV YTDLP_PLUGIN_DIRS=/opt/yt-dlp/plugins

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
