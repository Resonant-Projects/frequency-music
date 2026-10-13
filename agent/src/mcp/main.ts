import "varlock/auto-load";
import { createWave2Operations } from "./backend";
import { createMcpHttpServer } from "./server";

const port = Number(process.env.MCP_PORT ?? "2025");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid MCP_PORT");
const server = createMcpHttpServer({
  operations: createWave2Operations(),
  inboundSecret: process.env.MCP_SHARED_SECRET ?? "",
  outboundSecret: process.env.AGENT_TOOL_SECRET ?? "",
});
server.listen(port, "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
