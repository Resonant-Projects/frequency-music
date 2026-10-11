import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { assertNewSources, reservedSources } from "./history";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "essay-history-"));
  roots.push(root);
  return root;
}
async function batch(
  root: string,
  name: string,
  voice: string,
  source: string,
) {
  await mkdir(join(root, name));
  await writeFile(
    join(root, name, "manifest.json"),
    JSON.stringify({ entries: [{ source, voice }] }),
  );
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("unpublished trials reserve an essay across voices; its original batch can resume", async () => {
  const root = await fixture();
  const source = "docs/essays/the-listening-gap.md";
  await batch(root, "nandi-trial", "cartesia-nandi", source);
  const reserved = await reservedSources(root, "elevenlabs-next");
  expect(() => assertNewSources([source], new Set(), reserved)).toThrow(
    "nandi-trial",
  );
  expect(() => assertNewSources([source], new Set(), new Map())).not.toThrow();
  expect(await reservedSources(root, "nandi-trial")).toEqual(new Map());
});

test("publication history blocks repeats independently of local batches", () => {
  const source = "docs/essays/old-episode.md";
  expect(() =>
    assertNewSources([source], new Set([source]), new Map()),
  ).toThrow("already published");
});

test("repeated source paths in one batch are rejected", () => {
  expect(() =>
    assertNewSources(
      ["docs/essays/a.md", "docs/essays/./a.md"],
      new Set(),
      new Map(),
    ),
  ).toThrow("repeated within batch");
});

test("fresh output and artifact directories without manifests are allowed", async () => {
  const root = await fixture();
  expect(await reservedSources(join(root, "missing"))).toEqual(new Map());
  await mkdir(join(root, "comparison"));
  expect(await reservedSources(root)).toEqual(new Map());
});

test("corrupt history fails closed instead of permitting duplicate spending", async () => {
  const root = await fixture();
  await mkdir(join(root, "broken"));
  await writeFile(join(root, "broken", "manifest.json"), "{");
  await expect(reservedSources(root)).rejects.toThrow(
    join(root, "broken", "manifest.json"),
  );
});

test.each([
  "null",
  "{}",
  "[]",
  '{"entries":{}}',
  '{"entries":[null]}',
  '{"entries":[{}]}',
  '{"entries":[{"source":42}]}',
  '{"entries":[{"source":" "}]}',
])("invalid manifest shape reports its file: %s", async (raw) => {
  const root = await fixture();
  await mkdir(join(root, "broken"));
  const path = join(root, "broken", "manifest.json");
  await writeFile(path, raw);
  await expect(reservedSources(root)).rejects.toThrow(path);
});
