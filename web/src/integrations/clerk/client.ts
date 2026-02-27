import { Clerk } from "@clerk/clerk-js";
import { createSignal } from "solid-js";
import type { AuthAdapter } from "../convex";

interface ClerkAuthSnapshot {
  isLoaded: boolean;
  isSignedIn: boolean;
  orgId: string | null;
  orgRole: string | null;
}

const [authSnapshot, setAuthSnapshot] = createSignal<ClerkAuthSnapshot>({
  isLoaded: false,
  isSignedIn: false,
  orgId: null,
  orgRole: null,
});

let clerkClient: Clerk | null = null;

function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function updateAuthSnapshotFromClerk(clerk: Clerk) {
  const organizationMembership = clerk.organizationMembership;

  setAuthSnapshot({
    isLoaded: clerk.loaded,
    isSignedIn: !!clerk.user && !!clerk.session,
    orgId: clerk.organization?.id ?? null,
    orgRole: organizationMembership?.role ?? null,
  });
}

export async function initializeClerk() {
  const publishableKey = getRequiredEnv("VITE_CLERK_PUBLISHABLE_KEY");

  const clerk = new Clerk(publishableKey);
  await clerk.load({
    signInUrl: import.meta.env.VITE_CLERK_SIGN_IN_URL,
    signUpUrl: import.meta.env.VITE_CLERK_SIGN_UP_URL,
    afterSignInUrl: import.meta.env.VITE_CLERK_AFTER_SIGN_IN_URL ?? "/",
    afterSignUpUrl: import.meta.env.VITE_CLERK_AFTER_SIGN_UP_URL ?? "/",
  });

  clerk.addListener(() => {
    updateAuthSnapshotFromClerk(clerk);
  });

  clerkClient = clerk;
  updateAuthSnapshotFromClerk(clerk);
}

export function createConvexClerkAuthAdapter(): AuthAdapter {
  return {
    isLoaded: () => authSnapshot().isLoaded,
    isSignedIn: () => authSnapshot().isSignedIn,
    getToken: async ({ template, skipCache }) => {
      if (!clerkClient?.session) return null;
      return clerkClient.session.getToken({
        template,
        skipCache,
      });
    },
    orgId: () => authSnapshot().orgId,
    orgRole: () => authSnapshot().orgRole,
  };
}

export function useClerkAuthSnapshot() {
  return authSnapshot;
}

export function buildHostedSignInUrl(returnTo: string): string {
  const signInUrl = getRequiredEnv("VITE_CLERK_SIGN_IN_URL");
  const url = new URL(signInUrl);
  url.searchParams.set("redirect_url", returnTo);
  return url.toString();
}
