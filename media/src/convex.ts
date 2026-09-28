// Thin HTTP client for /agent-tools/*. The secret travels in the body, as the
// worker does; error text never includes it.
export async function callTool<T>(
  name: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const base = process.env.CONVEX_SITE_URL;
  const secret = process.env.AGENT_TOOL_SECRET;
  if (!base) throw new Error("CONVEX_SITE_URL is required");
  if (!secret) throw new Error("AGENT_TOOL_SECRET is required");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/agent-tools/${name}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, ...body }),
      // The secret is in the body; never let a redirect carry it to another
      // host or scheme.
      redirect: "error",
      signal: signal ?? AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) {
    const text = (await response.text())
      .replaceAll(secret, "[REDACTED]")
      .slice(0, 500);
    throw new Error(`Convex tool ${name} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}
