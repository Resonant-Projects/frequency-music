# Analysis Notes — 2026-05-08T00:26:57.610Z

Extraction remains blocked by the Convex server error in `workflows:startBatchExtraction`, so this run synthesized from the existing extracted corpus.

The selected set was unusually coherent around a representation-scale problem:

- S1 treats speech rhythm as low-frequency amplitude modulation, separating macro-temporal pulse structure from finer spectral features.
- S2 treats harmonic continuity as graph/geometric adjacency rather than acoustic similarity.
- S3 shows that too much temporal averaging can erase subtle spectral artifacts; robust representations still need the right fine-scale sensitivity.
- S4 shows encoder/compression design dominates downstream recognition behavior and can trigger hallucination under degradation.
- S5 points to Bark-scale critical bands as perceptually meaningful spectral neighborhoods.
- S6 argues that pitch- and phase-equivariant representations preserve musical coherence better than phase-discarding baselines.

Compelling connection: **the resolution contract** — every musical representation chooses what scale it preserves, averages, treats as equivalent, or destroys. Compositionally, the practical question is not “highest fidelity everywhere,” but “which scale carries this piece’s identity?”

New essay: `docs/essays/the-scale-that-holds.md`.

Final synthesis payload: `final-output.json`, with a DAW litmus test that selectively damages low-frequency modulation, critical-band separation, phase alignment, and harmonic graph adjacency to locate the identity-bearing layer of a loop.
