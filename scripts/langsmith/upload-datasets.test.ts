import { readFileSync } from "node:fs";
import { expect, test, vi } from "vite-plus/test";

// Every dependency with side effects is mocked: Varlock resolves no secret,
// the LangSmith client makes no request, and no golden file is read, so
// importing the script performs no upload.
const { events, client } = vi.hoisted(() => ({
  events: [] as string[],
  client: {
    readDataset: vi.fn(),
    createDataset: vi.fn(),
    listExamples: vi.fn(),
    createExample: vi.fn(),
  },
}));
vi.mock("varlock/auto-load", () => {
  events.push("varlock");
  return {};
});
vi.mock("langsmith", () => ({
  Client: class {
    constructor() {
      events.push("client");
      Object.assign(this, client);
    }
  },
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  }),
}));

test("varlock/auto-load is the script's first import", () => {
  const source = readFileSync(
    new URL("./upload-datasets.ts", import.meta.url),
    "utf8",
  );
  const firstImport = source.match(/^import .*$/m)?.[0];
  expect(firstImport).toBe('import "varlock/auto-load";');
});

test("env loads before the client is built, and no upload runs", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await import("./upload-datasets");
  expect(events).toEqual(["varlock", "client"]);
  for (const method of Object.values(client)) {
    expect(method).not.toHaveBeenCalled();
  }
});
