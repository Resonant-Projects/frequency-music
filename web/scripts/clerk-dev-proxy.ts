/**
 * TLS proxy for local sign-in against the production Clerk instance.
 *
 * Production Clerk accepts a return URL only when Origin is an HTTPS
 * subdomain of the instance with no explicit port. This process binds 443
 * and forwards to the Vite dev server on 4173, so the browser origin is
 * https://local.resonantprojects.art. Vite itself stays unprivileged.
 *
 * Certificates come from mkcert and are gitignored under web/certs/.
 */
import { existsSync, readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:https";
import { connect } from "node:net";
import { join } from "node:path";
import { CLERK_LOCAL_DEV_HOST } from "../src/integrations/clerk/dev-origin.ts";

const targetPort = 4173;
const listenPort = 443;
const certDir = join(import.meta.dirname, "../certs");
const certPath = join(certDir, `${CLERK_LOCAL_DEV_HOST}.pem`);
const keyPath = join(certDir, `${CLERK_LOCAL_DEV_HOST}-key.pem`);

function requireCert(path: string): Buffer {
  if (!existsSync(path)) {
    console.error(
      `Missing ${path}. From web/certs, run: mkcert ${CLERK_LOCAL_DEV_HOST}`,
    );
    process.exit(1);
  }
  return readFileSync(path);
}

const server = createServer(
  {
    cert: requireCert(certPath),
    key: requireCert(keyPath),
  },
  (req, res) => {
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (incoming) => {
        res.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        `Vite is not accepting connections on 127.0.0.1:${targetPort}. Start it with: vp run dev:clerk`,
      );
    });
    req.pipe(upstream);
  },
);

server.on("upgrade", (req, socket, head) => {
  const upstream = connect(targetPort, "127.0.0.1", () => {
    const headerLines = Object.entries(req.headers).flatMap(([name, value]) => {
      if (Array.isArray(value)) return value.map((item) => `${name}: ${item}`);
      if (value === undefined) return [];
      return [`${name}: ${value}`];
    });
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join("\r\n")}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const closeBoth = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on("error", closeBoth);
  socket.on("error", closeBoth);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EACCES") {
    console.error(
      `Port ${listenPort} requires privileges. From web/, run: sudo bun scripts/clerk-dev-proxy.ts`,
    );
    process.exit(1);
  }
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${listenPort} is already in use.`);
    process.exit(1);
  }
  throw error;
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    `https://${CLERK_LOCAL_DEV_HOST} -> http://127.0.0.1:${targetPort}`,
  );
});
