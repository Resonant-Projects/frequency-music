# Analysis Notes — 2026-05-09T08:27:03.174Z

## Extraction status

`workflows:startBatchExtraction {"limit": 3}` failed immediately with Convex request ID `bf55611c08550577`, matching the recent recurring server error pattern. I proceeded with synthesis from existing extracted sources.

## Selected connection

The strongest cross-source pattern was **the carrier under the message**: a support layer is not neutral transport but actively defines what musical information survives and how it is interpreted.

- S1 Tonnetz: harmonic graphs carry adjacency and voice-leading possibility.
- S2 David Mayer: silence, contrast, and timbral layering carry call-and-response meaning.
- S3 LoRa: chirp spread spectrum carries compressed voice within a range/energy/bandwidth budget.
- S4 Spooky sounds: low/sub-audible acoustic energy can act as threshold support rather than foreground pitch; claims remain speculative.
- S5 UAF: 600 ms chunks and cascaded pipelines impose temporal carrier units that shape latency and information loss.
- S6 HHL music generation: coherent state carries joint musical probability before measurement/block collapse.

## Output

- Essay: `docs/essays/the-carrier-under-the-message.md`
- Final synthesis JSON: `final-output.json`
- Metadata updated manually in `docs/essays/metadata.json`

## Graph updates

Linked extraction topics for all six selected extractions. Added concepts: `carrier layer`, `harmonic carrier`, `silence carrier`, `chirp carrier`, `chunk carrier`, `coherent carrier`, and `threshold carrier`, with source→concept support edges and concept→concept grounding/generalization edges.

## Verification

- `bun test scripts/lib/parse-essay.test.ts` passed (14 tests).
- `python3 -m json.tool` passed for metadata and final output.
- Publish mode failed with Convex request ID `5ab10e77a28f5bee`, consistent with existing create/publish server errors.
