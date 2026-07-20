export function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(
      /((?:api[_-]?key|secret|token|password|passwd)\s*[=:]\s*)[^\s"'}]+/gi,
      "$1[REDACTED]",
    )
    .replaceAll(/(PVEAPIToken=)[^\s"'}]+/gi, "$1[REDACTED]");
}
