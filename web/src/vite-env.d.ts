/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_CLERK_SIGN_IN_URL: string;
  readonly VITE_CLERK_SIGN_UP_URL: string;
  readonly VITE_CLERK_AFTER_SIGN_IN_URL?: string;
  readonly VITE_CLERK_AFTER_SIGN_UP_URL?: string;
  readonly VITE_AUTH_BYPASS?: string;
  readonly VITE_AUTH_BYPASS_SECRET?: string;
  readonly VITE_E2E_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
