# Agent instructions

The canonical project reference is [CLAUDE.md](./CLAUDE.md); [CONTEXT.md](./CONTEXT.md) is the canonical vocabulary. Read both before working in this repository.

## CLI mutation authentication

All CLI mutations require the Clerk auth bypass. Add the placeholder argument to mutation calls and let the local environment resolve the real value:

```bash
bunx convex run extract:extractSource '{"sourceId": "...", "model": "anthropic/claude-sonnet-4-6", "devBypassSecret": "<AUTH_BYPASS_SECRET>"}'
```

Never paste or commit a real secret value. See the Authentication section in [CLAUDE.md](./CLAUDE.md) for the canonical setup.
