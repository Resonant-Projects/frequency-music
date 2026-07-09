/**
 * One Jina Reader fetch and one text-cap rule for every script.
 * Replaces divergent hand-rolled copies with a single interface.
 */

export const MIN_TEXT_LENGTH = 100;
export const TEXT_CAP = 200_000;

export type FetchResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function fetchViaJina(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<FetchResult> {
  const { timeoutMs = 30_000, fetchImpl = fetch } = opts;
  try {
    const response = await fetchImpl(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, error: `Jina fetch failed: ${response.status}` };
    }
    return { ok: true, text: (await response.text()).trim() };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function capText(
  text: string,
  cap: number = TEXT_CAP,
): string | undefined {
  if (text.length < MIN_TEXT_LENGTH) return undefined;
  return text.slice(0, cap);
}
