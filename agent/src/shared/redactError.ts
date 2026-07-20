export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*["']?\s*[=:]\s*)(["'])(?:\\.|(?!\2)[^\r\n\\])*\2/gi,
      "$1$2[REDACTED]$2",
    )
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
}
