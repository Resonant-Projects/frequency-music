#!/usr/bin/env python3
"""Loopback ingress for a Docker --internal backend (which cannot publish ports)."""
import argparse
import ipaddress
import select
import socket
import socketserver
import threading


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        with socket.create_connection(self.server.target, timeout=10) as upstream:
            sockets = [self.request, upstream]
            while True:
                ready, _, _ = select.select(sockets, [], [], 120)
                if not ready:
                    return
                for incoming in ready:
                    data = incoming.recv(65536)
                    if not data:
                        return
                    (upstream if incoming is self.request else self.request).sendall(data)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("container_ip")
    parser.add_argument("backend_port", type=int)
    parser.add_argument("site_port", type=int)
    args = parser.parse_args()
    if not ipaddress.ip_address(args.container_ip).is_private:
        raise ValueError("Relay target must be the owned container's private address")
    servers = []
    for local, remote in [(args.backend_port, 3210), (args.site_port, 3211)]:
        server = Server(("127.0.0.1", local), Handler)
        server.target = (args.container_ip, remote)
        servers.append(server)
    for server in servers[:-1]:
        threading.Thread(target=server.serve_forever, daemon=True).start()
    servers[-1].serve_forever()
