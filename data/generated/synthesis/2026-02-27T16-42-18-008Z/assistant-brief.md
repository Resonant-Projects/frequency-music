# Assistant Reasoning Brief

You are synthesizing one testable hypothesis and one DAW-ready recipe from multiple sources.
Prioritize rigor, traceability, and implementation readiness.

## Inputs
- Context JSON: context.json
- Context Markdown: context.md
- Available source citations: S1, S2, S3, S4, S5, S6, S7, S8

## Hard Constraints
- Use only evidence present in the provided context pack.
- Cite supporting sources in rationale/body using citation handles `S#` (e.g. `S1`, `S3`).
- Do not call external APIs or infer unsupported factual claims.
- Produce one coherent hypothesis and one coherent recipe.
- Include at least 3 distinct citations in rationale unless fewer than 3 sources were selected.
- If sources conflict, explicitly name the conflict and explain chosen interpretation.
- Prefer an experimental question that is meaningfully different from recent runs (new variable framing or protocol emphasis).

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

## Quality Rubric (Self-check before finalizing)
- Evidence quality: Prefer claims tagged `peer_reviewed`, then `anecdotal/speculative` only as secondary support.
- Causality: Hypothesis must specify cause, expected effect, and why mechanism is plausible from cited evidence.
- Experimental control: Recipe must isolate what changes vs what stays constant.
- Operational detail: Parameters include concrete values and units; checklist steps are executable in sequence.
- Falsifiability: Include what observation would count as disconfirming evidence.

## Failure Conditions (Reject and rewrite if any are true)
- Uses no citations or only one citation despite broader source set.
- Contains claims not grounded in context pack.
- Uses vague placeholders ("interesting", "better sound") without measurable criteria.
- Protocol omits `whatVaries` or `whatStaysConstant`.

## Suggested Output Style
- Keep titles short and concrete.
- Use markdown in rationale/body with inline citation handles (e.g. `... [S2]`).
- Keep hypothesis in a single, testable if/then statement.
