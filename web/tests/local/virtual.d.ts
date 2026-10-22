declare module "virtual:local-convex-identity" {
  import type { UserIdentityAttributes } from "convex/server";
  export const endpoint: string;
  export const key: string;
  export const identity: UserIdentityAttributes;
}
