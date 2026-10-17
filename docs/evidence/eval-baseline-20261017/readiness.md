# Plan 008 readiness — 2026-10-17

This package follows the [preflight](preflight.md) and the
[runner repair](runner-repair.md), both from the same day, at base `57f7c90`.
**No eval ran, no dataset was uploaded, no paid call was made, no Convex
command ran and no score was recorded.** `docs/eval-baselines.md` keeps every
`—`.

**Verdict: BLOCKED on three human decisions, otherwise ready.** Credentials
now resolve, and the tooling self-tests pass. Once Keith decides the items in
[Decisions](#decisions) and the ratified rows are materialized and pass the
[drift check](#ratification-and-drift-check), extraction and hypotheses can be
baselined with the [runbook](#runbook). Weekly briefs remain under STOP 4:
a read-only production export later that day found no further eligible brief,
because production holds no thesis rows (see the
[curation sheet](../../../data/eval/curation-2026-10-17.md#weekly-briefs--none-eligible)).

## Checks

| Gate | Check | Result |
| --- | --- | --- |
| Drift | `git diff --stat 819b4ec..57f7c90 -- scripts/langsmith/ docs/eval-baselines.md` | Empty: nothing changed after the runner repair's last commit. |
| STOP 1 | `vpx varlock run -- node -e '…Boolean(ANTHROPIC_API_KEY), Boolean(LANGSMITH_API_KEY)'` on host `devbox`, 2026-10-17T03:00Z | Exit 0, `true true`. Every `@required` secret resolved. Only booleans were printed. Credential access was not changed. This clears STOP 1 for this host at that time only. |
| STOP 2 | `vp test scripts/langsmith/` | 12 files, 123 tests, all passing, with no network. |
| STOP 3 | `upload-datasets.ts` and `buildMissingExamples` | Unchanged and still idempotent: an example whose inputs and outputs already exist is skipped. The upload never deletes, so a row removed locally after upload stays in LangSmith. Ratify before uploading. |
| STOP 4, extraction | `data/eval/extractions-golden.jsonl` | 18 rows. Clear. |
| STOP 4, hypothesis | `data/eval/hypotheses-golden.jsonl` | 4 rows. **Blocked** until Keith ratifies rows proposed in [`curation-2026-10-17.md`](../../../data/eval/curation-2026-10-17.md). The recommendation (H5–H7 kept, H4 dropped) gives 6; keeping H4 gives 7. A fresh read-only check found no drift in H5–H7. |
| STOP 4, weekly brief | `data/eval/weekly-briefs-golden.jsonl` | 2 rows. **Blocked.** The 2026-10-17T03:12Z read-only export read all 18 production briefs. Only the ratified 2026-07-06 pair passes the export filter, and none of the other 16 references an active thesis, because production has 0 thesis rows. |
| Recipe | — | No runner and no golden file. The section stays `—`. |

## Upload content

`upload-datasets.ts` uploads all three golden files in one run, and it has no
per-dataset flag. These are the hashes of the current golden files. Adding
hypotheses re-runs the materializer, which rewrites all three files, so the
upload is then approved by the regenerated files' hashes, after the
[drift check](#ratification-and-drift-check) passes.

| File | Rows | sha256 | Private text |
| --- | --- | --- | --- |
| `extractions-golden.jsonl` | 18 | `006f94985c364c5263fead819af22343fa66930a811e9fbfdc655bb73bd93c3a` | Yes: source `rawText` |
| `hypotheses-golden.jsonl`, as ratified | 4 | `69e28a4079da1edf6f9afa37792c797ca94464269d63fe3f05674a5c7e2ab82e` | No `rawText` |
| `weekly-briefs-golden.jsonl` | 2 | `9f836cd476cd79ae5c90a82c00104bca892d5644ad9e0d11125c9391c6c8a5f6` | No `rawText` |

The upload also creates the 2-row weekly-brief dataset even while briefs are
blocked. The dataset is harmless, but it is part of what is approved.

## Cost estimate

Prices are Anthropic's first-party standard rates from the primary pricing
page (`platform.claude.com/docs/en/about-claude/pricing.md`), fetched
2026-10-17. The runners send no `inference_geo`, so the 1.1× US-only
multiplier does not apply, and they use no cache or batch discount.

| Model (task) | Input $/MTok | Output $/MTok |
| --- | --- | --- |
| Claude Sonnet 5.5 (`extract_v3`, `brief_v2`) | 2.00 | 10.00 |
| Claude Opus 5.5 (`hypothesis_v1`) | 4.00 | 20.00 |
| Claude Haiku 5.5 (judge; prompts ≤100K tokens) | 0.10 | 0.50 |

Method:

- **Input.** Each runner's prompt was rendered offline from the golden rows,
  exactly as the runner builds it. Extraction uses `EXTRACT_SYSTEM_PROMPT` and
  `renderExtractionPrompt`. Hypothesis and brief use the inline `v1` prompts.
  Characters were converted at **3 characters per token**, a deliberate
  overcount of the usual ~4 that also covers newer tokenizers. No tokenizer was
  available offline.
- **Output.** Every call is priced at its full cap. Adaptive thinking tokens
  bill as output and count against the cap. The caps are extraction 8000,
  hypothesis 6000 (Opus, high effort), brief 8000 and judge 5000. A response
  that reaches the cap fails the run, so a completed run always costs less.
- **Judge input.** The judge prompt holds the cited hypotheses and failures,
  plus the brief's output, priced at its full 8000-token cap. Each judge
  prompt is about 13K tokens, far under Haiku's 100K price step.
- **Retries.** The AI SDK (`ai` 7.0.137) retries a failed call up to 2 times
  by default. The worst case assumes one billed attempt per call, because a
  retry follows an error response. The ceiling column triples everything for
  the unlikely case that every call is billed three times.

Worst case for three runs per target:

| Target | Rows | Input tok/run | Max output tok/run | Worst case per run | Three runs |
| --- | --- | --- | --- | --- | --- |
| Extraction (Sonnet 5.5) | 18 | 37,829 | 144,000 | $1.52 | $4.55 |
| Hypothesis (Opus 5.5), 4 ratified rows | 4 | 5,277 | 24,000 | $0.50 | $1.50 |
| Hypothesis (Opus 5.5), with 3 proposed rows | 7 | 9,251 | 42,000 | $0.88 | $2.63 |
| Weekly brief (Sonnet 5.5) | 2 | 26,033 | 16,000 | $0.21 | $0.64 |
| Weekly-brief judge (Haiku 5.5) | 2 | 25,775 | 10,000 | $0.01 | $0.02 |
| Weekly brief and judge, per added brief row | +1 | ≤25,904 | +13,000 | ≤$0.11 | ≤$0.33 |

Scenarios:

| Scenario | Worst case | With 1.5× margin | Retry ceiling (3×) |
| --- | --- | --- | --- |
| **Stage 1: extraction 18 and hypothesis 7** (briefs blocked) | **$7.18** | **$10.77** | $21.53 |
| Stage 1 with hypothesis at 5 rows (largest proposed row) | $6.43 | $9.64 | $19.28 |
| Stage 2: weekly brief at 5 rows, with judge | $1.65 | $2.47 | $4.94 |
| Full plan target: 18, 15, 6 | $12.20 | $18.31 | $36.61 |

Every added hypothesis row adds at most $0.38 (Opus, three runs). Every added
brief row adds at most $0.33. The added-row figures use the largest existing
row.

**Proposed budget request: $11 for stage 1.** It covers the recommended 6
hypothesis rows and the 7-row case alike. Stage 2 gets its own approval once
briefs are curated.

**Not priced: LangSmith.** Stage 1 creates 75 traced target runs plus their
feedback. The cost depends on the LangSmith plan, so it is unknown here.

STOP 6 check: after extraction run 1, the Anthropic console usage for that run
should be at most about $1.52. If it is higher, pause before run 2.

## Decisions

Only three decisions need a human. The mechanical work that applies the first
one is already authorized by the parent task and needs no separate approval:
the materializer edit (`HYPOTHESIS_IDS`, plus the H4 extraction pin), its
read-only production run, and the [drift check](#ratification-and-drift-check).
Read-only exports are authorized the same way.

1. **Ratification (Keith).** Accept or reject H5, H6 and H7, and choose H4
   (a) keep or (b) drop, in
   [`curation-2026-10-17.md`](../../../data/eval/curation-2026-10-17.md).
   The sheet recommends keeping all three and dropping H4. For weekly briefs,
   either leave the section `—` (recommended), or amend the brief criterion
   that requires an active thesis. No brief in production meets it.
2. **Upload approval.** Approve the exact bytes by the regenerated files'
   hashes, including the private extraction `rawText`.
3. **Budget.** Approve stage 1 at $11. Stage 2 is approved later.

## Ratification and drift check

After the materializer regenerates the golden files, run this from the
repository root. It needs no secrets and makes no network call. It compares
every upload key of every regenerated row with the approved snapshot: the
golden files at `57f7c90` plus the proposed hypothesis file. It ignores the
`sources` and `thesis` fields, which the upload does not read. A changed row,
or a row outside the snapshot, prints `DRIFT`, and those rows go back to Keith
before any upload. With `MATCH`, record the new `sha256sum` values as the
upload approval. If any row size changed, recompute the cost estimate.

The check accepts exactly one approved delta. The H4 extraction pin
(`HYPOTHESIS_EXTRACTION_REPOINTS`, see the curation sheet) makes the
materializer set `extractionIds` to `["j97f14ww3grvkgbgx82zppkj5x86hmsg"]` on
the H4 copy embedded in each ratified brief, where the snapshot has `[]`. The
upload reads the whole `hypotheses` array, so this is uploaded content. A brief
that differs only by that field prints `matches with the approved H4 pin
delta`. Any other difference is still `DRIFT`. The standalone H4 row is
unaffected, because `extractionIds` is not a hypothesis upload key.

A read-only simulation of the materializer's enrichment on 2026-10-17 found
that, without the pin, H4 and both brief rows change `claims`,
`compositionParameters` and `topics`, which this check reports as `DRIFT`. Add
the pin with the ratification edit.

The check was tested offline. Against the current files it prints `MATCH`. A
temporary copy with all proposed rows appended, and one `rationaleMd` edited,
reports `DRIFT` on that row and ignores an added `sources` field. A copy whose
briefs carry only the pinned `extractionIds` prints the pin-delta line and
`MATCH`. With the pin plus one changed claim in an embedded H4, it prints
`DRIFT`.

```bash
python3 -I - <<'EOF'
import copy, json, os, subprocess
# The one approved metadata delta: the H4 extraction pin sets `extractionIds` on
# the H4 copy embedded in each ratified brief (empty in the snapshot).
H4, H4_PIN = "jh7d82hc6s34cdww0k25sb4gd18aafhv", ["j97f14ww3grvkgbgx82zppkj5x86hmsg"]
def with_pin(brief):
    pinned = copy.deepcopy(brief)
    for h in pinned.get("hypotheses", []):
        if h.get("_id") == H4 and not h.get("extractionIds"):
            h["extractionIds"] = list(H4_PIN)
    return pinned
KEYS = {
    "extractions": ["sourceTitle", "sourceType", "rawText", "summary", "claims", "compositionParameters", "topics", "openQuestions"],
    "hypotheses": ["sourceTitle", "claims", "compositionParameters", "topics", "title", "question", "hypothesis", "whyThisMatters", "rationaleMd"],
    "weekly-briefs": ["weekOf", "hypotheses", "recipes", "theses", "failures", "bodyMd", "studioPrompts", "todo"],
}
def rows(text):
    return {r["_id"]: r for r in (json.loads(l) for l in text.splitlines() if l.strip())}
after_dir = os.environ.get("CHECK_DIR", "data/eval")
drift = False
for family, keys in KEYS.items():
    path = f"data/eval/{family}-golden.jsonl"
    approved = rows(subprocess.run(["git", "show", f"57f7c90:{path}"], capture_output=True, text=True, check=True).stdout)
    if family == "hypotheses":
        approved.update(rows(open("data/eval/proposed/hypotheses-golden.proposed-2026-10-17.jsonl").read()))
    after = rows(open(f"{after_dir}/{family}-golden.jsonl").read())
    for row_id, row in after.items():
        ref = approved.get(row_id)
        changed = ["(not in the approved snapshot)"] if ref is None else [k for k in keys if row.get(k) != ref.get(k)]
        if changed and ref is not None and family == "weekly-briefs":
            pinned = with_pin(ref)
            if pinned != ref and all(row.get(k) == pinned.get(k) for k in keys):
                print(f"{family} {row_id}: matches with the approved H4 pin delta")
                changed = []
        if changed:
            drift = True
            print(f"{family} {row_id}: {', '.join(changed)}")
    print(f"{family}: {len(after)} rows")
print("DRIFT: return these rows to Keith before upload" if drift else "MATCH: upload keys equal the approved snapshot")
EOF
```

## Runbook

Run from the repository root on a host where the Varlock check passes. Keep
logs outside the repository. Each step can be resumed: a run counts only when
its log ends in `exit=0` and has a completion line, and a missing or failed
log is simply redone.

```bash
# 0. Setup. N_HYP is the ratified hypothesis row count (5..7).
export RUN_DIR="$HOME/.local/state/frequency-eval/plan008-$(date -u +%Y%m%d)"
mkdir -p "$RUN_DIR"
vp test scripts/langsmith/                     # all pass, or STOP 2
sha256sum data/eval/*-golden.jsonl             # must equal the approved hashes
wc -l data/eval/hypotheses-golden.jsonl        # must equal N_HYP and be >= 5

# 1. Upload, then upload again. The second run must say "already has all N local
#    examples" for every dataset; any upload on the second run is STOP 3.
vpx tsx scripts/langsmith/upload-datasets.ts > "$RUN_DIR/upload-1.log" 2>&1; echo "exit=$?" >> "$RUN_DIR/upload-1.log"
vpx tsx scripts/langsmith/upload-datasets.ts > "$RUN_DIR/upload-2.log" 2>&1; echo "exit=$?" >> "$RUN_DIR/upload-2.log"

# 2. One run at a time: run_eval <target> <runner> <i>. A run whose log already
#    passes is skipped, so the step can be repeated after an interruption.
#    run_eval returns non-zero when the runner fails, and the chain below
#    stops at the first failure. If a run fails, rename its log
#    to <target>-<i>.fail1.log and rerun that step. A second failure of the same
#    run is STOP 5: run_eval says so; report the error lines and stop.
run_eval() {
  local log="$RUN_DIR/$1-$3.log" rc
  if [ -f "$log" ] && grep -qx 'exit=0' "$log" && grep -q '^EVAL_RUN_COMPLETE ' "$log"; then
    echo "skip $log (passed)"; return 0
  fi
  vpx tsx "scripts/langsmith/$2" > "$log" 2>&1; rc=$?
  echo "exit=$rc" >> "$log"
  tail -n 3 "$log"
  if [ "$rc" -ne 0 ] || ! grep -q '^EVAL_RUN_COMPLETE ' "$log"; then
    if [ -f "$RUN_DIR/$1-$3.fail1.log" ]; then
      echo "STOP 5: $1 run $3 failed twice; report the error lines and stop" >&2
    else
      echo "FAILED $log: rename it to $1-$3.fail1.log and rerun this step once" >&2
    fi
    return 1
  fi
}
run_eval extraction eval-extraction.ts 1
# STOP 6: check run 1's cost in the Anthropic console. Only when it is within
# the limit, record that with `touch "$RUN_DIR/stop6-ok"`. The chain below
# refuses to start without that file and stops at its first failure.
[ -f "$RUN_DIR/stop6-ok" ] &&
  run_eval extraction eval-extraction.ts 2 && run_eval extraction eval-extraction.ts 3 &&
  run_eval hypothesis eval-hypothesis.ts 1 && run_eval hypothesis eval-hypothesis.ts 2 &&
  run_eval hypothesis eval-hypothesis.ts 3
# eval-weekly-brief.ts only after briefs reach >= 5 rows and stage 2 is approved.
```

`run_eval` and the chain were exercised offline with stubbed runners, so no
eval ran. Without `stop6-ok`, only extraction 1 runs. When every run passes,
all six run. When hypothesis 1 fails, the chain stops there. An exit-0 log
without a completion marker counts as a failure. A second failure after a
`.fail1.log` prints STOP 5.

Step 3 reads the means. This reader is read-only against LangSmith. It
refuses a log without `exit=0` or a completion line, or one that contains
`EVAL RUN FAILED`. It also refuses a run whose example count differs from the
expected count, which catches a dataset with stale or extra rows in LangSmith.
It requires exactly three runs and reads `feedback_stats` through
`readMeansForExperiment` from `promote.ts`. With `PARSE_ONLY=1` it checks the
logs offline. The guards were exercised offline against synthetic logs. The
LangSmith read path was not run, because no experiment exists yet.

```bash
cat > "$RUN_DIR/read-means.mts" <<'EOF'
// Usage (repo root): EXPECTED_EXAMPLES=<n> vpx tsx <this file> <run logs...>
// Prints per-run means and the three-run mean for one target. Read-only.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const repo = process.cwd();
const { parseCompletionMarker } = await import(resolve(repo, "scripts/langsmith/run-guard.ts"));
const expected = Number(process.env.EXPECTED_EXAMPLES);
if (!Number.isInteger(expected) || expected < 5) throw new Error("EXPECTED_EXAMPLES must be an integer >= 5 (STOP 4)");
const logs = process.argv.slice(2);
const runs = logs.map((path) => {
  const text = readFileSync(path, "utf8");
  if (!/^exit=0$/m.test(text)) throw new Error(`${path}: no exit=0 line; not a usable run`);
  if (/EVAL RUN FAILED/.test(text)) throw new Error(`${path}: EVAL RUN FAILED; not a usable run`);
  const marker = parseCompletionMarker(text);
  if (!marker) throw new Error(`${path}: no EVAL_RUN_COMPLETE marker`);
  if (marker.examples !== expected) throw new Error(`${path}: ${marker.examples} examples, expected ${expected}; dataset drifted, STOP`);
  return { path, marker };
});
for (const r of runs) console.log("ok", r.path, JSON.stringify(r.marker));
if (process.env.PARSE_ONLY === "1") process.exit(0);
if (runs.length !== 3) throw new Error(`${runs.length} runs given; a baseline needs exactly 3`);
// promote.ts loads varlock/auto-load, so LANGSMITH_API_KEY is set before the client exists.
const { readMeansForExperiment, averageMeans } = await import(resolve(repo, "scripts/langsmith/promote.ts"));
const { Client } = await import(createRequire(resolve(repo, "package.json")).resolve("langsmith"));
const client = new Client();
const perRun = [];
for (const r of runs) {
  const means = await readMeansForExperiment(client, r.marker);
  console.log("means", r.marker.experiment, JSON.stringify(means));
  perRun.push(means);
}
const avg = averageMeans(perRun);
console.log("three-run mean (2 dp):", JSON.stringify(Object.fromEntries(Object.entries(avg).map(([k, v]) => [k, Number(v.toFixed(2))]))));
EOF

# 3. Read the means.
EXPECTED_EXAMPLES=18 vpx tsx "$RUN_DIR/read-means.mts" "$RUN_DIR"/extraction-{1,2,3}.log | tee "$RUN_DIR/extraction-means.txt"
EXPECTED_EXAMPLES="$N_HYP" vpx tsx "$RUN_DIR/read-means.mts" "$RUN_DIR"/hypothesis-{1,2,3}.log | tee "$RUN_DIR/hypothesis-means.txt"
```

Steps 4 and 5 follow plan 008:

4. **Record.** In `docs/eval-baselines.md`, replace only the last cell of each
   filled row with its three-run mean. Set each section's `Date:` and
   `Experiments:` to the three experiment names from the `ok` lines. Change the
   status line only for the targets that were baselined, and keep the
   simplified-prompt caveat. Rows that stay `—`: hypothesis `judge` (no
   evaluator), the Codex comparison rows (no provider flag), recipe (no runner)
   and, until stage 2, the weekly-brief section.
5. **Check.** Run the plan's offline `parseBaselinesDoc` command with
   `APP_ENV=test`, then `vp test scripts/langsmith/`.
