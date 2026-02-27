import { ConvexClient } from "convex/browser";
import { render } from "solid-js/web";
import App from "./App";
import { ConvexProvider } from "./integrations/convex";
import {
  createConvexClerkAuthAdapter,
  initializeClerk,
} from "./integrations/clerk";
import "./index.css";
import "../styled-system/styles.css";

// Self-hosted fonts (fontsource) — replaces Google Fonts CDN
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/400-italic.css";
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/400-italic.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Define it in web/.env.local to connect via Convex websocket.",
  );
}

const convexClient = new ConvexClient(convexUrl, {
  unsavedChangesWarning: false,
});

async function bootstrap() {
  await initializeClerk();

  render(
    () => (
      <ConvexProvider client={convexClient} useAuth={createConvexClerkAuthAdapter}>
        <App />
      </ConvexProvider>
    ),
    root,
  );
}

void bootstrap().catch((error) => {
  console.error("Failed to initialize app auth:", error);
  throw error;
});
