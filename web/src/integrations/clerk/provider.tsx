import { Clerk } from "@clerk/clerk-js/no-rhc";
import {
  ClerkProvider,
  useAuth,
  useClerk,
} from "@resonant-projects/clerk-solidjs";
import type { Accessor, JSX } from "solid-js";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import type { AuthAdapter } from "../convex";

interface ClerkAuthSnapshot {
  isLoaded: boolean;
  /** clerk-js could not load, e.g. the Frontend API rejected the origin. */
  failed: boolean;
  isSignedIn: boolean;
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
}

interface ClerkAuthContextValue {
  snapshot: Accessor<ClerkAuthSnapshot>;
  getToken: AuthAdapter["getToken"];
}

const UNLOADED_SNAPSHOT: ClerkAuthSnapshot = {
  isLoaded: false,
  failed: false,
  isSignedIn: false,
  userId: null,
  orgId: null,
  orgRole: null,
};

// Under VITE_AUTH_BYPASS no AppClerkProvider is mounted: auth never loads and
// no token is issued, and callers check the bypass flag before reading it.
const ClerkAuthContext = createContext<ClerkAuthContextValue>({
  snapshot: () => UNLOADED_SNAPSHOT,
  getToken: () => Promise.resolve(null),
});

function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function ClerkAuthBridge(props: { children: JSX.Element }) {
  // Keep a session with pending tasks signed in, as the app treated it before
  // the SDK; the hosted Clerk pages own those tasks.
  const auth = useAuth({ treatPendingAsSignedOut: false });
  const clerk = useClerk();
  const [failed, setFailed] = createSignal(false);

  createEffect(() => {
    const instance = clerk();
    const onStatus = (status: string) => setFailed(status === "error");
    instance.on("status", onStatus, { notify: true });
    onCleanup(() => instance.off("status", onStatus));
  });

  const snapshot = createMemo<ClerkAuthSnapshot>(() => ({
    isLoaded: auth.isLoaded(),
    failed: failed(),
    isSignedIn: auth.isSignedIn() ?? false,
    userId: auth.userId() ?? null,
    orgId: auth.orgId() ?? null,
    orgRole: auth.orgRole() ?? null,
  }));

  return (
    <ClerkAuthContext.Provider
      value={{
        snapshot,
        getToken: ({ template, skipCache }) =>
          auth.getToken({ template, skipCache }),
      }}
    >
      {props.children}
    </ClerkAuthContext.Provider>
  );
}

export function AppClerkProvider(props: { children: JSX.Element }) {
  // Sign-in and sign-up live on the hosted Clerk pages, so the app only needs
  // session management. Passing the bundled no-rhc build keeps clerk-js off
  // Clerk's CDN and omits remote wallet/payment scripts; `prefetchUI={false}`
  // skips loading Clerk's component UI.
  return (
    <ClerkProvider
      Clerk={Clerk}
      publishableKey={getRequiredEnv("VITE_CLERK_PUBLISHABLE_KEY")}
      prefetchUI={false}
      signInUrl={import.meta.env.VITE_CLERK_SIGN_IN_URL}
      signUpUrl={import.meta.env.VITE_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={
        import.meta.env.VITE_CLERK_AFTER_SIGN_IN_URL ?? "/"
      }
      signUpFallbackRedirectUrl={
        import.meta.env.VITE_CLERK_AFTER_SIGN_UP_URL ?? "/"
      }
    >
      <ClerkAuthBridge>{props.children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function createConvexClerkAuthAdapter(): AuthAdapter {
  const { snapshot, getToken } = useContext(ClerkAuthContext);
  return {
    isLoaded: () => snapshot().isLoaded,
    isSignedIn: () => snapshot().isSignedIn,
    getToken,
    orgId: () => snapshot().orgId,
    orgRole: () => snapshot().orgRole,
  };
}

export function useClerkAuthSnapshot() {
  return useContext(ClerkAuthContext).snapshot;
}

export function buildHostedSignInUrl(returnTo: string): string {
  const signInUrl = getRequiredEnv("VITE_CLERK_SIGN_IN_URL");
  const url = new URL(signInUrl);
  url.searchParams.set("redirect_url", returnTo);
  return url.toString();
}
