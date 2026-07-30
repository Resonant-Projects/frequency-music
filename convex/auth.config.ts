import type { AuthConfig } from "convex/server";

// Evaluated during `convex deploy`, so throwing here turns a missing issuer
// into an immediate deploy failure rather than opaque token-verification
// errors at request time.
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!domain) {
  throw new Error(
    "CLERK_JWT_ISSUER_DOMAIN is required — set it with `vpx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer-url>`",
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
