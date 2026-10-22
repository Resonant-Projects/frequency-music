# U2: target audio component

Working directory `web/`; 2026-10-22 UTC; source HEAD `a9b728466f9254938e40761e012451b4d896825b`.

```bash
APP_ENV=test vp exec playwright test --config tests/listen/playwright.config.ts --reporter=list --output=../scratchpad/feature-map-20261022/listen-results
```

Exit **0**. These are isolated real component/route tests with synthetic data and injected dependencies, not full-app persistence or hosted authentication proof.

```text
[WebServer] (node:25842) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:25887) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 3 tests using 1 worker

(node:25997) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 tests/listen/listen.spec.ts:12:1 › uses authorized playback and updates target on navigation (284ms)
  ✓  2 tests/listen/listen.spec.ts:46:1 › empty and error states remove the section and stale audio (171ms)
  ✓  3 tests/listen/listen.spec.ts:67:1 › revoked playback removes player and title (156ms)

  3 passed (1.9s)
```
