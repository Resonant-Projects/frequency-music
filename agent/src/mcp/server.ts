import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { type BackendOperations, wave2Tools } from "./backend";

import {
  MCP_MAX_RESPONSE_BYTES,
  MCP_MAX_REQUEST_BYTES,
  mcpTextResult,
  serializedUtf8Bytes,
} from "../../../convex/shared/docketTools";

const REQUEST_TIMEOUT_MS = 10_000;
const unavailableSchema = z.strictObject({
  status: z.literal("unavailable"),
  requiredWave: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  reason: z.string(),
});
const forbiddenFields = new Set([
  "actor",
  "signature",
  "signer",
  "signerId",
  "userId",
  "createdBy",
  "decidedBy",
  "decisionSource",
  "signerCard",
  "secret",
  "agentRunId",
  "consonanceComputed",
  "__proto__",
  "constructor",
  "prototype",
]);

function hasAuthority(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => forbiddenFields.has(key) || hasAuthority(child),
  );
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function authenticated(
  header: string | string[] | undefined,
  secret: string,
): boolean {
  return (
    timingSafeEqual(
      digest(typeof header === "string" ? header : ""),
      digest(secret),
    ) &&
    typeof header === "string" &&
    secret.length > 0
  );
}

function result(value: unknown, requestId: string | number = 0) {
  const output = mcpTextResult(value);
  if (
    serializedUtf8Bytes({ jsonrpc: "2.0", id: requestId, result: output }) >
    MCP_MAX_RESPONSE_BYTES
  )
    throw new Error("Result too large");
  return output;
}

function unavailable(requiredWave: 2 | 3 | 4) {
  return result(
    unavailableSchema.parse({
      status: "unavailable",
      requiredWave,
      reason:
        requiredWave === 2
          ? "Wave 2 backend registration is not installed."
          : `Wave ${requiredWave} execution is not available. No job was queued.`,
    }),
  );
}

export function createMcpServer(operations: BackendOperations = {}) {
  const server = new McpServer({ name: "frequency", version: "0.1.0" });
  for (const name of wave2Tools) {
    const operation = operations[name];
    server.registerTool(
      name,
      {
        description: operation
          ? `${name}. Human decisions require the separate signer path.`
          : `${name} is unavailable until the Wave 2 backend is registered.`,
        inputSchema: operation?.args.strict() ?? z.strictObject({}),
        annotations: {
          readOnlyHint: name === "docket.card",
          destructiveHint: false,
        },
      },
      async (args, extra) => {
        if (!operation) return unavailable(2);
        try {
          if (hasAuthority(args)) throw new Error("Untrusted authority");
          // A hard deadline also bounds injected adapters that ignore cancellation.
          const signal = AbortSignal.any([
            extra.signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ]);
          const output = await new Promise<unknown>((resolve, reject) => {
            const abort = () => reject(new Error("Backend deadline exceeded"));
            signal.addEventListener("abort", abort, { once: true });
            Promise.resolve()
              .then(() => operation.invoke(args, signal))
              .then(resolve, reject)
              .finally(() => signal.removeEventListener("abort", abort));
            if (signal.aborted) abort();
          });
          return result(operation.result.parse(output), extra.requestId);
        } catch {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Frequency could not complete this request. No success is confirmed; check the web page before retrying a proposal.",
              },
            ],
          };
        }
      },
    );
  }
  for (const [name, wave] of [
    ["render.request", 3],
    ["tournament.request", 4],
  ] as const) {
    server.registerTool(
      name,
      {
        description: `Unavailable until Wave ${wave}. Enqueues nothing.`,
        inputSchema: z.strictObject({}),
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
      async () => unavailable(wave),
    );
  }
  return server;
}

function send(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MCP_MAX_REQUEST_BYTES) throw new Error("Request too large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createMcpHttpServer(options: {
  inboundSecret: string;
  outboundSecret: string;
  operations?: BackendOperations;
}) {
  if (
    !options.inboundSecret.trim() ||
    !options.outboundSecret.trim() ||
    authenticated(options.inboundSecret, options.outboundSecret)
  ) {
    throw new Error(
      "MCP requires distinct, nonempty inbound and outbound secrets",
    );
  }
  const http = createServer(async (req, res) => {
    // Liveness is local and bounded. It never queries Convex or reveals configuration.
    if (req.url === "/health" && req.method === "GET") {
      send(res, 200, { status: "ok" });
      return;
    }
    if (!authenticated(req.headers["x-mcp-secret"], options.inboundSecret)) {
      send(res, 401, { error: "Unauthorized" });
      return;
    }
    if (req.url !== "/mcp") {
      send(res, 404, { error: "Not found" });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      send(res, 405, { error: "Stateless MCP requires POST" });
      return;
    }
    // No browser origins are needed for the server-to-server freq client.
    if (req.headers.origin) {
      send(res, 403, { error: "Origin not allowed" });
      return;
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      send(res, 415, { error: "JSON required" });
      return;
    }
    const timer = setTimeout(() => {
      if (!res.headersSent) send(res, 408, { error: "Request timed out" });
      req.destroy();
    }, REQUEST_TIMEOUT_MS + 1000);
    const server = createMcpServer(options.operations);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      clearTimeout(timer);
      void server.close();
    });
    try {
      const body = await readBody(req);
      // Inspect raw input before Zod can strip nested unknown identity fields.
      if (hasAuthority(body)) {
        send(res, 400, { error: "Authority fields are not accepted" });
        return;
      }
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) send(res, 400, { error: "Invalid MCP request" });
    }
  });
  http.requestTimeout = REQUEST_TIMEOUT_MS + 1000;
  http.headersTimeout = REQUEST_TIMEOUT_MS;
  http.maxRequestsPerSocket = 100;
  return http;
}
