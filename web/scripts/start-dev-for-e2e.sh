#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VITE_CONVEX_URL:-}" ]]; then
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  root_env_file="${repo_root}/.env.local"

  if [[ -f "${root_env_file}" ]]; then
    value="$(grep -E '^VITE_CONVEX_URL=' "${root_env_file}" | tail -n 1 | cut -d '=' -f 2- || true)"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    if [[ -n "${value}" ]]; then
      export VITE_CONVEX_URL="${value}"
    fi
  fi
fi

if [[ -z "${VITE_CONVEX_URL:-}" ]]; then
  echo "Missing VITE_CONVEX_URL. Set it in the environment or ${root_env_file}." >&2
  exit 1
fi

exec bun run dev --host 127.0.0.1 --port 4173
