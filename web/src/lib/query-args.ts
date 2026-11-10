import { stableStringify } from "../../../convex/shared/stableHash";

/** True when two Convex argument values serialize identically. */
export function sameQueryArgs(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return stableStringify(a) === stableStringify(b);
  } catch {
    return false;
  }
}
