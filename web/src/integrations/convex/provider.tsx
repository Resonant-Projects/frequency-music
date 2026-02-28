import { ConvexClient } from "convex/browser";
import type { Component, Context, JSX } from "solid-js";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import {
  AuthStateSnapshot,
  ConvexAuthState,
  UseAuthAdapter,
  type AuthTokenFetcher,
} from "./types";
import { safeAccess } from "./utils";

const ConvexClientContext: Context<ConvexClient | undefined> =
  createContext<ConvexClient>();
const ConvexAuthContext = createContext<ConvexAuthState>();

export interface ConvexProviderProps {
  client: ConvexClient;
  useAuth?: UseAuthAdapter;
  children: JSX.Element;
}

export function useConvexClient(): ConvexClient {
  const ctx = useContext(ConvexClientContext);
  if (!ctx) {
    throw new Error("useConvexClient must be used within <ConvexProvider>");
  }
  return ctx;
}

export function useConvexAuth(): ConvexAuthState {
  const ctx = useContext(ConvexAuthContext);
  if (!ctx) {
    throw new Error("useConvexAuth must be used within <ConvexProvider>");
  }
  return ctx;
}

export const ConvexProvider: Component<ConvexProviderProps> = (props) => {
  // In admin-open mode we skip auth wiring and mark as ready.
  const [isConvexAuthenticated, setIsConvexAuthenticated] = createSignal<
    boolean | null
  >(props.useAuth ? null : true);

  let previousAuthState: AuthStateSnapshot | null = null;

  const createAuthAdapter = createMemo(() => {
    if (!props.useAuth) return null;

    return () => {
      const auth = props.useAuth?.();
      if (!auth) return null;

      const fetchAccessToken: AuthTokenFetcher = async ({
        forceRefreshToken,
      }) => {
        try {
          return auth.getToken({
            template: "convex",
            skipCache: forceRefreshToken,
          });
        } catch (error) {
          console.error(
            "fetchAccessToken failed — verify 'convex' JWT template in Clerk dashboard:",
            error,
          );
          return null;
        }
      };

      const isLoaded = safeAccess(auth.isLoaded);
      const isSignedIn = safeAccess(auth.isSignedIn);

      return {
        isLoading: !isLoaded,
        isAuthenticated: isSignedIn ?? false,
        fetchAccessToken,
        orgId: auth.orgId,
        orgRole: auth.orgRole,
      } as const;
    };
  });

  createEffect(() => {
    const adapter = createAuthAdapter();
    if (!adapter) return;

    try {
      const current = adapter();
      if (!current) return;

      const currentAuthState: AuthStateSnapshot = {
        isLoading: current.isLoading,
        isAuthenticated: current.isAuthenticated,
        orgId: current.orgId ? safeAccess(current.orgId) : undefined,
        orgRole: current.orgRole ? safeAccess(current.orgRole) : undefined,
      };

      if (
        JSON.stringify(previousAuthState) === JSON.stringify(currentAuthState)
      ) {
        return;
      }

      if (current.isLoading) {
        setIsConvexAuthenticated(null);
      } else if (current.isAuthenticated) {
        props.client.setAuth(current.fetchAccessToken, (backendAuthed) => {
          setIsConvexAuthenticated(backendAuthed);
        });
      } else {
        props.client.setAuth(async () => null, () => {});
        setIsConvexAuthenticated(false);
      }

      previousAuthState = currentAuthState;
    } catch (error) {
      console.error("Convex auth effect failed:", error);
      setIsConvexAuthenticated(false);
      previousAuthState = null;
    }
  });

  onCleanup(() => {
    try {
      props.client.setAuth(async () => null, () => {});
    } catch (error) {
      console.error("Convex auth cleanup failed:", error);
    }
  });

  const authState = createMemo<ConvexAuthState>(() => ({
    isLoading: isConvexAuthenticated() === null,
    isAuthenticated: isConvexAuthenticated() ?? false,
  }));

  const client = createMemo(() => props.client);

  return (
    <ConvexClientContext.Provider value={client()}>
      <ConvexAuthContext.Provider value={authState()}>
        {props.children}
      </ConvexAuthContext.Provider>
    </ConvexClientContext.Provider>
  );
};
