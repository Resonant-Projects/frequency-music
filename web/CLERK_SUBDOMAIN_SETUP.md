# Clerk hosted auth setup

The live app is `https://app.resonantprojects.art`. Clerk’s production
instance uses the account portal at `accounts.resonantprojects.art` and the
frontend API at `clerk.resonantprojects.art`. The publishable key in the
deployed bundle is a `pk_live_` key for that frontend API.

`login.resonantrhythm.com` and `app.resonantrhythm.com` do not resolve. Do
not send local sign-in there.

## 1) Clerk dashboard configuration

1. Open the Clerk Dashboard for the production instance.
2. Confirm the production domain is `resonantprojects.art`.
3. Account portal:
   - Sign in: `https://accounts.resonantprojects.art/sign-in`
   - Sign up: `https://accounts.resonantprojects.art/sign-up`
4. Application origin: `https://app.resonantprojects.art`
5. JWT template named `convex`, issued by `https://clerk.resonantprojects.art`.

Production Clerk accepts a `redirect_url` only when it is on
`resonantprojects.art` or a subdomain, served over HTTPS with no port in
the origin. Leave the account-portal fallback at `/`. That path is only
used when someone opens the account portal directly. Do not add `localhost`
to the production redirect allowlist.

## 2) Vercel environment variables

Set these in the Vercel project that deploys `web/`:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_SIGN_IN_URL=https://accounts.resonantprojects.art/sign-in`
- `VITE_CLERK_SIGN_UP_URL=https://accounts.resonantprojects.art/sign-up`
- `VITE_CLERK_AFTER_SIGN_IN_URL=/`
- `VITE_CLERK_AFTER_SIGN_UP_URL=/`
- `VITE_CONVEX_URL=<your-convex-url>`

`web/.env.schema` carries the same public defaults. Put a real publishable
key in `web/.env.local` for local development.

## 3) Expected auth behavior

- Any unauthenticated app route redirects to the hosted sign-in page.
- The app passes the current page as `redirect_url`.
- Sign-in returns to that page when the origin is allowed.
- Convex auth uses Clerk token template `convex`.

## 4) Local sign-in

`cd web && vp run dev` serves `http://localhost:4173`. A live publishable
key cannot return there: after sign-in, Clerk sends the browser to the
production app. The dev server detects that origin and shows the local URL
instead of starting the redirect.

Serve the same Vite process on `https://local.resonantprojects.art` (port
443, no explicit port):

1. Map the host on your machine. This is local only; do not commit it.

   ```bash
   echo "127.0.0.1 local.resonantprojects.art" | sudo tee -a /etc/hosts
   ```

2. Create a locally trusted certificate. mkcert writes the files into the
   current directory; they stay gitignored under `web/certs/`.

   ```bash
   brew install mkcert
   mkcert -install
   mkdir -p web/certs
   cd web/certs
   mkcert local.resonantprojects.art
   ```

3. From `web/`, start Vite, then the TLS proxy. Vite stays on port 4173.
   The proxy binds 443 and needs privileges; the dev server does not.

   ```bash
   cd web
   vp run dev:clerk
   sudo bun scripts/clerk-dev-proxy.ts
   ```

   If `sudo` cannot find `bun`, run `sudo env "PATH=$PATH" bun scripts/clerk-dev-proxy.ts` from `web/`.

4. Open `https://local.resonantprojects.art` and the path you were working
   on, for example `https://local.resonantprojects.art/weekly-turns`.
   Sign-in then returns to that page.

`vp run dev:clerk` sets `CLERK_DEV_ORIGIN` so Vite allows that host and
points hot reload at `wss://local.resonantprojects.art` on port 443.
Ordinary `vp run dev`, e2e, and `VITE_AUTH_BYPASS` verification keep using
port 4173 and do not require the proxy.

## 5) Local CLI bypass and e2e auth

Browser access goes through Clerk. Do not expose a bypass secret to the web
client.

For CLI/server-side development helpers only:

- `AUTH_BYPASS_ENABLED=true`
- `AUTH_BYPASS_SECRET=<server-side-only-shared-secret>`

Playwright e2e auth:

- `E2E_CLERK_EMAIL=<test-account-email>`
- `E2E_CLERK_PASSWORD=<test-account-password>`

How it works:

- The web app boots Clerk through `@resonant-projects/clerk-solidjs`, with clerk-js bundled from `@clerk/clerk-js/no-rhc`, and redirects unauthenticated users to hosted sign-in, except when a dev server on a live key is opened from an origin Clerk would reject.
- Playwright signs into Clerk during global setup and reuses the saved storage state.
- `web/tests/auth` checks the same SDK wiring against a fake clerk-js with no credentials or network: `vp exec playwright test --config tests/auth/playwright.config.ts` from `web/`.
- Protected Convex CLI mutations/actions may still accept `devBypassSecret`, but only from trusted server-side or CLI callers.

Production safety:

- Never expose `AUTH_BYPASS_SECRET` through `VITE_*` env vars or browser code.
- Never set `AUTH_BYPASS_ENABLED=true` in production.
- Rotate `AUTH_BYPASS_SECRET` immediately if it is exposed.
