// Only the local verification Vite config resolves this private virtual module.
// It cannot be selected by the product bootstrap.
import { ConvexClient } from "convex/browser";
import { render } from "solid-js/web";
import App from "../../src/App";
import { ConvexProvider } from "../../src/integrations/convex";
import { endpoint, key, identity } from "virtual:local-convex-identity";
import "../../src/index.css";
import "../../styled-system/styles.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/jetbrains-mono/400.css";

if (!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(endpoint))
  throw new Error("Local backend required");
const client = new ConvexClient(endpoint, { unsavedChangesWarning: false });
client.setAdminAuth(key, identity);
render(
  () => (
    <ConvexProvider client={client}>
      <App />
    </ConvexProvider>
  ),
  document.getElementById("root")!,
);
