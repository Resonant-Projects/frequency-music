# Clerk hosted auth setup

This app is configured for Clerk-hosted auth on `login.resonantrhythm.com` and
the SPA on `app.resonantrhythm.com`.

## 1) Clerk dashboard configuration

1. Open Clerk Dashboard for the production instance.
2. Configure custom domain for hosted auth/account portal:
   - `login.resonantrhythm.com`
3. In Clerk redirect/origin settings, allow:
   - `https://app.resonantrhythm.com`
4. Set production auth URLs:
   - Sign in: `https://login.resonantrhythm.com/sign-in`
   - Sign up: `https://login.resonantrhythm.com/sign-up`
5. Create JWT template named `convex`.

## 2) DNS records

In your DNS provider, add the records Clerk requests for
`login.resonantrhythm.com` domain verification.

In Vercel (or DNS directly), ensure `app.resonantrhythm.com` points to the web
deployment.

## 3) Vercel environment variables

Set these in the Vercel project that deploys `web/`:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_SIGN_IN_URL=https://login.resonantrhythm.com/sign-in`
- `VITE_CLERK_SIGN_UP_URL=https://login.resonantrhythm.com/sign-up`
- `VITE_CLERK_AFTER_SIGN_IN_URL=/`
- `VITE_CLERK_AFTER_SIGN_UP_URL=/`
- `VITE_CONVEX_URL=<your-convex-url>`

Set the same values in `web/.env.local` for local development.

Optional Vercel CLI flow:

```bash
vercel domains add app.resonantrhythm.com
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add VITE_CLERK_SIGN_IN_URL production
vercel env add VITE_CLERK_SIGN_UP_URL production
vercel env add VITE_CLERK_AFTER_SIGN_IN_URL production
vercel env add VITE_CLERK_AFTER_SIGN_UP_URL production
vercel env add VITE_CONVEX_URL production
```

## 4) Expected auth behavior

- Any unauthenticated app route redirects to Clerk-hosted sign in.
- Sign in redirects back to the originating `app.resonantrhythm.com` URL.
- Convex auth uses Clerk token template `convex`.

## 5) Local CLI bypass and e2e auth

Browser access now always goes through Clerk. Do not expose a bypass secret to
the web client.

For CLI/server-side development helpers only:

- `AUTH_BYPASS_ENABLED=true`
- `AUTH_BYPASS_SECRET=<server-side-only-shared-secret>`

Playwright e2e auth:

- `E2E_CLERK_EMAIL=<test-account-email>`
- `E2E_CLERK_PASSWORD=<test-account-password>`

How it works:

- The web app always boots Clerk and redirects unauthenticated users to hosted sign in.
- Playwright signs into Clerk during global setup and reuses the saved storage state.
- Protected Convex CLI mutations/actions may still accept `devBypassSecret`, but only from trusted server-side or CLI callers.

Production safety:

- Never expose `AUTH_BYPASS_SECRET` through `VITE_*` env vars or browser code.
- Never set `AUTH_BYPASS_ENABLED=true` in production.
- Rotate `AUTH_BYPASS_SECRET` immediately if it is exposed.
