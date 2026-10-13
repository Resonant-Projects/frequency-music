/** Platform wire parsing only. Domain validation and authority belong to apply. */
export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseDecisionCallback(value: unknown) {
  if (typeof value !== "string") return null;
  const match =
    /^([a-zA-Z0-9_-]{1,40}):(confirm:([a-f0-9]{8})|cancel)$(?![\s\S])/.exec(
      value,
    );
  if (!match) return null;
  const intentId = match[1]!;
  return match[2] === "cancel"
    ? { intentId, verb: "cancel" as const }
    : { intentId, verb: "confirm" as const, digest8: match[3]! };
}

export function parseDecisionCode(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(confirm|cancel) (D-[1-9][0-9]{0,15})$(?![\s\S])/.exec(value);
  return match
    ? {
        verb:
          match[1] === "confirm" ? ("confirm" as const) : ("cancel" as const),
        code: match[2]!,
      }
    : null;
}

export function discordId(value: unknown): string | null {
  return typeof value === "string" && /^[1-9][0-9]{0,19}$(?![\s\S])/.test(value)
    ? value
    : null;
}

export function telegramId(value: unknown, signed = false): string | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    (signed ? value !== 0 : value > 0)
    ? String(value)
    : null;
}

/** Bound bytes before JSON decoding; never include the body in errors. */
export async function readSignerBody(
  request: Request,
): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function decodeSignerBody(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
