export function log(message: string, ...rest: unknown[]): void {
  console.log(`[media] ${message}`, ...rest);
}

const SECRET_PATTERN = /(secret|token|key)=?[^\s]*/gi;

export function redactError(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replaceAll(SECRET_PATTERN, "$1=[REDACTED]");
}
