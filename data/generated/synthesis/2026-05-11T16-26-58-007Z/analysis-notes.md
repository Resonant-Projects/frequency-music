# Analysis Notes — 2026-05-11T16:26:58.007Z

## Extraction status

- `git pull` reported repo already up to date.
- `bunx convex run workflows:startBatchExtraction '{"limit": 3}'` still fails immediately with Convex `Server Error`.
- Request ID: `7f5d73d063c98be2`.

## Synthesis pass

Collected six sources with broad novelty settings:

1. Complex ice phases / metastable path-dependence / Ostwald's step rule.
2. Tonnetz and combinatorial geometry of harmonic resources.
3. SSL speech feature dimensions: pitch, F2/formant, intensity, noise, high-frequency characteristics.
4. Speculative infrasound/psychoacoustics source.
5. LoRa voice communication and chirp spread spectrum.
6. UAF full-duplex speech interaction with 600 ms audio chunks.

## Connection found

**The pre-audible turn** — musical arrivals can be prepared by low-salience support dimensions before the foreground event changes. The carrier may be harmonic adjacency, sub/near-threshold pressure, formant or brightness drift, chirp-like spectral motion, or short chunked automation windows.

The idea ties together:

- S1: path-dependent transitions and nearby accessible states.
- S2: harmonic adjacency as a graph-neighborhood carrier.
- S3: separable acoustic dimensions that can move independently.
- S4: near-threshold low-frequency energy as a cautious/speculative carrier category.
- S5: chirp spread spectrum as a sweep-like carrier analogy.
- S6: 600 ms chunks as a practical transition grid.

## Artifacts

- Wrote essay: `docs/essays/the-pre-audible-turn.md`.
- Added metadata entry with content hash `47ce18eafecae8b4c8d1bd6d69e04e831bfba6cbed03c5de990a20e839da7702`.
- Wrote finalized synthesis payload: `final-output.json`.

## Graph work

- Linked extraction topic concepts for all six selected extractions via `graph:linkExtractionConcepts`:
  - 14, 20, 13, 8, 9, and 10 linked topics.
- Added concept nodes:
  - `pre-audible turn`
  - `low-salience preparation`
  - `pre-audible transition`
  - `harmonic adjacency carrier`
  - `sub-audible pressure cue`
  - `chirp carrier gesture`
  - `chunked arrival window`
- Added supporting source→concept and concept→concept edges.

## Publish status

- Publish mode still fails with Convex `Server Error`.
- Request ID: `859ff8ff99f4de3d`.

## Verification

- `bun test scripts/lib/parse-essay.test.ts` passed (14 tests).
- `final-output.json` and `docs/essays/metadata.json` both passed JSON validation.
