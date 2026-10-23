import { ConvexClient } from "convex/browser";
import { render } from "solid-js/web";
import App from "./App";
import {
  AppClerkProvider,
  createConvexClerkAuthAdapter,
  localDevSignInBlocked,
} from "./integrations/clerk";
import { ConvexProvider } from "./integrations/convex";
import "./index.css";
import "../styled-system/styles.css";

// Self-hosted fonts (fontsource) — replaces Google Fonts CDN
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

const rootElement = (() => {
  const element = document.getElementById("root");
  if (!(element instanceof HTMLElement)) {
    throw new Error("Root element #root not found");
  }
  return element;
})();

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Define it in web/.env.local to connect via Convex websocket.",
  );
}

const convexClient = new ConvexClient(convexUrl, {
  unsavedChangesWarning: false,
});

const authBypass = import.meta.env.VITE_AUTH_BYPASS === "1";

// A live key on localhost cannot come back from the account portal. Skip
// Clerk startup so the gate can show the local HTTPS URL instead of failing
// the load or redirecting to the production app.
const devSignInBlocked =
  !authBypass &&
  localDevSignInBlocked({
    dev: import.meta.env.DEV,
    publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
    origin: {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
    },
  });

const ConvexApp = () => (
  <ConvexProvider
    client={convexClient}
    useAuth={
      authBypass || devSignInBlocked ? undefined : createConvexClerkAuthAdapter
    }
  >
    <App />
  </ConvexProvider>
);

// Children are created lazily, so ConvexProvider's auth adapter reads the
// Clerk context that AppClerkProvider sets up around it.
render(
  () =>
    authBypass || devSignInBlocked ? (
      <ConvexApp />
    ) : (
      <AppClerkProvider>
        <ConvexApp />
      </AppClerkProvider>
    ),
  rootElement,
);
