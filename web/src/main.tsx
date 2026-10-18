import { ConvexClient } from "convex/browser";
import { render } from "solid-js/web";
import App from "./App";
import {
  AppClerkProvider,
  createConvexClerkAuthAdapter,
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

const ConvexApp = () => (
  <ConvexProvider
    client={convexClient}
    useAuth={authBypass ? undefined : createConvexClerkAuthAdapter}
  >
    <App />
  </ConvexProvider>
);

// Children are created lazily, so ConvexProvider's auth adapter reads the
// Clerk context that AppClerkProvider sets up around it.
render(
  () =>
    authBypass ? (
      <ConvexApp />
    ) : (
      <AppClerkProvider>
        <ConvexApp />
      </AppClerkProvider>
    ),
  rootElement,
);
