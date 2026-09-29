import { z } from "zod";

const configZ = z.object({
  convexSiteUrl: z.url(),
  agentToolSecret: z.string().min(1),
  workerId: z.string().min(1),
  pollIntervalMs: z.number().int().min(1000),
  kinds: z.array(z.string().min(1)).min(1),
  workDir: z.string().min(1),
  rendererVersion: z.string().min(1),
});
export type MediaConfig = z.infer<typeof configZ>;

export const RENDERER_VERSION = "0.2.0";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MediaConfig {
  // AGENT_TOOL_SECRET travels in every request body, so the transport must be
  // TLS. Plain http is allowed only by explicit opt-in for a private LAN.
  let siteUrl: URL;
  try {
    siteUrl = new URL(env.CONVEX_SITE_URL ?? "");
  } catch {
    throw new Error("CONVEX_SITE_URL must be a valid URL");
  }
  const insecureAllowed =
    siteUrl.protocol === "http:" && env.MEDIA_ALLOW_INSECURE_CONVEX === "true";
  if (siteUrl.protocol !== "https:" && !insecureAllowed) {
    throw new Error(
      "CONVEX_SITE_URL must use https (set MEDIA_ALLOW_INSECURE_CONVEX=true only for a private network)",
    );
  }
  return configZ.parse({
    convexSiteUrl: env.CONVEX_SITE_URL,
    agentToolSecret: env.AGENT_TOOL_SECRET,
    workerId: env.MEDIA_WORKER_ID ?? "media-local",
    pollIntervalMs: Number(env.MEDIA_POLL_INTERVAL_MS ?? 15000),
    kinds: (env.MEDIA_JOB_KINDS ?? "probe")
      .split(",")
      .map((kind) => kind.trim())
      .filter(Boolean),
    workDir: env.MEDIA_WORK_DIR ?? "/tmp/frequency-media",
    rendererVersion: RENDERER_VERSION,
  });
}
