#!/usr/bin/env python3
"""Local fake of POST /api/get_config_hashes for the guest extractor smoke test.

Usage: fake-backend.py <mode> [port]; modes: ok, big, err, bad, redirect, slow,
drip (headers plus one incomplete chunk, then silence), stall (no headers ever).
Binds 127.0.0.1 only. Never used against a real backend.
"""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

MODE = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 3210
if MODE not in ("ok", "big", "err", "bad", "redirect", "slow", "drip", "stall"):
    print("unknown mode", file=sys.stderr)
    raise SystemExit(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        json.loads(self.rfile.read(length))
        assert self.headers.get("Authorization", "").startswith("Convex ")
        code = 200
        if MODE == "ok":
            out = json.dumps(
                {
                    "moduleHashes": [
                        {"path": "b.js", "environment": "node", "hash": "b" * 64},
                        {"path": "a.js", "environment": "isolate", "hash": "a" * 64},
                    ],
                    "config": {"secret": "LEAK-ME"},
                }
            ).encode()
        elif MODE == "big":
            out = b'{"moduleHashes":[' + b"x" * (4 * 1024 * 1024 + 10) + b"]}"
        elif MODE == "err":
            out, code = json.dumps({"code": "Unauthorized", "message": "LEAK-ERR"}).encode(), 401
        elif MODE == "redirect":
            self.send_response(302)
            self.send_header("Location", "http://127.0.0.1:1/never")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        elif MODE == "drip":
            # Headers and a partial body, then hold the socket open forever.
            self.send_response(200)
            self.send_header("Content-Length", "200000")
            self.end_headers()
            self.wfile.write(b"x" * 100)
            self.wfile.flush()
            time.sleep(3600)
            return
        elif MODE == "stall":
            time.sleep(3600)  # never answer
            return
        elif MODE == "slow":
            self.send_response(200)
            self.send_header("Content-Length", "200000")
            self.end_headers()
            for _ in range(200):
                try:
                    self.wfile.write(b"x" * 1000)
                    self.wfile.flush()
                except OSError:
                    return
                time.sleep(0.25)
            return
        elif MODE == "bad":
            out = b'{"moduleHashes":[{"path":"a.js","environment":"isolate","hash":"zz"}]}'
        else:
            raise SystemExit(2)
        self.send_response(code)
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
