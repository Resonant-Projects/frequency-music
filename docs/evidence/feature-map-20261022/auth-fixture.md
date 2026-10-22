# U3: Clerk integration with fake clerk-js

Working directory `web/`; 2026-10-22 UTC; source HEAD `a9b728466f9254938e40761e012451b4d896825b`.

```bash
APP_ENV=test vp exec playwright test --config tests/auth/playwright.config.ts --reporter=list --output=../scratchpad/feature-map-20261022/auth-results
```

Exit **0**. These are isolated real component/route tests with synthetic data and injected dependencies, not full-app persistence or hosted authentication proof.

```text
[WebServer] (node:31385) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:31492) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 4 tests using 1 worker

(node:33128) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 tests/auth/auth.spec.ts:39:1 › signed-in user sees the app and Convex gets the convex template token (633ms)
  ✓  2 tests/auth/auth.spec.ts:69:1 › signed-out visitor goes to hosted sign-in with a return URL (507ms)
  ✓  3 tests/auth/auth.spec.ts:81:1 › signing out sends the user to hosted sign-in (1.0s)
[WebServer] 8:16:58 PM [vite+] (client) [console.error] Error: fixture: Frontend API rejected the origin
[WebServer]     at Clerk.load (http://127.0.0.1:4188/tests/auth/clerk-fixture.ts:25:10)
[WebServer]     at async _IsomorphicClerk.loadClerkJS (http://127.0.0.1:4188/node_modules/@resonant-projects/clerk-solidjs/dist/chunk/7UCAML2B.jsx:1768:5)
  ✓  4 tests/auth/auth.spec.ts:90:1 › a clerk-js load failure says sign-in is unavailable instead of redirecting (985ms)

  4 passed (4.4s)
```
