import { redactError } from "./redactError";
import { fnv1a64Hex } from "./stableHash";

/** Known transient causes share diagnosis; unknown redacted messages stay distinct. */
export function failureCause(error: string) {
  if (
    /\b(?:401|403)\b|unauthori[sz]ed|forbidden|authentication|invalid.api.key/i.test(
      error,
    )
  )
    return "authentication";
  if (/\b429\b|rate.limit|too many requests/i.test(error)) return "rate_limit";
  if (/timed? ?out|timeout|deadline/i.test(error)) return "timeout";
  if (/\b(?:500|502|503|504)\b|service unavailable|bad gateway/i.test(error))
    return "provider_unavailable";
  if (/network|connection|fetch failed|ECONN/i.test(error)) return "network";
  return fnv1a64Hex(redactError(error).trim().toLowerCase());
}
