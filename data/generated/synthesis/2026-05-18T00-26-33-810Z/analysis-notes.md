# Analysis Notes

## Selection

The collector selected six sources spanning ice phase transitions, Tonnetz combinatorial geometry, audio watermarking, electronic-music call and response, quantum-assisted melody/harmony generation, and basso continuo style identification.

## Connection

The strongest connection is **embedded instruction**: a surface musical event can carry a recoverable or generative rule beneath ordinary foreground perception.

- S3 makes this literal through phase and adjacent-bin magnitude watermarking.
- S2 makes it harmonic through graph traversal and combinatorial adjacency.
- S6 makes it stylistic through measurable performer traces inside basso continuo realization.
- S5 contributes the caution that coherent latent structure can lose value if collapsed too early.
- S4 contributes a studio-scale instruction: call and response as a rule that binds events across beats, phrases, and sections.
- S1 constrains the idea physically: instructions must respect reachable paths, not only abstract possibility.

## Output

- Essay: `docs/essays/the-instruction-under-the-sound.md`
- Final synthesis payload: `final-output.json`
- New concepts: embedded instruction, recoverable signature, graph instruction, style trace, reachable rule, surface-matched control

## Verification

- `jq empty context.json final-output.json`
- `bun test scripts/lib/parse-essay.test.ts`
- `bun scripts/generate-essay-metadata.ts`

Publish to Convex failed with recurring server error request ID `58aefe139c77f57e`.
