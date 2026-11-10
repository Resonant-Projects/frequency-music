# V10 command receipts, 2026-11-10

[Checkpoint and limits](verification-20261110.md) · [Feature map](../feature-map.md)

Source `c323b26cdad5952670a7658e40ccaa47329928bb` equals fetched `origin/main`.
Commands below are the executed verification/setup commands, including failed
attempts and retries. CWD is root unless marked `web`. Output is trimmed from
raw logs (ANSI styling omitted); semicolons join separate output lines. Child
installs in root `prepare` replace redundant explicit installs. Foreground launch
exit codes were collected after cleanup. No hosted backend command ran.

| Raw log (`.log`) | CWD | Command | Exit | Trimmed output |
| --- | --- | --- | --- | --- |
| `install-root` | root | `vp install --frozen-lockfile` | 0 | Root: 142 packages installed; prepare installed web (484), agent and media from lockfiles and generated Panda output. |
| `chromium` | web | `vp exec playwright install chromium` | 0 | (no output; matching Chromium available) |
| `build` | web | `VITE_AUTH_BYPASS=1 VITE_E2E_MODE=0 VITE_CONVEX_URL=http://127.0.0.1:9 vp run build -- --mode verification` | 0 | vp run: 3/3 successful. |
| `verify-baseline` | root | `APP_ENV=test vp run verify` | 0 | vp run: 10/10 successful; Tests 1764 / 234 / 453 / 153 passed (root / harness / agent / media). |
| `local-control` | root | `python3 scripts/local-convex/test_control.py -v` | 0 | Ran 20 tests in 0.010s; OK |
| `local-safety` | root | `python3 -m unittest discover -s scripts/local-convex -p 'test_*.py' -v` | 0 | Ran 46 tests in 2.825s; OK |
| `offline-control` | root | `python3 .agents/skills/verify-frequency/scripts/test_control.py -v` | 0 | Ran 24 tests in 7.068s; OK |
| `offline-driver` | root | `node --test .agents/skills/verify-frequency/scripts/test_driver.mjs` | 0 | pass 10; fail 0; skipped 0 |
| `ui` | web | `APP_ENV=test vp exec playwright test --config playwright.ui.config.ts --reporter=list` | 0 | 23 passed (8.1s) |
| `listen` | web | `APP_ENV=test vp exec playwright test --config tests/listen/playwright.config.ts --reporter=list` | 0 | 3 passed (2.8s) |
| `auth` | web | `APP_ENV=test vp exec playwright test --config tests/auth/playwright.config.ts --reporter=list` | 0 | 4 passed (4.5s) |
| `feedback` | web | `APP_ENV=test vp exec playwright test --config tests/feedback/playwright.config.ts feedback.spec.ts --workers=1 --max-failures=1 --timeout=8000 --reporter=list` | 0 | 13 passed (7.4s) |
| `targeted` | root | `APP_ENV=test vp test convex/authRoles.test.ts convex/readerQueryTier1.test.ts convex/publicQueryAuth.test.ts convex/creatorIdentity.test.ts convex/shared/doi.test.ts convex/dedupeMigration.test.ts convex/hypotheses.test.ts convex/hypothesisPayload.test.ts scripts/check-file-tokens-baseline.test.ts scripts/workflow-hardening.test.ts` | 0 | Test Files 10 passed (10); Tests 116 passed (116) |
| `web-units` | web | `APP_ENV=test vp test src/lib/rating.test.ts src/lib/query-args.test.ts src/integrations/convex/query.test.ts` | 1 | MISSING DEPENDENCY Cannot find dependency 'jsdom'; Tests 12 passed (12) |
| `web-units-root` | root | `APP_ENV=test vp test web/src/lib/rating.test.ts web/src/lib/query-args.test.ts web/src/integrations/convex/query.test.ts` | 1 | No test files found, exiting with code 1; include: convex/*.test.ts, convex/shared/*.test.ts, harness/**/*.test.ts, scripts/**/*.test.ts |
| `web-units-node` | web | `APP_ENV=test vp test --environment node src/lib/rating.test.ts src/lib/query-args.test.ts src/integrations/convex/query.test.ts` | 0 | Test Files 3 passed (3); Tests 12 passed (12) |
| `persisted-auto` | root | `python3 scripts/local-convex/control.py run upkeep-20261110-auto` | 0 | 4 passed (14.4s); status: pass; container/volume/network removed; local_credentials_removed: true |
| `persisted-start` | root | `python3 scripts/local-convex/control.py start upkeep-20261110-manual` | 0 | status: started; backend http://127.0.0.1:35793; internal_network: true |
| `persisted-deploy` | root | `python3 scripts/local-convex/control.py deploy upkeep-20261110-manual` | 0 | Deployed Convex functions to http://127.0.0.1:35793; status: deployed |
| `persisted-exercise` | root | `python3 scripts/local-convex/control.py exercise upkeep-20261110-manual` | 0 | 4 passed (11.0s) |
| `persisted-stop` | root | `python3 scripts/local-convex/control.py stop upkeep-20261110-manual` | 0 | status: pass; container/volume/network removed; local_credentials_removed: true |
| `offline-launch` | root | `python3 .agents/skills/verify-frequency/scripts/control.py launch upkeep-20261110` | 0 | Foreground supervisor; loopback Local URL recorded; exited 0 after cleanup. |
| `doctor` | root | `python3 .agents/skills/verify-frequency/scripts/control.py doctor upkeep-20261110` | 0 | status: pass; feature: doctor; actions: 1; pageErrors/externalRequests: [] |
| `essays` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 essays` | 1 | Expected heading 'Representation Debt': element(s) not found; essays failed with exit 1 |
| `navigation` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 navigation` | 1 | Expected heading 'Essays': element(s) not found; doctor failed with exit 1 |
| `search` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 search` | 1 | Expected heading 'Essays': element(s) not found; doctor failed with exit 1 |
| `offline-cleanup` | root | `python3 .agents/skills/verify-frequency/scripts/control.py cleanup upkeep-20261110` | 0 | status: pass; port_released: 58111; scratch_removed: true; process group stopped; evidence preserved. |
| `solo-launch` | root | `python3 .agents/skills/verify-frequency/scripts/control.py launch upkeep-20261110-solo` | 0 | Foreground supervisor; loopback Local URL recorded; exited 0 after cleanup. |
| `solo-doctor` | root | `python3 .agents/skills/verify-frequency/scripts/control.py doctor upkeep-20261110-solo` | 0 | status: pass; feature: doctor; actions: 1; pageErrors/externalRequests: [] |
| `solo-essays` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110-solo essays` | 0 | status: pass; feature: essays; actions: 25; pageErrors/externalRequests: [] |
| `solo-navigation` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110-solo navigation` | 0 | status: pass; feature: navigation; actions: 9; pageErrors/externalRequests: [] |
| `solo-search` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110-solo search` | 0 | status: pass; feature: search; actions: 9; pageErrors/externalRequests: [] |
| `solo-cleanup` | root | `python3 .agents/skills/verify-frequency/scripts/control.py cleanup upkeep-20261110-solo` | 0 | status: pass; port_released: 43261; scratch_removed: true; process group stopped; evidence preserved. |
| `ingest-refusal` | root | `python3 .agents/skills/verify-frequency/scripts/control.py drive upkeep-20261110 ingest` | 1 | BLOCKED: Ingest requires an explicitly approved isolated Convex deployment and write identity. This helper will not mutate the shared live backend. (Expected refusal, before browser.) |
| `verify-final` | root | `APP_ENV=test vp run verify` | 0 | vp run: 10/10 successful; Tests 1764 / 234 / 453 / 153 passed. |
| `file-tokens` | root | `vp run check:file-tokens -- --all` | 0 | 0 tracked file(s) over 5,000 tokens outside the baseline; 105 over-limit file(s) within baseline. |
| `diff-check` | root | `git diff --check` | 0 | (no output) |

## Retained raw output

Full terminal logs remain **local only** under
`/tmp/frequency-upkeep-20261110/`. SHA-256 below identifies the original bytes;
GitHub readers can use the committed excerpts above without access to this host.
Synthetic browser/screenshots/trace and cleanup receipt locations are in the
checkpoint. Logs include expected warning/error text from negative test cases;
those lines alone do not indicate a suite failure.

| Log | SHA-256 |
| --- | --- |
| `install-root.log` | `90924b21a8b84e45ae164431950415eb261b0e6de764a094d4dd7bedc1a44e2e` |
| `chromium.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `build.log` | `0d2d0ff3299e8ed7c955ed70374783316baaab6b6cc190ee5dc4cba9122df34e` |
| `verify-baseline.log` | `ff870306f082fb8948feaf953923fc8ac29491dc4ae4678289419c7cba1aaae8` |
| `local-control.log` | `3752c461e8066dac28ae9ab73ea9293f3b0b6061a3fe0ae18083e35eeaabf2e4` |
| `local-safety.log` | `4bc9c0acc129a43220facb0767b41b27381afc50402556393481689fde17c85c` |
| `offline-control.log` | `40f8d18e28a297a6eef41f80a00833bf40ae5b6147fca8a0642fd86100bb6f69` |
| `offline-driver.log` | `76638605205cc2bd2f94fa03fe7659240d2bf3789948721b0989c4da2cad0cbb` |
| `ui.log` | `09d34c5decb81db8ea8b21518088078b72da8e3392aff197a132eca4842b26fc` |
| `listen.log` | `7cf8969b5bfe64eeec93b8966711731674f2b37d32e7761985664a9c87c2be95` |
| `auth.log` | `d15b2a89dd027188d2a84d294895712a03bdcf9aaa217876f8fa178f5373d2ff` |
| `feedback.log` | `4009b9799e60dde937bf9abc6c954f1dec8095f77e33ce586ee4e7de9cb52d14` |
| `targeted.log` | `330cbd0b3a31dc7fd0a3791302315652680927234057a7a8bc8dba0b7980ebb7` |
| `web-units.log` | `3fc7bbde3a79704ee27736bb852a776f2877a2764196c76edf4da39d43fccea4` |
| `web-units-root.log` | `1a041f88dc015da4ec0510e4875cb0c490ad2f907b866420abef021b340e5066` |
| `web-units-node.log` | `a6edf364be8e69f745c0f22330de26c2504c2b6a78a05b5cbb213987f4d06e54` |
| `persisted-auto.log` | `8e018eae345d22fb932d4e6b71eed83d7466892fa27ec145bf58bfc1a8581db3` |
| `persisted-start.log` | `f911462928e1b31c8e10aa45215f4aa1894287762379b67b10bec43b338a11c7` |
| `persisted-deploy.log` | `8e012c7113b92e5340ac0c181c7fc6f11e45873e99037e7249a698579240508e` |
| `persisted-exercise.log` | `edac7d099ddbdf5a022b10b54ae0c0267469d7834c52a60d498a40f2db0e2d17` |
| `persisted-stop.log` | `9de92595f96d5c576a9ab1811c866bb564386894bf382016b0f1c19cbf3d067a` |
| `offline-launch.log` | `18df00e2be54c05842284e11c4cb367f30f12090ca04fc40e1951ee728b4f17b` |
| `doctor.log` | `3f61f1b261162a1834fe1b591180bbcd57201bb9fcf47e43a4f55a7c49753dbb` |
| `essays.log` | `f91ffc45c808ab9328066319a8aec51b95d8d6370bed1cfcce59dc18c3601d07` |
| `navigation.log` | `df76cc72c9421213f3b6e43bfad7e4b4e1482569da1a0f7ec238f69510048713` |
| `search.log` | `b1aea62dd3e79bb7f2b39a28f2bf822b4eeba7a0f95c0a7a4a673e153acd4f21` |
| `offline-cleanup.log` | `cfbb98610e51e1f18c4bbe6260e7c5c5ab8d7487b03f406dfbab77f8c4acba61` |
| `solo-launch.log` | `3b8ac49c371255221940392aa15b59f6e5d1d0212d86212bf024df4f8afae32e` |
| `solo-doctor.log` | `964dfd2f54833ed2bc5089c59f41f476d2f61b3fa75b8d46e99119d8e54fea7b` |
| `solo-essays.log` | `5072ed11a2dd80d5566f0842f41617097087d07075b1c40dc99ba1493aa7aa3b` |
| `solo-navigation.log` | `c378ef1788b4fd7ad549b2790dbe5c8be5ca3f1e38607b57c00ec47cc92fa593` |
| `solo-search.log` | `ca81a621e6581b5888a3c1aca876d19868039347a0af52a1e22aa2ad9edd7764` |
| `solo-cleanup.log` | `86ffa9ad7d7ee3002968e37c91a33079a8c41c7e662610a18ba5049af5bd757f` |
| `ingest-refusal.log` | `4f6d41826644ffd6be9dbed8d2b8fdf39199c1bca877789ad3462b9fadeb0c29` |
| `verify-final.log` | `6812a520dae9a4f58b1221d0b868e483ce2975faf7b7a1c2d34d27a6d06f0af1` |
| `file-tokens.log` | `65bdd4a5a54231b0aa2dfae852878bc5f5452a28b0d3d99dffca1d85ad28817c` |
| `diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
