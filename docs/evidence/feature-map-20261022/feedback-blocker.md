# F1: feedback fixture cannot instantiate

Working directory `web/`; 2026-10-22 UTC; source HEAD `a9b728466f9254938e40761e012451b4d896825b`.

```bash
APP_ENV=test vp exec playwright test --config tests/feedback/playwright.config.ts feedback.spec.ts --workers=1 --max-failures=1 --timeout=8000 --reporter=list --output=../scratchpad/feature-map-20261022/feedback-failure
```

Exit **1**. The real Listen/Docket routes are compiled against a synthetic adapter. The adapter lacks createAction imported by studio-comparison. One test failed before assertions, 12 did not run. This is a fixture blocker, not proof that the production route fails. The first attempt selected a nonexistent audio-feedback.spec.ts (No tests found); the corrected unbounded run was interrupted after the import failure (exit 130), its verified owned server group was stopped, and this bounded final command reproduced the failure. A retry before orphan cleanup correctly refused occupied port 5192. No reuseExistingServer override or source fix was made.

```text
[WebServer] (node:54830) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:54865) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 13 tests using 1 worker

(node:54942) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] 8:18:47 PM [vite+] (client) [Unhandled error] SyntaxError: The requested module '/tests/feedback/convex-fixture.ts' does not provide an export named 'createAction'
[WebServer]
[WebServer] 8:18:47 PM [vite+] (client) [Unhandled error] SyntaxError: The requested module '/tests/feedback/convex-fixture.ts' does not provide an export named 'createAction'
[WebServer]
  ✘   1 tests/feedback/feedback.spec.ts:27:1 › kind-specific optional scores keep zero and omit blanks (8.0s)
Testing stopped early after 1 maximum allowed failures.


  1) tests/feedback/feedback.spec.ts:27:1 › kind-specific optional scores keep zero and omit blanks

    Test timeout of 8000ms exceeded.

    Error: page.waitForFunction: Test timeout of 8000ms exceeded.

       9 |   );
      10 |   await page.goto(path);
    > 11 |   await page.waitForFunction(() => "feedbackFixture" in window);
         |              ^
      12 | }
      13 | const fixture = (page: Page, fn: string, value?: string) =>
      14 |   page.evaluate(
        at open (/home/kelliott/.t3/worktrees/frequency-music/docs-feature-map/web/tests/feedback/feedback.spec.ts:11:14)
        at /home/kelliott/.t3/worktrees/frequency-music/docs-feature-map/web/tests/feedback/feedback.spec.ts:30:3

    Error Context: ../scratchpad/feature-map-20261022/feedback-failure/feedback-kind-specific-opt-d7d3f-s-keep-zero-and-omit-blanks/error-context.md

  1 failed
    tests/feedback/feedback.spec.ts:27:1 › kind-specific optional scores keep zero and omit blanks ─
  12 did not run
  1 error was not a part of any test, see above for details
```
