import { createEffect, type JSX, Match, Switch } from "solid-js";
import {
  buildHostedSignInUrl,
  CLERK_PRODUCTION_APEX,
  localDevSignInBlocked,
  localDevSignInUrl,
  useClerkAuthSnapshot,
} from "../integrations/clerk";
import { UIBadge, UICard } from "./ui";

const authBypass = import.meta.env.VITE_AUTH_BYPASS === "1";

function pageOrigin() {
  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    port: window.location.port,
  };
}

function configuredSignInHost(): string {
  const signInUrl = import.meta.env.VITE_CLERK_SIGN_IN_URL;
  if (!signInUrl) return "the sign-in host";
  try {
    return new URL(signInUrl).host;
  } catch {
    return "the sign-in host";
  }
}

function AuthNotice(props: { title: string; children: JSX.Element }) {
  return (
    <div class="route-placeholder">
      <UICard class="route-placeholder-card">
        <UIBadge tone="violet">Authentication</UIBadge>
        <h1>{props.title}</h1>
        <p>{props.children}</p>
      </UICard>
    </div>
  );
}

/**
 * Renders its children only for a signed-in user, and sends anyone else to
 * the hosted Clerk sign-in page with a return URL.
 */
export function AuthGate(props: { children: JSX.Element }) {
  const auth = useClerkAuthSnapshot();
  const signInBlocked = () =>
    localDevSignInBlocked({
      dev: import.meta.env.DEV,
      publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
      origin: pageOrigin(),
    });

  createEffect(() => {
    if (authBypass || signInBlocked()) return;
    const state = auth();
    if (!state.isLoaded || state.isSignedIn) return;

    const returnTo = window.location.href;
    window.location.assign(buildHostedSignInUrl(returnTo));
  });

  // Clerk loads after the first render, so the gate has to stay reactive.
  // Nothing renders while it loads, as before the SDK held the render back.
  return (
    <Switch>
      <Match when={authBypass || auth().isSignedIn}>{props.children}</Match>
      <Match when={signInBlocked()}>
        <AuthNotice title="Sign in on the local host">
          Production Clerk returns to this app from an HTTPS subdomain of{" "}
          {CLERK_PRODUCTION_APEX} on port 443. Open{" "}
          <a href={localDevSignInUrl(window.location)}>
            {localDevSignInUrl(window.location)}
          </a>{" "}
          to finish sign-in on this page.
        </AuthNotice>
      </Match>
      <Match when={auth().failed}>
        <AuthNotice title="Sign-in is unavailable">
          Clerk could not load, so the app can&apos;t confirm who you are.
          Reload the page to try again.
        </AuthNotice>
      </Match>
      <Match when={auth().isLoaded}>
        <AuthNotice title="Redirecting to sign in...">
          This app requires authentication. You&apos;ll be redirected to{" "}
          {configuredSignInHost()}.
        </AuthNotice>
      </Match>
    </Switch>
  );
}
