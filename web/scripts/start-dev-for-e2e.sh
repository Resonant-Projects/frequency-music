#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
web_root="${repo_root}/web"
web_env_file="${web_root}/.env.local"
root_env_file="${repo_root}/.env.local"

read_env_var() {
  local key="$1"
  local file="$2"

  if [[ ! -f "${file}" ]]; then
    return 0
  fi

  local value
  value="$(grep -E "^${key}=" "${file}" | tail -n 1 | cut -d '=' -f 2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf "%s" "${value}"
}

if [[ -z "${VITE_CONVEX_URL:-}" ]]; then
  value="$(read_env_var "VITE_CONVEX_URL" "${web_env_file}")"
  if [[ -z "${value}" ]]; then
    value="$(read_env_var "VITE_CONVEX_URL" "${root_env_file}")"
  fi
  if [[ -n "${value}" ]]; then
    export VITE_CONVEX_URL="${value}"
  fi
fi

for key in \
  VITE_CLERK_PUBLISHABLE_KEY \
  VITE_CLERK_SIGN_IN_URL \
  VITE_CLERK_SIGN_UP_URL \
  E2E_CLERK_EMAIL \
  E2E_CLERK_PASSWORD
do
  if [[ -z "${!key:-}" ]]; then
    value="$(read_env_var "${key}" "${web_env_file}")"
    if [[ -z "${value}" ]]; then
      value="$(read_env_var "${key}" "${root_env_file}")"
    fi
    if [[ -n "${value}" ]]; then
      export "${key}=${value}"
    fi
  fi
done

if [[ -z "${VITE_CONVEX_URL:-}" ]]; then
  echo "Missing VITE_CONVEX_URL. Define it in ${web_env_file}, ${root_env_file}, or env." >&2
  exit 1
fi

for key in \
  VITE_CLERK_PUBLISHABLE_KEY \
  VITE_CLERK_SIGN_IN_URL \
  VITE_CLERK_SIGN_UP_URL \
  E2E_CLERK_EMAIL \
  E2E_CLERK_PASSWORD
do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing ${key}. Define it in ${web_env_file}, ${root_env_file}, or env for Clerk-authenticated e2e." >&2
    exit 1
  fi
done

export VITE_E2E_MODE="${VITE_E2E_MODE:-1}"

exec bun run dev -- --host 127.0.0.1 --port 4173
