import { traceable } from "langsmith/traceable";

type EnvLike = Record<string, string | undefined>;

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

export function isLangSmithTracingEnabled(env: EnvLike = process.env): boolean {
  const tracing = env.LANGSMITH_TRACING?.toLowerCase().trim();
  return Boolean(tracing && TRUE_VALUES.has(tracing) && env.LANGSMITH_API_KEY);
}

export function buildLangSmithMetadata(
  runName: string,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      workflow: "resonant-research-pipeline",
      runName,
      ...metadata,
    }).filter(([, value]) => value !== undefined),
  );
}

/**
 * Wrap an async LLM call with LangSmith tracing when enabled.
 *
 * Tracing is intentionally best-effort: LangSmith setup failures should never
 * break extraction, hypothesis, recipe, or brief generation.
 */
export function tracedGenerate<T>(
  name: string,
  fn: () => Promise<T>,
  metadata: Record<string, unknown> = {},
): Promise<T> {
  if (!isLangSmithTracingEnabled()) {
    return fn();
  }

  try {
    const wrapped = traceable(fn, {
      name,
      metadata: buildLangSmithMetadata(name, metadata),
    });
    return wrapped();
  } catch (error) {
    console.warn(`[langsmith] trace setup failed for ${name}:`, error);
    return fn();
  }
}
