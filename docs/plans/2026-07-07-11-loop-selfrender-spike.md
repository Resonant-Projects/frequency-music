# Self-Rendering Micro-Studies — Bounded Spike

> **For agentic workers:** This is a SPIKE, not a feature plan. The deliverable is a **report and a go/no-go recommendation**, plus throwaway-quality render code. Do not productionize anything. REQUIRED SUB-SKILL: superpowers:executing-plans. **Prerequisite: plan 10 (kits provide the tuning + seed inputs).**

## Executor brief

- Answer one question: **can machine-rendered micro-studies produce listening data Keith trusts?** (Session Q14: micro-studies are one-variable, minimally artistic — the most mechanizable object in the ontology and the only thing between conjectures and embodied evidence.)
- Render 2–3 real recipes' micro-studies headlessly; run the validation protocol (machine vs human rendering of the same recipe); write the report.
- **Time-box: 2 focused days of implementation effort.** When the box is hit, write the report with whatever exists.

## The methodological caveat (binding, from the session)

Machine-rendered studies must be validated against **at least one human-produced rendering of the same recipe** before their listening data is trusted. The risk being tested: bad sound design contaminating the litmus — a listener rating the render quality, not the hypothesis variable.

## Non-goals / rabbit holes

- **No** production render pipeline, queue, or Convex integration — a script that emits WAV/MP3 files is the whole ambition.
- **No** engine shoot-out beyond the first engine that works; note alternatives, don't build them.
- **No** DAW automation (the Ableton Extensions SDK is recorded as an assist path to *evaluate in the report*, not to build now).
- **No** new hypothesis/recipe content — use existing recipes.

---

### Task 1: Engine choice (½ day cap)

Candidates, in recommended trial order:

1. **SuperCollider headless** (`sclang`/`scsynth` NRT mode) — mature, scriptable, full Scala-tuning support via direct frequency control; installable via Homebrew.
2. **Csound** — equally capable NRT rendering; steeper syntax.
3. **Pure TypeScript offline DSP** (write samples → WAV in Bun) — zero external deps, maximal control, most implementation work for acceptable timbre.

Pick the first one that renders a 30s sine-cluster test tone in the target tuning from a script. Record the choice + friction notes for the report. (TypeScript-always rule note: the repo doctrine prefers TS, but SC/Csound here are *external renderers driven by TS scripts*, like ffmpeg — the driver stays TypeScript.)

- [ ] Engine chosen; hello-tuning render exists.

---

### Task 2: Render 2–3 micro-studies (1 day cap)

**Files:** `scripts/spike-render/` (explicitly throwaway; README says so)

Input: plan-10 kit (tuning spec + seed MIDI + protocol) for 2–3 recipes with `studyType: "litmus"` protocols. Render contract per the micro-study definition: 30–90s, ONE variable expressed, deliberately plain timbre (the same 2–3 synth voices across all renders — timbre must not vary between comparisons), `whatStaysConstant` honored.

- [ ] 2–3 rendered artifacts exist (WAV + MP3), named `<recipe-slug>-machine-v0.wav`.

---

### Task 3: Validation protocol (elapsed time, not effort — runs while reporting)

1. Keith (or a collaborator) produces a **human rendering** of ONE of the same recipes — quick studio pass, same duration, same constraint sheet.
2. Blind-ish A/B listening session (existing `listeningSessions` capture, `contextMd` marks the spike): does the machine render evoke ratings *about the hypothesis variable*, or ratings about render quality? Divergence between machine and human ratings on the same recipe = the contamination signal.
3. Log both sessions.

- [ ] Validation sessions logged.

---

### Task 4: Report + go/no-go

**Files:** `docs/plans/2026-07-07-11-spike-report.md`

Must answer: engine + friction · render quality honestly (embarrassments included) · validation result (contamination signal or clean) · cost per render (compute + authoring) · Ableton Extensions SDK assessment (does DAW-assisted beat headless for this?) · **recommendation**: go (draft the production plan), no-go (starter kits remain the floor; studio remains the render path), or go-with-conditions.

Update `docs/decision-log.md` with the outcome either way (the session pre-registered the revisit trigger: *if machine renders fail validation, self-rendering retreats to starter kits*).

- [ ] Report committed; decision-log updated.

---

## Done means

- The question is answered with evidence: rendered artifacts + logged listening sessions + a written recommendation.
- Nothing from the spike leaked into production paths.
- Time-box respected (report notes actual effort spent).
