# Analysis Notes — 2026-05-10 08:26 UTC

## Extraction status

- `git pull` was already up to date.
- `bunx convex run workflows:startBatchExtraction '{"limit": 3}'` failed immediately with `ConvexError: Server Error`.
- Request ID: `57a8913912016c8b`.
- Publish mode also failed later with request ID `bb6191364efdfd7f`.

## Selected sources

1. `S1` — Tonnetz combinatorial geometry / harmonic graph configurations.
2. `S2` — WST-X wavelet scattering transform for deepfake speech detection.
3. `S3` — Bark24 Dyn psychoacoustic dynamics processor.
4. `S4` — LLM speech-recognition fairness / encoder design and acoustic degradation.
5. `S5` — PHALAR phase/pitch-equivariant musical audio representations.
6. `S6` — David Mayer production process / call-and-response, silence, timbral layering.

## Synthesis connection

The compelling bridge is **the coherence contract**: a representation or arrangement implicitly defines which transformations count as still belonging to the same musical world.

- Tonnetz/configuration theory makes harmonic nearness graph-based rather than label-based.
- Bark-scale processing makes spectral nearness perceptual rather than arbitrary in Hz.
- WST-X and PHALAR emphasize choosing the right representational grain: stable enough for deformation, fine enough to retain anomalies, phase, and pitch relationships.
- Speech-recognition degradation shows the front-end encoder determines what survives compression and silence/masking.
- Mayer's call-and-response practice shows a studio-level invariant: dialogue can persist across timbre, phrase, and section.

## Output artifacts

- Essay: `docs/essays/the-coherence-contract.md`
- Final synthesis JSON: `data/generated/synthesis/2026-05-10T08-26-53-066Z/final-output.json`
- Metadata updated in `docs/essays/metadata.json`

## Graph work

Linked extraction topics for all six selected extractions:

- `j978wc8spg7xjg8v7d09pzw79985df6w` — 20 concepts
- `j971a4crv4z7nqcz7v24yfgvjh85x5zq` — 12 concepts
- `j977tjh3ka74caprsf86d4e3y185maah` — 10 concepts
- `j97795a7x76skzbg4d8pcdhpqh85k5zb` — 10 concepts
- `j978zvv39t3wqdw578e6g057b18683jf` — 13 concepts
- `j9792ckdpne6ycbt2nwccy5pjf73h85dp8c` — typo avoided in command; actual run used `j9792ckdpne6ycbt2nwccy5b7185d3rp` — 14 concepts

Added/updated graph concepts:

- `coherence contract`
- `graph adjacency`
- `perceptual band contract`
- `phase coherence`
- `representation grain`
- `call-response invariant`
- `encoder front-end contract`

Added supporting source→concept and concept→concept edges.

## Verification

- `bun test scripts/lib/parse-essay.test.ts` passed: 14/14.
- JSON validation passed for `docs/essays/metadata.json` and `final-output.json`.

## Next useful move

Recurring Convex server errors continue to block fresh batch extraction and publish/create flows. Manual synthesis and graph-linking remain productive, but the extraction/publish server path needs repair.
