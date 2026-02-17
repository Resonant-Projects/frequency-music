## Evaluation Metrics + Computed Consonance (Ear + Math)

### Why both?
You’ll encounter cases where:
- mathematically “consonant” materials feel harsh due to timbre/voicing/context, or
- mathematically “rough” materials feel good artistically.

So we track **Ear Consonance** and **Computed Consonance** side-by-side, not as a single truth.

---

## Subjective Metrics (0–5)
All metrics are rated per listener per artifact.

1) **Bodily Pleasantness (0–5)**
- 0: aversive / tense
- 3: neutral-to-pleasant
- 5: strongly pleasant, embodied, “settling” or “energizing” in a good way

2) **Goosebumps / Chills (0–5)**
- 0: none
- 3: noticeable moment(s)
- 5: strong + repeatable

3) **Perceived Consonance — Ear (0–5)**
- 0: clashing/abrasive
- 3: mixed
- 5: blended/coherent

4) **Musicality / Listenability (0–5)**
- 0: sounds like a lab test only
- 3: listenable as a sketch
- 5: would play for someone without caveats

5) **Ease of Composability (0–5)**
- 0: blocked / too restrictive
- 3: workable with effort
- 5: flows; easy to expand

Required qualitative notes:
- body map (where it’s felt)
- standout timestamps (“0:22 swell hits chest”)
- what felt “off” (if anything)

---

## Computed Consonance (v1 approach)
### Goal
Compute a lightweight “roughness / dissonance risk” estimate to compare across artifacts and to validate or challenge ear impressions.

### Practical constraints
We may not have stems/MIDI or precise partial tracking. So v1 computes from:
- declared recipe pitch material (if provided as MIDI notes/ratios)
- optional: audio analysis snapshot (spectral peaks)

### Recommended v1 computation: two-tier method

#### Tier A: Pitch-only roughness proxy (fast, robust)
Input:
- pitch set per bar/segment (MIDI note numbers or frequencies)
- optional weights per voice (velocity/loudness proxy)

Method:
- Convert notes to frequencies using tuning system + reference pitch
- For each pair of simultaneous frequencies \(f_i, f_j\), compute:
  - interval ratio deviation from small-integer ratios (JI proximity score), OR
  - cents distance to nearest “consonant set” under selected tuning rules
- Aggregate as a “roughness risk score” per segment.

Output:
- `computedConsonancePitch` normalized 0–1 (1 = most consonant)

Pros:
- Works even without audio
- Maps cleanly to your recipe constraints

#### Tier B: Audio spectral roughness estimate (optional, better)
Input:
- short rendered audio (WAV/MP3)
Method (high level):
- STFT on windows
- detect dominant spectral peaks (partial candidates)
- apply a psychoacoustic roughness model to peak pairs (common in timbre/dissonance literature)
- aggregate into `computedRoughnessAudio`

Output:
- `computedConsonanceAudio` normalized 0–1

Notes:
- This is sensitive to mix/FX; store render settings and LUFS approx.

---

## How to use computed values
- If **Ear Consonance high** but **Computed low**:
  - timbre/mix/context may be masking roughness pleasantly; note the conditions.
- If **Ear Consonance low** but **Computed high**:
  - investigate voicing, register, transient content, modulation, rhythmic density, or listener fatigue.

---

## Exit criteria suggestions (starter)
- Expand if:
  - bodily pleasantness ≥ 3 AND ease ≥ 3
  - AND (goosebumps ≥ 2 OR musicality ≥ 3)
- Revise if:
  - ear consonance ≤ 2 OR computed consonance ≤ 0.4 (twice)
- Retire if:
  - bodily pleasantness ≤ 1 in two separate sessions

These thresholds are tunable; store them as part of the hypothesis version.
