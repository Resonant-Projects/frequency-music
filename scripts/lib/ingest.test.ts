import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { type MinimalClient, createSourceIngestor } from "./ingest";

type Call = {
  kind: "query" | "mutation";
  name: string;
  args: Record<string, unknown>;
};

const savedBypass = process.env.AUTH_BYPASS_SECRET;

beforeEach(() => {
  process.env.AUTH_BYPASS_SECRET = String(Date.now());
});

afterEach(() => {
  if (savedBypass === undefined) Reflect.deleteProperty(process.env, "AUTH_BYPASS_SECRET");
  else process.env.AUTH_BYPASS_SECRET = savedBypass;
});

function fakeClient(
  handlers: Record<string, (args: Record<string, unknown>) => unknown>,
) {
  const calls: Call[] = [];
  const dispatch =
    (kind: "query" | "mutation") =>
    (_ref: unknown, args: Record<string, unknown>) => {
      const name =
        "dedupeKey" in args && kind === "query"
          ? "sources:getByDedupeKey"
          : "status" in args && kind === "query"
            ? "sources:listByStatus"
            : "rawText" in args && kind === "mutation" && "id" in args
              ? "sources:updateText"
              : "transcript" in args && kind === "mutation" && "id" in args
                ? "sources:updateText"
                : "status" in args && kind === "mutation"
                  ? "sources:updateStatus"
                  : "sources:create";
      calls.push({ kind, name, args });
      const handler = handlers[name];
      if (!handler) throw new Error(`no fake handler for ${name}`);
      return Promise.resolve().then(() => handler(args));
    };
  const client = {
    query: dispatch("query"),
    mutation: dispatch("mutation"),
  } as unknown as MinimalClient;
  return { client, calls };
}

describe("ingest", () => {
  test("skips existing, creates new, applies capText, counts correctly", async () => {
    const { client, calls } = fakeClient({
      "sources:getByDedupeKey": (args) =>
        args.dedupeKey === "url:a.example" ? { _id: "s1" } : null,
      "sources:create": () => ({ id: "s2", created: true }),
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: () =>
        Promise.resolve({ ok: true as const, text: "T".repeat(150) }),
      log: () => {},
    });
    const summary = await ingestor.ingest([
      {
        type: "url",
        title: "Old",
        url: "https://a.example",
      },
      {
        type: "url",
        title: "New",
        url: "https://b.example",
      },
      {
        type: "pdf",
        title: "Short text",
        fileSha256: "short-sha",
        rawText: "tiny",
      },
    ]);
    expect(summary).toEqual({ created: 2, skipped: 1, failed: 0 });
    const creates = calls.filter((call) => call.name === "sources:create");
    expect(creates.length).toBe(2);
    expect((creates[0]!.args.rawText as string).length).toBe(150);
    expect(creates[1]!.args.rawText).toBeUndefined();
    expect(creates[0]!.args.devBypassSecret).toBeDefined();
    expect(creates.map((call) => call.args.dedupeKey)).toEqual([
      "url:b.example",
      "pdf:short-sha",
    ]);
  });

  test("failed fetch still creates the source without rawText", async () => {
    const { client, calls } = fakeClient({
      "sources:getByDedupeKey": () => null,
      "sources:create": () => ({ id: "s9", created: true }),
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: () =>
        Promise.resolve({ ok: false as const, error: "blocked" }),
      log: () => {},
    });
    const summary = await ingestor.ingest([
      {
        type: "url",
        title: "Blocked",
        url: "https://c.example",
      },
    ]);
    expect(summary).toEqual({ created: 1, skipped: 0, failed: 0 });
    const create = calls.find((call) => call.name === "sources:create");
    expect(create?.args.rawText).toBeUndefined();
  });

  test("a throwing mutation counts as failed and does not abort the batch", async () => {
    let first = true;
    const { client } = fakeClient({
      "sources:getByDedupeKey": () => null,
      "sources:create": () => {
        if (first) {
          first = false;
          throw new Error("validator rejected");
        }
        return { id: "ok", created: true };
      },
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      log: () => {},
    });
    const summary = await ingestor.ingest([
      { type: "url", title: "Bad", url: "https://bad.example" },
      { type: "url", title: "Good", url: "https://good.example" },
    ]);
    expect(summary).toEqual({ created: 1, skipped: 0, failed: 1 });
  });
});

describe("refetchByStatus", () => {
  const rows = [
    {
      _id: "a",
      type: "url",
      status: "text_ready",
      canonicalUrl: "https://a.example",
      rawText: "short",
      title: "A",
    },
    {
      _id: "b",
      type: "notion",
      status: "text_ready",
      canonicalUrl: "https://b.example",
      rawText: "short",
      title: "B",
    },
    {
      _id: "c",
      type: "url",
      status: "extracted",
      canonicalUrl: "https://c.example",
      rawText: "short",
      title: "C",
    },
    {
      _id: "d",
      type: "url",
      status: "text_ready",
      canonicalUrl: undefined,
      rawText: "",
      title: "D",
    },
    {
      _id: "e",
      type: "url",
      status: "text_ready",
      canonicalUrl: "https://e.example",
      rawText: "x".repeat(5000),
      title: "E",
    },
  ];

  test("filters by type/url/length, updates text, resets extracted rows when reExtract", async () => {
    const { client, calls } = fakeClient({
      "sources:listByStatus": (args) =>
        rows.filter((row) => row.status === args.status),
      "sources:updateText": () => null,
      "sources:updateStatus": () => null,
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: () =>
        Promise.resolve({ ok: true as const, text: "F".repeat(2000) }),
      log: () => {},
    });
    const summary = await ingestor.refetchByStatus(
      ["text_ready", "extracted"],
      {
        types: ["url"],
        minLength: 1000,
        reExtract: true,
      },
    );
    expect(summary).toEqual({ updated: 2, skipped: 0, failed: 0 });
    const updates = calls.filter((call) => call.name === "sources:updateText");
    expect(updates.map((call) => call.args.id).toSorted()).toEqual(["a", "c"]);
    const resets = calls.filter((call) => call.name === "sources:updateStatus");
    expect(resets.length).toBe(1);
    expect(resets[0]!.args).toMatchObject({ id: "c", status: "text_ready" });
  });

  test("fetched text not longer than current counts as skipped", async () => {
    const { client, calls } = fakeClient({
      "sources:listByStatus": (args) =>
        rows.filter((row) => row.status === args.status),
      "sources:updateText": () => null,
    });
    const ingestor = createSourceIngestor({
      client,
      rateMs: 0,
      fetchText: () => Promise.resolve({ ok: true as const, text: "ab" }),
      log: () => {},
    });
    const summary = await ingestor.refetchByStatus(["text_ready"], {
      types: ["url"],
      minLength: 1000,
    });
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBeGreaterThan(0);
    expect(
      calls.filter((call) => call.name === "sources:updateText").length,
    ).toBe(0);
  });
});
