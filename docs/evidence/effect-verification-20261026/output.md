# Compact command output

Full raw logs are local under `/tmp/frequency-verify-20261026-ca495094/`. Their SHA-256 values and the retained screenshot/trace paths are in [artifacts.json](artifacts.json). These excerpts contain no credentials.

## web-build

```text
✓ built in 2.10s
vp run: 3/3 successful. (Run `vp run --last-details` for full details)
```

## repository-verify

```text
 Test Files  144 passed (144)
      Tests  1626 passed (1626)
 Test Files  27 passed (27)
      Tests  234 passed (234)
 Test Files  43 passed (43)
      Tests  443 passed (443)
 Test Files  19 passed (19)
      Tests  153 passed (153)
vp run: 10/10 successful. (Run `vp run --last-details` for full details)
```

## ui-fixture

```text
  23 passed (8.0s)
```

## listen-fixture

```text
  3 passed (2.1s)
```

## auth-fixture

```text
  4 passed (4.5s)
```

## feedback-fixture

```text
  13 passed (10.3s)
```

## local-convex

```text
{"status": "started", "backend": "http://127.0.0.1:58761", "frontend": "http://127.0.0.1:44717", "image": "ghcr.io/convex/convex-backend@sha256:294944b33dc55e8f68b2feda11c5e7b195f7778b9ad2951f1bea2744ad392e5a", "version": "unknown", "internal_network": true}
{"status": "deployed", "backend": "http://127.0.0.1:58761", "source_exceptions": ["empty crons in disposable copy", "synthetic seed/snapshot module"]}
{"status":"seeded","syntheticUserId":"ps7et275s5fmdg39ap7s1d5q3s8h1mr1"}
  ✓  1 tests/local/journeys.spec.ts:58:1 › URL intake and dedupe persist without requesting generation (1.9s)
  ✓  2 tests/local/journeys.spec.ts:100:1 › recover missing source text through the real Display form (1.5s)
  ✓  3 tests/local/journeys.spec.ts:138:1 › manual hypothesis recipe composition and Listening Session preserve lineage (5.4s)
  ✓  4 tests/local/journeys.spec.ts:286:1 › feed creation and toggling persist without polling (1.5s)
  4 passed (13.8s)
  "status": "pass",
  "container_removed": "frequency-verify-effect-ca495094-20261026",
  "volume_removed": "frequency-verify-effect-ca495094-20261026",
  "network_removed": "frequency-verify-effect-ca495094-20261026",
  "local_credentials_removed": true
```
