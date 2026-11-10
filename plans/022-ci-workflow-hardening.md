# Plan 022: Tighten three GitHub workflows and typecheck the root package in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report; do not
> improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat cf4a8174..HEAD -- .github/workflows/ci.yml .github/workflows/public-editorial-export.yml .github/workflows/publish-media-image.yml .github/workflows/publish-agent-image.yml scripts/export-editorial.ts`
> If any of these changed, compare the excerpts below with the live files
> first; a mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/017-size-hook-ratchet.md for step 5 only; steps 1–4
  are independent
- **Category**: security, dx
- **Planned at**: commit `cf4a8174`, 2026-11-09

## Why this matters

The repository is public and its workflows run on self-hosted runners. Four
gaps were found by reading the workflow files:

1. The editorial export job exposes a Convex deploy key to every step,
   including dependency install, although the export script never reads it.
   The job can also be dispatched from any branch with `contents: write`.
2. The media image publish job can be dispatched for a commit that is not on
   `main`, and it signs and publishes the result. The agent image workflow
   already refuses that.
3. `ci.yml` declares no `permissions`, so its jobs get the repository default.
4. CI never runs the root TypeScript check. A pull request can be green and
   then fail `vp run convex:deploy`, which typechecks first.

## Current state

`.github/workflows/public-editorial-export.yml:1-14`:

```yaml
name: Public Editorial Export

on:
  workflow_dispatch:

jobs:
  export:
    runs-on: [self-hosted, linux, x64, incus, garm, ephemeral]
    permissions:
      contents: write
    env:
      CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
      PUBLIC_APP_BASE_URL: ${{ vars.PUBLIC_APP_BASE_URL || 'https://app.resonantprojects.art' }}
      EXPORT_BRANCH: editorial-export
```

The only step that needs a credential sets it itself (`:39-46`, the
"Generate public editorial snapshot" step sets `CONVEX_URL`,
`DEV_BYPASS_SECRET` and `PUBLIC_APP_BASE_URL`). `scripts/export-editorial.ts`
reads exactly those three environment variables (lines 26, 31, 37).

`.github/workflows/publish-media-image.yml:106-124`:

```yaml
  publish:
    name: Build, scan, and publish
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    permissions:
      attestations: write # Attach GitHub provenance to the published digest.
      contents: read
      id-token: write # Mint the OIDC identity used to sign the attestation.
      packages: write # Push the immutable image and its attestations to GHCR.
    steps:
      - name: Check out selected source
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 1
          persist-credentials: false
          ref: ${{ github.event_name == 'workflow_dispatch' && inputs.source_ref || github.sha }}
```

The next step, `Derive immutable image coordinates` (`id: metadata`), checks
that `inputs.source_ref` is a full 40-character SHA equal to the checked-out
commit and writes `source_sha` to `$GITHUB_OUTPUT`. Nothing checks that the
commit is on `main`. The workflow triggers on `pull_request`, `push` to
`main`, and `workflow_dispatch` with a required `source_ref` input.

The agent workflow's equivalent gate
(`.github/workflows/publish-agent-image.yml:136` and `:167-180`):

```yaml
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
```

```yaml
      - name: Confirm the published source is on main
        env:
          GITHUB_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          [[ "$IMAGE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 1
          python3 - <<'PY'
          import json, os, urllib.request
          e=os.environ; u=f"{e['GITHUB_API_URL']}/repos/{e['GITHUB_REPOSITORY']}/compare/{e['SOURCE_SHA']}...{e['GITHUB_SHA']}?per_page=1"
          r=urllib.request.Request(u,headers={'Authorization':f"Bearer {e['GITHUB_TOKEN']}"})
          with urllib.request.urlopen(r,timeout=60) as x: s=json.load(x)['status']
          if s not in ('ahead','identical'): raise SystemExit(f"{e['SOURCE_SHA']} is not on main ({s})")
          PY
```

`.github/workflows/ci.yml:1-9` has no `permissions` block:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  root:
```

The root job's checks (`.github/workflows/ci.yml:31-39`):

```yaml
      - run: bun audit
      - run: bun audit --prod
      - run: vp run lint:check
      - run: vp run format:check
      # `vp run test` (= vp test convex scripts) rather than a hardcoded subset,
      # so CI coverage tracks package.json instead of drifting from it.
      - run: vp run test
      - run: vp run test:harness
      - run: python3 scripts/recovery/tests/test-native-pause-controller.py
```

`package.json` defines `"typecheck:scripts": "vpx tsc --noEmit"`, which covers
`convex/`, `harness/` and `scripts/`. It is part of `vp run verify` locally
but is in no workflow.

Conventions in these files: every `uses:` is pinned to a full commit SHA with
a version comment; checkouts set `persist-credentials: false`. Keep both.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `vp install` (repo root) | exit 0 |
| Root typecheck | `vp run typecheck:scripts` | exit 0 |
| Policy tests | `vp test scripts/workflow-hardening.test.ts` | all pass |
| Existing policy tests | `vp test scripts/deployment-policy.test.ts` | all pass |
| Lint / format | `vp run lint:check` / `vp run format:check` | exit 0 |

Never run `vpx convex ...` or `bunx convex ...`. Do not dispatch any workflow.

## Scope

**In scope**:
- `.github/workflows/ci.yml`
- `.github/workflows/public-editorial-export.yml`
- `.github/workflows/publish-media-image.yml`
- `scripts/workflow-hardening.test.ts` (create)

**Out of scope**:
- `.github/workflows/publish-agent-image.yml` — the reference; do not edit.
- `runs-on` values. Fork pull requests are routed to ephemeral GARM runners on
  purpose; runner isolation is an operator setting, not a repository change.
- `publish-essays.yml`, `convex-provenance.yml`, `agent-langgraph-image.yml`.
- Repository secrets and settings.
- Adding lint for `web/`, `agent/` or `media/` — a separate, larger change.

## Git workflow

- Branch: `ci/workflow-hardening`
- Conventional commits, as in `git log`: `ci: avoid verification previews and
  align Node 26`. Suggested: `ci: scope export secrets, gate media publish to
  main, typecheck root`.
- Do not push or open a PR unless the operator asked for it. The new CI steps
  can only be proven on a pull request; say so in your report.

## Steps

### Step 1: Write the policy tests first

Create `scripts/workflow-hardening.test.ts`. It reads the three workflow files
as text with `readFileSync` (import `describe`, `expect`, `test` from
`vite-plus/test`; look at `scripts/deployment-policy.test.ts` for how that
file locates the repository root) and asserts:

1. `public-editorial-export.yml` does not contain `CONVEX_DEPLOY_KEY`.
2. `public-editorial-export.yml` contains
   `if: github.ref == 'refs/heads/main'`.
3. `publish-media-image.yml` contains
   `if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'`.
4. `publish-media-image.yml` contains the step name
   `Confirm the published source is on main`.
5. `ci.yml` matches `/^permissions:\n  contents: read$/m`.
6. `ci.yml` contains `- run: vp run typecheck:scripts`.

**Verify**: `vp test scripts/workflow-hardening.test.ts` → 6 fail. They pass
one by one as the steps below land.

### Step 2: Scope the export job

In `public-editorial-export.yml`:
- Delete the line `CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}`.
- Add `if: github.ref == 'refs/heads/main'` to the `export` job, directly
  above `runs-on:`.

First confirm nothing else needs the key:
`grep -rn "CONVEX_DEPLOY_KEY" .github/workflows/public-editorial-export.yml scripts/export-editorial.ts`
must show only the line you are deleting.

**Verify**: tests 1 and 2 pass.

### Step 3: Gate the media publish to main

In `publish-media-image.yml`:
- Change the `publish` job's condition to
  `if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'`.
- Add this step immediately after the step with `id: metadata`:

```yaml
      - name: Confirm the published source is on main
        env:
          GITHUB_TOKEN: ${{ github.token }}
          SOURCE_SHA: ${{ steps.metadata.outputs.source_sha }}
        run: |
          set -euo pipefail
          [[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
          python3 - <<'PY'
          import json, os, urllib.request
          e=os.environ; u=f"{e['GITHUB_API_URL']}/repos/{e['GITHUB_REPOSITORY']}/compare/{e['SOURCE_SHA']}...{e['GITHUB_SHA']}?per_page=1"
          r=urllib.request.Request(u,headers={'Authorization':f"Bearer {e['GITHUB_TOKEN']}"})
          with urllib.request.urlopen(r,timeout=60) as x: s=json.load(x)['status']
          if s not in ('ahead','identical'): raise SystemExit(f"{e['SOURCE_SHA']} is not on main ({s})")
          PY
```

Confirm the `metadata` step really writes an output named `source_sha`
(`grep -n "source_sha=" .github/workflows/publish-media-image.yml`).

On a dispatch from `main`, `GITHUB_SHA` is the tip of `main`, so the compare
call reports `ahead` or `identical` exactly when the requested commit is on
`main`. This still allows rebuilding an older deployed commit, which the
`source_ref` input exists for.

**Verify**: tests 3 and 4 pass.

### Step 4: Least privilege and the root typecheck in `ci.yml`

- Add a top-level block between `on:` and `jobs:`:

```yaml
permissions:
  contents: read
```

- In the `root` job, add `- run: vp run typecheck:scripts` directly after
  `- run: vp run format:check`.

**Verify**: tests 5 and 6 pass; `vp run typecheck:scripts` → exit 0 locally.

### Step 5: Run the size check in CI (only if plan 017 has landed)

If `scripts/file-token-baseline.json` exists, add
`- run: node scripts/check-file-tokens.mjs --all` to the `root` job, after
the typecheck step, and add a seventh test asserting `ci.yml` contains it.
If the file does not exist, skip this step and say so in the status row.

**Verify**: `node scripts/check-file-tokens.mjs --all` → exit 0 locally.

## Test plan

The six (or seven) assertions in `scripts/workflow-hardening.test.ts` from
step 1. No workflow is executed locally.

**Verify**: `vp test scripts/workflow-hardening.test.ts scripts/deployment-policy.test.ts`
→ all pass.

## Done criteria

- [ ] `vp test scripts/workflow-hardening.test.ts` passes.
- [ ] `vp test scripts/deployment-policy.test.ts` still passes.
- [ ] `grep -c "CONVEX_DEPLOY_KEY" .github/workflows/public-editorial-export.yml`
      prints `0`.
- [ ] `vp run typecheck:scripts`, `vp run lint:check`, `vp run format:check`
      exit 0.
- [ ] Every `uses:` line in the three files is still a 40-character SHA
      (`grep -n "uses:" <file> | grep -vE "@[0-9a-f]{40}"` prints nothing).
- [ ] `git status --short` lists only the four in-scope files.
- [ ] `plans/README.md` row for 022 updated, noting that the new CI steps
      still need one green pull request run.

## STOP conditions

- `vp run typecheck:scripts` fails at the current commit before you change
  anything. Record the errors; do not fix type debt in this plan and do not
  add the CI step.
- `CONVEX_DEPLOY_KEY` is referenced anywhere else in the export workflow or by
  anything `scripts/export-editorial.ts` imports.
- The `metadata` step in the media workflow has no `source_sha` output.
- `scripts/deployment-policy.test.ts` asserts on text you are changing.
- You would need to change a `runs-on` value or a repository setting.

## Maintenance notes

- After merge, the operator should rotate the Convex deploy key if the run
  history of "Public Editorial Export" shows any dispatch from a branch other
  than `main`. That is an operator action, outside this plan.
- Operator checks this plan cannot make: GitHub's "require approval for
  outside collaborators" setting for fork pull requests, and network egress
  limits on the GARM runners.
- If the root typecheck step is slow on the runner, move it to its own job
  instead of removing it.
- A reviewer should compare the new media step line by line with the agent
  workflow's step at `publish-agent-image.yml:167-180`.
