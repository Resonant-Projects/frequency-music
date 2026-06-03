"use node";
import { traceable } from "langsmith/traceable";

export function tracedGenerate<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  if (process.env.LANGSMITH_TRACING !== "true") {
    return fn();
  }
  try {
    const wrapped = traceable(fn, { name, metadata });
    return wrapped() as Promise<T>;
  } catch (e) {
    console.warn(`[langsmith] trace setup failed for ${name}:`, e);
    return fn();
  }
}
