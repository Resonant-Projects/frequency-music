import { readdir, readFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";

// convex-test runs every module in one runtime, so it cannot catch this; the
// deploy rejects a query or mutation defined in a "use node" module.
describe("Node-runtime modules", () => {
  test("define only actions", async () => {
    const offenders: string[] = [];
    for (const name of await readdir("convex")) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const source = await readFile(`convex/${name}`, "utf8");
      if (!/^\s*["']use node["'];?/.test(source)) continue;
      if (/=\s*(internal)?(query|mutation|Query|Mutation)\(/.test(source)) {
        offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
