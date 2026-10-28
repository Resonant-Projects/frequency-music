# Frequency Music media service (wave 0: probe pipeline), published as
# ghcr.io/resonant-projects/frequency-music-media. The worker runs under `tsx`
# like the agent image; ffmpeg and ffprobe come from Debian in the runtime
# stage so the host needs no media tooling. Bun stays in the dependency stage;
# the runtime receives production node_modules only.
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c

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
# than publishing an unpatched OpenSSL (CVE-2026-75804, CVE-2026-84782) or
# expat (CVE-2026-66046, CVE-2026-76956, CVE-2026-76957, CVE-2026-77214,
# CVE-2026-93990).
ARG DEBIAN_SECURITY_REFRESH=2026-10-17
ARG OPENSSL_FLOOR=3.5.7-1~deb13u3
ARG EXPAT_FLOOR=2.9.0-1~deb13u1
RUN echo "security refresh ${DEBIAN_SECURITY_REFRESH}" \
    && apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
       supercollider-server supercollider-language \
    && for check in "libssl3t64 $OPENSSL_FLOOR" "openssl $OPENSSL_FLOOR" \
         "libexpat1 $EXPAT_FLOOR"; do \
         read -r pkg floor <<< "$check"; \
         installed="$(dpkg-query -W -f='${Version}' "$pkg")"; \
         dpkg --compare-versions "$installed" ge "$floor" \
           || { echo "$pkg $installed is below $floor" >&2; exit 1; }; \
       done \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# sclang and scsynth (Debian's SuperCollider 3.13) render litmus studies
# offline. sclang links Qt; the renderer runs it with QT_QPA_PLATFORM=offscreen
# and a private HOME, so no display or user config is involved.
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
# The repo root's package.json makes convex/shared ESM; without the same
# boundary here tsx loads it as CommonJS and barrel re-exports
# (convex/shared/tuning) lose their named exports.
RUN printf '{ "type": "module", "private": true }\n' > /app/package.json
USER media

ENV MEDIA_WORK_DIR=/work
CMD ["node_modules/.bin/tsx", "src/main.ts"]
