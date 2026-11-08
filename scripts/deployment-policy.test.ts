import { readFileSync, readdirSync } from "node:fs";
import { matchesGlob } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const config = JSON.parse(read("web/vercel.json"));

describe("Vercel Git deployment policy", () => {
  it("blocks only Renovate and verification-only branch namespaces", () => {
    expect(config.git.deploymentEnabled).toEqual({
      "renovate/**": false,
      "docs/verify-*": false,
    });
    // These two simple glob forms have the same semantics as Vercel minimatch.
    const deploys = (branch: string) =>
      !Object.keys(config.git.deploymentEnabled).some((pattern) =>
        matchesGlob(branch, pattern),
      );
    for (const branch of [
      "renovate/convex-dependencies",
      "renovate/major/node-26.x",
      "docs/verify-frequency-music",
    ]) {
      expect(deploys(branch), branch).toBe(false);
    }
    for (const branch of [
      "main",
      "production",
      "release/2026-11",
      "feat/preview-player",
      "docs/current-setup-contracts",
      "fix/scout-cloudflare-verification-wall",
      "t3code/verify-wave-one-next-steps",
    ]) {
      expect(deploys(branch), branch).toBe(true);
    }
  });

  it("keeps the web bundle build in CI without a deployment", () => {
    const ci = read(".github/workflows/ci.yml");
    const web = ci.split("  web:")[1]?.split("  agent:")[0] ?? "";
    expect(web).toContain("run: vpx tsc --noEmit");
    expect(web).toContain("run: vp run build -- --mode verification");
    expect(web).toContain('VITE_AUTH_BYPASS: "1"');
    expect(web).toContain('VITE_E2E_MODE: "0"');
    expect(web).toContain("VITE_CONVEX_URL: http://127.0.0.1:9");
    expect(web).not.toMatch(/continue-on-error|vercel deploy|convex deploy/);
  });

  it("preserves podcast and SPA routing", () => {
    expect(config.rewrites).toEqual([
      {
        source: "/podcast/:token/feed.xml",
        destination: "https://listen.rproj.art/podcast/:token/feed.xml",
      },
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });
});

describe("Node runtime policy", () => {
  it("pins local tools, CI, and Vercel to Node 26", () => {
    expect(read(".node-version").trim()).toBe("26");
    for (const path of [
      "package.json",
      "web/package.json",
      "media/package.json",
    ]) {
      expect(JSON.parse(read(path)).engines.node, path).toBe("26.x");
    }
    const workflows = readdirSync(new URL(".github/workflows/", root))
      .filter((name) => name.endsWith(".yml"))
      .map((name) => read(`.github/workflows/${name}`))
      .join("\n");
    const versions = [...workflows.matchAll(/node-version:\s*"([^"\n]+)"/g)];
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.every((match) => match[1] === "26")).toBe(true);
  });

  it("keeps worker images on digest-pinned Node 26", () => {
    for (const path of ["agent/Dockerfile", "media/Dockerfile"]) {
      const images = [...read(path).matchAll(/^ARG \w*NODE_IMAGE=(.+)$/gm)];
      expect(images.length, path).toBeGreaterThan(0);
      for (const [, image] of images) {
        expect(image).toMatch(/^node:26\.\d+\.\d+-[^@]+@sha256:[a-f0-9]{64}$/);
      }
    }
  });

  it("documents the pinned LangGraph CLI's Node 24 exception", () => {
    expect(JSON.parse(read("agent/langgraph.json")).node_version).toBe("24");
    expect(JSON.parse(read("agent/package.json")).engines.node).toBe(
      "24.x || 26.x",
    );
  });
});
