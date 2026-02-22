import type { Accessor } from "solid-js";

export type AuthTokenFetcher = (args: {
  forceRefreshToken: boolean;
}) => Promise<string | null>;

export interface AuthAdapter {
  isLoaded: boolean | Accessor<boolean>;
  isSignedIn: boolean | undefined | Accessor<boolean | undefined>;
  getToken: (opts: {
    template?: string;
    skipCache?: boolean;
  }) => Promise<string | null>;
  orgId?: string | null | Accessor<string | null>;
  orgRole?: string | null | Accessor<string | null>;
}

export type UseAuthAdapter = () => AuthAdapter;

export interface ConvexAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthStateSnapshot {
  isLoading: boolean;
  isAuthenticated: boolean;
  orgId: string | null | undefined;
  orgRole: string | null | undefined;
}
