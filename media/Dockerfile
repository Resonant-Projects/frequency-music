# Frequency Music media service (wave 0: probe pipeline), published as
# ghcr.io/resonant-projects/frequency-music-media. The worker runs under `tsx`
# like the agent image; ffmpeg and ffprobe come from Debian in the runtime
# stage so the host needs no media tooling. Bun stays in the dependency stage;
# the runtime receives production node_modules only.
ARG NODE_IMAGE=node:24.18.1-trixie-slim@sha256:ac39e4b5fcb2b1b34b20364fd58b2e898f3bb80731ee6f62a7536f9df3d6aadc

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app/media

ARG BUN_VERSION=1.4.2
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV BUN_INSTALL=/usr/local
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY media/package.json media/bun.lock ./
RUN bun install --frozen-lockfile --production --omit=peer

FROM ${NODE_IMAGE} AS runtime
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Upgrade the pinned base first: trivy fails the publish workflow on fixable
# HIGH/CRITICAL CVEs in Debian packages (util-linux, gzip, pcre2, sqlite …).
# Bump DEBIAN_SECURITY_REFRESH to rebuild this layer when a fix lands after
# the build cache was populated; the floor check fails a stale mirror rather
# than publishing an unpatched OpenSSL (CVE-2026-75804, CVE-2026-84782).
ARG DEBIAN_SECURITY_REFRESH=2026-10-01
ARG OPENSSL_FLOOR=3.5.7-1~deb13u3
RUN echo "security refresh ${DEBIAN_SECURITY_REFRESH}" \
    && apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && for pkg in libssl3t64 openssl; do \
         installed="$(dpkg-query -W -f='${Version}' "$pkg")"; \
         dpkg --compare-versions "$installed" ge "$OPENSSL_FLOOR" \
           || { echo "$pkg $installed is below $OPENSSL_FLOOR" >&2; exit 1; }; \
       done \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# The base image bundles npm, whose vendored tar/brace-expansion carry open
# CVEs the scan rejects; the worker runs under tsx and never needs npm.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Non-root worker; /work is the scratch directory for renders and encodes.
RUN useradd --uid 1001 --create-home --shell /usr/sbin/nologin media \
    && mkdir -p /work && chown media:media /work

WORKDIR /app/media
COPY --from=dependencies --chown=media:media /app/media/node_modules ./node_modules
# media/ includes .env.schema: varlock/auto-load (first import in src/main.ts)
# execs `varlock load`, which reads the schema from the working directory.
# Real values arrive from the container environment; no .env.local is baked.
COPY --chown=media:media media/ ./
COPY --chown=media:media convex/shared /app/convex/shared
# convex/shared files resolve their imports (zod, convex-helpers, convex)
# upward from /app/convex — link them to the media install.
RUN ln -s /app/media/node_modules /app/node_modules
USER media

ENV MEDIA_WORK_DIR=/work
CMD ["node_modules/.bin/tsx", "src/main.ts"]
