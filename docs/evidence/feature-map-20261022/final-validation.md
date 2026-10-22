# Final validation

After authoring the documents/skill, repeated from repository root:

```bash
APP_ENV=test vp run verify
```

Exit **0** on unchanged application baseline `a9b728466f9254938e40761e012451b4d896825b`. Final full log is hashed in `command-log-manifest.json`. Relevant output, warnings omitted:

```text
$ biome format . ⊘ cache disabled
$ vp lint convex harness scripts --tsconfig tsconfig.json ⊘ cache disabled
$ vpx tsc --noEmit ⊘ cache disabled
~/web$ vpx tsc --noEmit ⊘ cache disabled
~/agent$ vpx tsc --noEmit ⊘ cache disabled
~/media$ vpx tsc --noEmit ⊘ cache disabled
$ vp test convex scripts ⊘ cache disabled
 Test Files  141 passed (141)
      Tests  1620 passed (1620)
   Start at  20:31:14
   Duration  28.68s (tests 80%, import 16%, transform 3%, worker 1%)
$ vp test harness ⊘ cache disabled
 Test Files  25 passed (25)
      Tests  234 passed (234)
   Start at  20:31:42
   Duration  3.92s (tests 65%, import 25%, transform 9%, worker 1%)
~/agent$ vp test ⊘ cache disabled
 Test Files  38 passed (38)
      Tests  430 passed (430)
   Start at  20:31:47
   Duration  10.75s (tests 56%, import 39%, transform 4%, worker 1%)
~/media$ ./node_modules/.bin/vp test ⊘ cache disabled
 Test Files  16 passed | 1 skipped (17)
      Tests  141 passed | 6 skipped (147)
   Start at  20:31:58
   Duration  19.87s (tests 97%, import 3%, transform 1%)
vp run: 10/10 successful. (Run `vp run --last-details` for full details)
```

Additional checks:

```text
python3 /home/kelliott/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/verify-frequency
Skill is valid!

vp run check:file-tokens
$ node scripts/check-file-tokens.mjs
(exit 0)

git diff --cached --check
(no output, exit 0)
```

A local audit script also confirmed 47 unique feature IDs, relative source/document links, every new file under 20,000 bytes, every retained raw artifact matching its committed SHA-256/size, passing browser result receipts with no page/external-request errors, and finalized valid trace ZIPs. Output:

```text
PASS: 47 unique feature IDs; authored links/size; raw evidence checksums; finalized traces and results
```

Final listener inspection found none of the owned ports listening (59117, 4186, 4187, 4188, 5192). All tracked changes are audit Markdown/JSON evidence and the new skill; no product/configuration/lockfile/fixture modifications.
