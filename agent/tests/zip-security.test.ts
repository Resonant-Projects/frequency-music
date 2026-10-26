import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extract from "extract-zip";
import { expect, test } from "vite-plus/test";
import { storedZip } from "./fixtures/zip.js";

test("the CLI extractor still extracts ordinary files", async () => {
  const root = await mkdtemp(join(tmpdir(), "extract-safe-"));
  try {
    const archive = join(root, "ordinary.zip");
    await writeFile(
      archive,
      storedZip([{ name: "nested/file.txt", text: "safe" }]),
    );
    await extract(archive, { dir: join(root, "output") });
    expect(await readFile(join(root, "output/nested/file.txt"), "utf8")).toBe(
      "safe",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["symlink-target", "duplicate-entry", "existing-symlink"] as const)(
  "the CLI extractor prevents outside writes via %s",
  async (attack) => {
    const root = await mkdtemp(join(tmpdir(), "extract-attack-"));
    try {
      const output = join(root, "output");
      await mkdir(output);
      const outside = join(root, "outside.txt");
      await writeFile(outside, "unchanged");
      if (attack === "existing-symlink")
        await symlink(outside, join(output, "victim"));
      const entries =
        attack === "existing-symlink"
          ? [{ name: "victim", text: "overwritten" }]
          : [
              { name: "victim", text: "../outside.txt", symlink: true },
              ...(attack === "duplicate-entry"
                ? [{ name: "victim", text: "overwritten" }]
                : []),
            ];
      const archive = join(root, "attack.zip");
      await writeFile(archive, storedZip(entries));
      // Rejecting the archive or safely declining an entry are both acceptable;
      // the security contract is that no write can escape the destination.
      await extract(archive, { dir: output }).catch(() => undefined);
      expect(await readFile(outside, "utf8")).toBe("unchanged");
      if (attack === "symlink-target") {
        // A surviving outward link would let a later consumer write outside.
        await expect(
          readFile(join(output, "victim"), "utf8"),
        ).rejects.toThrow();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
