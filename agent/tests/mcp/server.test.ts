import {
  docketListResultZ,
  MCP_MAX_RESPONSE_BYTES,
  projectDocketCard,
} from "../../../convex/shared/docketTools";
import { once } from "node:events";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import {
  type BackendOperations,
  createWave2Operations,
  manifestOperation,
  wave2Tools,
} from "../../src/mcp/backend";
import { authenticated, createMcpHttpServer } from "../../src/mcp/server";
import { AGENT_TOOL_MANIFEST } from "../../../convex/shared/agentToolManifest";

const inbound = "test-inbound-mcp";
const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
});
async function start(operations?: BackendOperations) {
  const server = createMcpHttpServer({
    inboundSecret: inbound,
    outboundSecret: "test-outbound-agent",
    operations,
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const url = `http://127.0.0.1:${address.port}`;
  const request = (
    method: string,
    params?: object,
    headers = {},
    requestId: string | number = 1,
  ) =>
    fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-mcp-secret": inbound,
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
    });
  const call = async (name: string, args: object = {}) => {
    const response = await request("tools/call", { name, arguments: args });
    return { status: response.status, body: await response.json() };
  };
  return { url, request, call };
}

describe("stateless MCP", () => {
  it("fails closed and keeps inbound and outbound secrets distinct", async () => {
    expect(authenticated(undefined, inbound)).toBe(false);
    expect(authenticated([inbound, inbound], inbound)).toBe(false);
    expect(authenticated("short", inbound)).toBe(false);
    expect(() =>
      createMcpHttpServer({ inboundSecret: "", outboundSecret: "out" }),
    ).toThrow();
    expect(() =>
      createMcpHttpServer({ inboundSecret: inbound, outboundSecret: inbound }),
    ).toThrow();
    const { request, url } = await start();
    expect(
      (await request("tools/list", {}, { "x-mcp-secret": "wrong" })).status,
    ).toBe(401);
    expect(
      (await fetch(`${url}/mcp`, { method: "POST", body: "not JSON" })).status,
    ).toBe(401);
    expect(await (await fetch(`${url}/health`)).json()).toEqual({
      status: "ok",
    });
    const init = await request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.status).toBe(200);
    expect(init.headers.has("mcp-session-id")).toBe(false);
    const listed = await (await request("tools/list")).json();
    expect(
      listed.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([...wave2Tools, "render.request", "tournament.request"]);
  });

  it("advertises the real Wave 2 schemas and rejects a listening action on decision.propose", async () => {
    const { request, call } = await start(createWave2Operations());
    const listed = await (await request("tools/list")).json();
    expect(listed.error).toBeUndefined();
    expect(
      listed.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([...wave2Tools, "render.request", "tournament.request"]);
    const decision = listed.result.tools.find(
      (tool: { name: string }) => tool.name === "decision.propose",
    );
    expect(decision.inputSchema.required).toEqual(["command", "proposal"]);
    const response = await call("decision.propose", {
      command: {
        action: "createListeningSession",
        target: { kind: "composition", id: "composition" },
        payload: {
          conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
        },
      },
      proposal: {
        channel: "telegram",
        conversationId: "chat",
        messageRef: "voice",
        transcript: "I listened",
      },
    });
    expect(response.body.result.isError).toBe(true);
  });

  it("delivers all ten excerpted cards within the full HTTP envelope budget", async () => {
    const cards = Array.from({ length: 10 }, (_, index) =>
      projectDocketCard(
        {
          _id: `card${index}`,
          kind: "recipeNoComposition",
          targetId: `recipe${index}`,
          title: "音😀".repeat(1000),
          blurbMd: '\\"\n\t\u0000音😀'.repeat(30000),
          spokenBlurb: "😀".repeat(20000),
          pageUrl: `/recipes/recipe${index}`,
          decisions: [],
          contentHash: "a".repeat(64),
        },
        "https://storage.example.test/" + "a".repeat(2000),
      ),
    );
    const operations = createWave2Operations();
    operations["docket.list"].invoke = async () => cards;
    const { request } = await start(operations);
    const response = await request(
      "tools/call",
      { name: "docket.list", arguments: {} },
      {},
      "i".repeat(60000),
    );
    const wire = await response.text();
    expect(response.status).toBe(200);
    expect(Buffer.byteLength(wire, "utf8")).toBeLessThan(
      MCP_MAX_RESPONSE_BYTES,
    );
    const envelope = JSON.parse(wire);
    expect(envelope.result.isError).toBeUndefined();
    expect(Object.keys(envelope.result)).toEqual(["content"]);
    expect(
      docketListResultZ.parse(JSON.parse(envelope.result.content[0].text)),
    ).toEqual(cards);
  });

  it("counts JSON escaping in the final response, not only the inner text", async () => {
    const { call } = await start({
      "docket.card": {
        args: z.strictObject({}),
        result: z.string(),
        invoke: async () => '"'.repeat(100000),
      },
    });
    expect((await call("docket.card")).body.result.isError).toBe(true);
  });

  it("uses canonical injected schemas and rejects excess arguments and pagination", async () => {
    const invoke = vi.fn(async () => ({ cards: [] }));
    const { call } = await start({
      "docket.list": {
        args: z.strictObject({ limit: z.number().int().min(1).max(10) }),
        result: z.strictObject({ cards: z.array(z.string()).max(10) }),
        invoke,
      },
    });
    expect((await call("docket.list", { limit: 11 })).body.result.isError).toBe(
      true,
    );
    expect(
      (await call("docket.list", { limit: 1, extra: true })).body.result
        .isError,
    ).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
    const ok = await call("docket.list", { limit: 10 });
    expect(JSON.parse(ok.body.result.content[0].text)).toEqual({ cards: [] });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it("rejects adversarial authority fields on every tool before the adapter runs", async () => {
    const invoke = vi.fn(async () => ({}));
    const operations = Object.fromEntries(
      wave2Tools.map((name) => [
        name,
        {
          args: z.strictObject({
            payload: z.object({ note: z.string().optional() }).optional(),
          }),
          result: z.object({}),
          invoke,
        },
      ]),
    );
    const { call } = await start(operations);
    for (const name of [
      ...wave2Tools,
      "render.request",
      "tournament.request",
    ]) {
      for (const field of [
        "actor",
        "signature",
        "signerId",
        "createdBy",
        "secret",
        "consonanceComputed",
      ]) {
        expect(
          (await call(name, { payload: { [field]: "forged" } })).status,
        ).toBe(400);
      }
    }
    expect(invoke).not.toHaveBeenCalled();
    for (const name of [
      "decision.confirm",
      "decision.apply",
      "listening.create",
    ]) {
      const response = await call(name);
      expect(response.body.error ?? response.body.result?.isError).toBeTruthy();
    }
  });

  it("reports unavailable capabilities without writes or fabricated success", async () => {
    const { call } = await start();
    for (const [name, requiredWave] of [
      ["render.request", 3],
      ["tournament.request", 4],
      ["decision.propose", 2],
    ] as const) {
      const response = await call(name);
      expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
        status: "unavailable",
        requiredWave,
      });
    }
  });

  it("bounds responses and redacts downstream errors and invalid playback projections", async () => {
    for (const invoke of [
      async () => {
        throw new Error("secret-from-backend");
      },
      async () => ({ text: "x".repeat(300_000) }),
      async () => ({ text: "card", unrevealedBlindMember: "secret-url" }),
    ]) {
      const { call } = await start({
        "docket.card": {
          args: z.strictObject({}),
          result: z.strictObject({ text: z.string() }),
          invoke,
        },
      });
      const response = await call("docket.card");
      expect(response.body.result.isError).toBe(true);
      expect(JSON.stringify(response)).not.toContain("secret-");
    }
  });

  it("rejects browser origins, excessive bodies, malformed JSON, and stateful methods", async () => {
    const { request, url } = await start();
    expect(
      (await request("tools/list", {}, { origin: "https://evil.test" })).status,
    ).toBe(403);
    expect(
      (await request("tools/list", { value: "x".repeat(70_000) })).status,
    ).toBe(400);
    expect(
      (await fetch(`${url}/mcp`, { headers: { "x-mcp-secret": inbound } }))
        .status,
    ).toBe(405);
    expect(
      (
        await fetch(`${url}/mcp`, {
          method: "POST",
          headers: {
            "x-mcp-secret": inbound,
            "content-type": "application/json",
          },
          body: "{",
        })
      ).status,
    ).toBe(400);
  });

  it("times out an adapter that ignores cancellation", async () => {
    const { call } = await start({
      "docket.card": {
        args: z.strictObject({}),
        result: z.strictObject({}),
        invoke: async () => new Promise(() => {}),
      },
    });
    const response = await call("docket.card");
    expect(response.body.result.isError).toBe(true);
  }, 15_000);

  it("reuses the existing manifest route and JSON-body outbound authentication", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "https://convex.example");
    vi.stubEnv("AGENT_TOOL_SECRET", "test-outbound-agent");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const definition = AGENT_TOOL_MANIFEST.find(
      (entry) => entry.name === "listDocket",
    );
    if (!definition) throw new Error("Missing read tool");
    const operation = manifestOperation(
      definition,
      z.strictObject({ ok: z.boolean() }),
    );
    const signal = AbortSignal.timeout(1000);
    await operation.invoke({}, signal);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://convex.example/agent-tools/${definition.name}`,
      expect.objectContaining({
        signal,
        body: JSON.stringify({ secret: "test-outbound-agent" }),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(inbound);
  });
});
