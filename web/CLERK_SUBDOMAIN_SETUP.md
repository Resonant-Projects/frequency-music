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
