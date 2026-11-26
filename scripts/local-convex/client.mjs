import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";

export const repo = fileURLToPath(new URL("../../", import.meta.url));
export function runDirectory(run) {
  if (!/^[a-z0-9][a-z0-9-]{0,45}$/.test(run ?? ""))
    throw new Error("Invalid local run id");
  return resolve(repo, "web/artifacts/local-convex", run);
}
export function readRun(run) {
  const directory = runDirectory(run);
  const info = JSON.parse(
    readFileSync(resolve(directory, "instance.json"), "utf8"),
  );
  if (info.repo !== repo.replace(/\/$/, "") || info.run !== run)
    throw new Error("Foreign run");
  for (const key of ["backend", "site", "frontend"]) {
    if (
      !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(info[key]) ||
      Number(info[key].split(":").at(-1)) > 65535
    )
      throw new Error("Only localhost origins are accepted");
  }
  return { directory, info };
}
/** Synthetic identity role: admin (default journeys), follower, or none (no users row). */
export function localRole() {
  const role = process.env.LOCAL_CONVEX_ROLE ?? "admin";
  if (!["admin", "follower", "none"].includes(role))
    throw new Error("Invalid LOCAL_CONVEX_ROLE");
  return role;
}
export function localClient(run, identity) {
  const { directory, info } = readRun(run);
  const key = readFileSync(resolve(directory, "local-admin-key"), "utf8");
  const client = new ConvexHttpClient(info.backend);
  client.setAdminAuth(key, identity);
  return client;
}
