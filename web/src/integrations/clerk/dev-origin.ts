/**
 * Production Clerk only returns a signed-in browser to the instance domain,
 * over HTTPS, with no port in the Origin header. Localhost fails that check
 * and the account portal falls back to the production app.
 *
 * The apex is the live instance: app and accounts are on resonantprojects.art,
 * and the publishable key's frontend API is clerk.resonantprojects.art.
 */
export const CLERK_PRODUCTION_APEX = "resonantprojects.art";

export const CLERK_LOCAL_DEV_HOST = `local.${CLERK_PRODUCTION_APEX}`;

export const CLERK_LOCAL_DEV_ORIGIN = `https://${CLERK_LOCAL_DEV_HOST}`;

export interface PageOrigin {
  protocol: string;
  hostname: string;
  port: string;
}

export function productionClerkAcceptsOrigin(
  origin: PageOrigin,
  publishableKey: string,
): boolean {
  if (!publishableKey.startsWith("pk_live_")) return true;
  if (origin.protocol !== "https:") return false;
  // An explicit port is included in Origin, which production Clerk rejects.
  if (origin.port !== "") return false;
  const host = origin.hostname.toLowerCase();
  return (
    host === CLERK_PRODUCTION_APEX || host.endsWith(`.${CLERK_PRODUCTION_APEX}`)
  );
}

export function localDevSignInBlocked(options: {
  dev: boolean;
  publishableKey: string;
  origin: PageOrigin;
}): boolean {
  if (!options.dev) return false;
  if (!options.publishableKey.startsWith("pk_live_")) return false;
  return !productionClerkAcceptsOrigin(options.origin, options.publishableKey);
}

export function localDevSignInUrl(page: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  return `${CLERK_LOCAL_DEV_ORIGIN}${page.pathname}${page.search}${page.hash}`;
}
