import type { ConvexClient } from "convex/browser";
import { useClerk } from "@resonant-projects/clerk-solidjs";
import { render } from "solid-js/web";
import { AuthGate } from "../../src/components/auth-gate";
import {
  AppClerkProvider,
  createConvexClerkAuthAdapter,
  useClerkAuthSnapshot,
} from "../../src/integrations/clerk";
import { ConvexProvider } from "../../src/integrations/convex";
import { fixtureLog } from "./clerk-fixture";

type FetchToken = (args: {
  forceRefreshToken: boolean;
}) => Promise<string | null>;

const convexLog = {
  setAuthCalls: 0,
  tokens: [] as (string | null)[],
};

// ConvexProvider only calls `setAuth`; this one fetches a token the way the
// real client does and records it.
const fakeConvexClient = {
  setAuth(fetchToken: FetchToken, onChange: (authed: boolean) => void) {
    convexLog.setAuthCalls += 1;
    void fetchToken({ forceRefreshToken: false }).then((token) => {
      convexLog.tokens.push(token);
      onChange(token !== null);
    });
  },
} as unknown as ConvexClient;

function Probe() {
  const snapshot = useClerkAuthSnapshot();
  const clerk = useClerk();
  return (
    <section>
      <h1>Protected content</h1>
      <p data-testid="user">{snapshot().userId}</p>
      <button type="button" onClick={() => void clerk().signOut()}>
        Sign out
      </button>
    </section>
  );
}

const ConvexApp = () => (
  <ConvexProvider
    client={fakeConvexClient}
    useAuth={createConvexClerkAuthAdapter}
  >
    <AuthGate>
      <Probe />
    </AuthGate>
  </ConvexProvider>
);

Object.assign(window, {
  authFixture: { clerk: fixtureLog, convex: convexLog },
});

render(
  () => (
    <AppClerkProvider>
      <ConvexApp />
    </AppClerkProvider>
  ),
  document.getElementById("app")!,
);
