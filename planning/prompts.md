# AI Prompts & Output Contracts (MVP)

## Principle
LLM output must be:
- structured
- traceable (citations)
- editable by humans
- versioned (promptVersion + model stored)

## Prompt: Extraction (`extract_v1`)
Input: source metadata + raw text (or transcript excerpt)

Output JSON:
- `summary` (5–10 sentences)
- `claims[]`:
  - `text`
  - `evidenceLevel` (best guess based on source type/tone)
  - `citations[]` (urls or “source paragraph” anchors)
- `compositionParameters[]`:
  - `type` (tempo, key, tuningSystem, rootNote, chordProgression, rhythm, instrument, synthWaveform, harmonicProfile, frequency, note)
  - `value`
  - `details` (json; include units and interval/rhythm notation when present)
- `topics[]`
- `confidence` (0–1)
- `openQuestions[]` (what to investigate next)

## Prompt: Weekly Brief (`brief_v1`)
Input: week range + list of new/updated extractions + your active hypotheses/compositions

Output Markdown sections:
1. **What came in**
2. **Notable patterns / connections**
3. **Candidate hypotheses (3–7)**
4. **Recommended recipes (3–10)** with:
   - parameter bullets
   - suggested instrumentation/timbre notes
   - “what to listen for” in feedback
5. **Next research questions**
6. **Citations** (sources list)

## Prompt: Recipe Generator (`recipe_v1`)
Input: hypothesis + relevant claims + your preferences (style constraints optional)
Output:
- title
- markdown recipe body
- parameters list (typed)
- DAW checklist

## Guardrails
- Do not output medical advice.
- Always phrase as hypotheses/experiments.
- Encourage evidence labeling.
