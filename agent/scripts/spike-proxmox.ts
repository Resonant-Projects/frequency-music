import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadRootEnvLocalIfNeeded() {
  if (process.env.PROXMOX_TOKEN_ID && process.env.PROXMOX_TOKEN_SECRET) return;

  const envPath = resolve(process.cwd(), "..", ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key === undefined) continue;
    if (!key.startsWith("PROXMOX_")) continue;
    if (process.env[key]) continue;
    const rawValue = valueParts.join("=").trim();
    process.env[key] = rawValue.replaceAll(/^['"]|['"]$/g, "");
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function proxmoxGet(path: string) {
  const apiUrl =
    process.env.PROXMOX_API_URL ?? "https://prox.rproj.art:8006/api2/json";
  const tokenId = requireEnv("PROXMOX_TOKEN_ID");
  const tokenSecret = requireEnv("PROXMOX_TOKEN_SECRET");

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    tls:
      process.env.PROXMOX_ALLOW_SELF_SIGNED === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  } as RequestInit & { tls?: { rejectUnauthorized: boolean } });

  if (!response.ok) {
    throw new Error(
      `Proxmox API ${path} failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as { data?: unknown };
}

loadRootEnvLocalIfNeeded();

const [version, nodes] = await Promise.all([
  proxmoxGet("/version"),
  proxmoxGet("/nodes"),
]);

const nodeSummaries = Array.isArray(nodes.data)
  ? nodes.data.map((node) => {
      const record = node as Record<string, unknown>;
      return {
        node: record.node,
        status: record.status,
        cpu: record.cpu,
        maxcpu: record.maxcpu,
        mem: record.mem,
        maxmem: record.maxmem,
      };
    })
  : [];

console.log(
  JSON.stringify(
    {
      ok: true,
      version: (version.data as Record<string, unknown> | undefined)?.version,
      nodes: nodeSummaries,
    },
    null,
    2,
  ),
);
