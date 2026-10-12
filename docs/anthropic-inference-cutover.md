# Direct Anthropic inference cutover

The source changes route worker and Convex language inference directly to Anthropic. `convex/shared/llmPolicy.ts` owns the model IDs and reasoning policy. Sonnet 5.5 uses medium effort for extraction and synthesis, Haiku 5.5 uses medium for bounded classification and relevance checks, and Opus 5.5 uses high for hypothesis and recipe design. All use adaptive thinking. Explicit non-Anthropic Convex overrides retain their existing provider routes.

## Credential and validation

Both environment schemas reference `op://Homelab Runtime/s454tugq5n2dxfhmzjhsp3drne/credential`, the user-confirmed `Anthropic API Key` item created October 12, 2026. The older `Country Manor Lab/Anthropic API - Agent-Native` credential returns 401 and is not used.

On October 12, the authenticated model-catalog check passed for all three direct API IDs. Six live connectivity calls also passed: one native structured-output call per model through the Convex AI SDK adapter and one per model through the worker LangChain adapter. The calls used synthetic input and 1,024-token output caps. They did not invoke Convex functions, enqueue runs, or write research data.

Provider request tests cover direct endpoint selection, credential precedence, adaptive thinking, explicit medium/high effort, native JSON schema, and omitted sampling parameters. The worker tests also cover Anthropic precedence over the legacy Codex specialist flag. See [the cited provider research](anthropic-inference-research.md).

## Convex activation

Target the existing self-hosted backend at `https://convex.resonantprojects.art`. Activation changes the model used by its existing actions and crons. Root `.env.schema` loading resolves local script credentials; it does not configure the running deployment.

After confirming the live target and effects:

1. Resolve the Anthropic and Convex administrative credentials through Varlock and 1Password. Use the sanitized self-hosted CLI environment from `scripts/lib/convex-deploy.ts`, with no cloud deploy key or alternate project selection.
2. Set deployment variable `ANTHROPIC_API_KEY` using the installed Convex CLI's `env set ANTHROPIC_API_KEY` with the resolved key on stdin. Keep the value out of arguments, files, and logs. The installed CLI supports stdin and reports the variable name only. Do not use `env get` or a value-bearing `env list` as evidence.
3. Deploy the committed source from a clean release checkout through `vp run convex:deploy`. This guarded command confirms the target interactively and activates functions, schema, crons, and auth configuration. It refuses uncommitted source or a checkout containing `.env` or `.env.local`.

## Worker activation

The production Kubernetes manifests belong to `homelab-infra`, under `kubernetes/infra/frequency-worker/`. The worker does not load Varlock itself. Its `frequency-runtime` ExternalSecret must supply the same key before the new image starts.

Add this entry to the existing ExternalSecret's `spec.data`:

```yaml
- secretKey: ANTHROPIC_API_KEY
  remoteRef:
    key: Anthropic API Key/credential
    conversionStrategy: Default
    decodingStrategy: None
    metadataPolicy: None
```

The existing `homelab-runtime` ClusterSecretStore selects the `Homelab Runtime` vault. Confirm that this title resolves to item `s454tugq5n2dxfhmzjhsp3drne`; review the latest infrastructure source before changing it.

Add this required secret reference to the worker container's `env`:

```yaml
- name: ANTHROPIC_API_KEY
  valueFrom:
    secretKeyRef:
      name: frequency-runtime
      key: ANTHROPIC_API_KEY
```

Set `CODEX_ENABLED=false` and clear or disable `CODEX_SPECIALIST`. The adapter also gives a present Anthropic key precedence over both legacy flags and the OpenRouter credential. Direct Anthropic errors do not trigger a billing-provider fallback. A required Kubernetes secret reference prevents the replacement Pod from starting with a missing key.

Publish the committed agent source through the existing image workflow and use its verified immutable digest and source revision in the Deployment. Preserve one replica, the Recreate strategy, retained volumes, and the existing drain protocol. Pause claim admission, let active work finish, verify the old worker has stopped, and reconcile ambiguous effects before replacement. Follow `docs/frequency-worker-handoff.md` and the infrastructure repository's delivery rules. A production merge under `homelab-infra/kubernetes/` activates Argo reconciliation.

This worktree has no configured kubectl context. No Convex deployment variable, backend function, worker manifest, image, or production queue was changed during source validation.
