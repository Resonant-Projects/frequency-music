/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_E2E_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
