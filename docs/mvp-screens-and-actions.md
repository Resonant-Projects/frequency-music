## MVP Screens (SolidJS App)

### 1) Inbox
- list new items (RSS + Notion + manual drops)
- actions:
  - “Extract now”
  - “Ignore”
  - “Open source”

### 2) Source Detail
- raw content link
- extraction preview
- quick edit: title/visibility/license notes

### 3) Hypothesis Builder
- select claims/notes as rationale
- write hypothesis statement
- choose target thresholds (bodily/goosebumps/consonance/etc.)
- queue for weekly brief

### 4) Experiment Designer (Protocol + Recipe)
- protocol form (litmus vs comparison)
- micro-study recipe form with defaults:
  - 16–32 bars, 4/4, BPM 100–125
  - “allow extended BPM” checkbox (80–145) with justification note

### 5) Run Study (Checklist)
- render/export checklist
- “start listening session”
- quick rating form (self first)

### 6) Observations + History
- timeline of artifacts + ratings
- compare A/B artifacts side-by-side
- show ear vs computed consonance deltas

### 7) Weekly Brief
- generate (server action)
- shows 1–3 experiment cards
- “lock brief” (freeze content for the week)

---

## Background Jobs / Actions
- nightly RSS poll → inbox
- notion sync (scheduled) → inbox
- extraction worker (queue) → extractions
- weekly brief generator (Friday) → weeklyBriefs
- optional: compute consonance worker after artifact upload
