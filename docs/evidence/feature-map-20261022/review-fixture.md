# U1: draft and immutable intent review

Working directory `web/`; 2026-10-22 UTC; source HEAD `a9b728466f9254938e40761e012451b4d896825b`.

```bash
APP_ENV=test vp exec playwright test --config playwright.ui.config.ts --reporter=list --output=../scratchpad/feature-map-20261022/ui-results
```

Exit **0**. These are isolated real component/route tests with synthetic data and injected dependencies, not full-app persistence or hosted authentication proof.

```text
[WebServer] (node:20471) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:20541) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 13 tests using 3 workers

(node:20893) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:20903) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:20904) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓   3 tests/ui/draft-review.spec.ts:11:1 › fetches a terminal deep link with an empty pending queue (1.3s)
  ✓   2 tests/ui/intent-review.spec.ts:13:1 › immutable payload and repeated confirmation/cancellation taps (1.4s)
  ✓   1 tests/ui/intent-binding.spec.ts:11:1 › real route binds immutable listening payload, digest and stable retry event (1.5s)
  ✓   4 tests/ui/draft-review.spec.ts:26:1 › queue selection updates URL and history, and remains after retirement (550ms)
  ✓   5 tests/ui/intent-review.spec.ts:38:1 › failed cancellation is visible and can be retried (418ms)
  ✓   6 tests/ui/intent-binding.spec.ts:58:1 › navigation isolates pending response and cancellation uses its own intent (572ms)
  ✓   7 tests/ui/draft-review.spec.ts:44:1 › invalid and missing targets do not open an unrelated draft (529ms)
  ✓  10 tests/ui/draft-review.spec.ts:65:1 › returning to a populated queue restores keyboard focus to its selected row (376ms)
  ✓   9 tests/ui/intent-binding.spec.ts:86:1 › missing, unauthorized, expired and applied intents stay non-actionable (1.0s)
  ✓  11 tests/ui/intent-binding.spec.ts:106:1 › terminal draft shows source, transcript and intent reference (291ms)
  ✓   8 tests/ui/intent-review.spec.ts:48:1 › expiry blocks a decision and old async failures do not leak across navigation (1.7s)
  ✓  13 tests/ui/intent-review.spec.ts:65:1 › payload fits a phone and keyboard focus remains on submission (221ms)
  ✓  12 tests/ui/intent-binding.spec.ts:123:1 › subscription terminal status blocks decisions and loading never offers actions (455ms)

  13 passed (5.3s)
```
