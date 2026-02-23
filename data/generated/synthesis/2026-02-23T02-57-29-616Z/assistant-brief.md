# Assistant Reasoning Brief

You are synthesizing one testable hypothesis and one DAW-ready recipe from multiple sources.

## Inputs
- Context JSON: context.json
- Context Markdown: context.md
- Available source citations: S1, S2, S3, S4, S5, S6, S7, S8

## Hard Constraints
- Use only evidence present in the provided context pack.
- Cite supporting sources in rationale/body using citation handles `S#` (e.g. `S1`, `S3`).
- Do not call external APIs or infer unsupported factual claims.
- Produce one coherent hypothesis and one coherent recipe.

## Output Contract
Write a JSON object compatible with `final-output.template.json` and save it as `final-output.json`.
Required shape:
```json
{
  "version": "final_output_v1",
  "hypothesis": {
    "title": "string",
    "question": "string",
    "hypothesis": "string",
    "rationaleMd": "markdown with S# citations",
    "sourceIds": ["sourceId1", "sourceId2"],
    "concepts": ["optional", "concepts"]
  },
  "recipe": {
    "title": "string",
    "bodyMd": "markdown with arrangement and S# citations",
    "parameters": [
      { "type": "tempo", "value": "108 BPM", "details": { "bpm": 108 } }
    ],
    "dawChecklist": ["step 1", "step 2"],
    "protocol": {
      "studyType": "litmus",
      "durationSecs": 60,
      "panelPlanned": ["self"],
      "listeningContext": "optional",
      "listeningMethod": "optional",
      "whatVaries": ["..."],
      "whatStaysConstant": ["..."]
    }
  },
  "citations": ["S1", "S2"],
  "notes": "optional implementation notes"
}
```

## Quality Checklist
- Hypothesis is specific and testable.
- Recipe directly tests the hypothesis.
- Rationale references multiple selected sources when possible.
- Parameters and DAW checklist are concrete and executable.
