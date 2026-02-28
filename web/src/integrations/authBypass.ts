const AUTH_BYPASS_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === "1";

export function isLocalAuthBypassEnabled() {
  return AUTH_BYPASS_ENABLED;
}

export function getLocalAuthBypassSecret() {
  return import.meta.env.VITE_AUTH_BYPASS_SECRET;
}

export function withDevBypassSecret<T extends Record<string, unknown>>(
  args: T,
): T & { devBypassSecret?: string } {
  if (!AUTH_BYPASS_ENABLED) return args;

  const secret = getLocalAuthBypassSecret();
  if (!secret) {
    throw new Error(
      "Missing VITE_AUTH_BYPASS_SECRET while VITE_AUTH_BYPASS is enabled",
    );
  }

  return {
    ...args,
    devBypassSecret: secret,
  };
}
