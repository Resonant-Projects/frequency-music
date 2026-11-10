import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("public editorial export workflow", () => {
  const workflow = read(".github/workflows/public-editorial-export.yml");

  test("does not expose the Convex deploy key to the job", () => {
    expect(workflow).not.toContain("CONVEX_DEPLOY_KEY");
  });

  test("runs only from main", () => {
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  });
});

describe("media image publish workflow", () => {
  const workflow = read(".github/workflows/publish-media-image.yml");

  test("publishes only from main", () => {
    expect(workflow).toContain(
      "if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'",
    );
  });

  test("confirms the requested source commit is on main", () => {
    expect(workflow).toContain("Confirm the published source is on main");
  });
});

describe("CI workflow", () => {
  const workflow = read(".github/workflows/ci.yml");

  test("grants only read access to repository contents", () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  test("typechecks the root package", () => {
    expect(workflow).toContain("- run: vp run typecheck:scripts");
  });

  test("runs the file size check", () => {
    expect(workflow).toContain(
      "- run: node scripts/check-file-tokens.mjs --all",
    );
  });
});
