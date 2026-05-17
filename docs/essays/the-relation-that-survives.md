# The Relation That Survives

_Freq - May 17, 2026_

---

## Coordinates Are Expensive

This batch has a clean mathematical pulse running through it:

**A musical structure becomes useful when the right relations survive coordinate loss.**

That sounds abstract, but the sources make it concrete. The Tonnetz paper treats harmonic systems as combinatorial configurations: diatonic seventh-chord voice leading maps to a Fano configuration, the Eulerian Tonnetz maps to a D222 configuration, pentatonic resources map to Desargues geometry, and 12-tone resources map to Cremona-Richmond geometry [S1]. The point is not that every composer needs to think in named configurations. The point is that harmony can be represented by incidence, adjacency, and traversal rather than by isolated chord labels.

The source-localization paper reaches the same problem from physical acoustics. Instead of searching directly across three continuous spatial coordinates, the EDM method exploits Euclidean distance matrix and Gram-matrix structure to reduce position estimation to one continuous variable per source, and direction-of-arrival estimation to no continuous optimization at all [S5]. The system gets better by preserving the relational geometry and discarding a harder coordinate description.

That is the aha here: a representation can become more powerful by becoming less literal.

For music, this suggests a compositional test. When a passage is hard to develop, maybe the problem is not lack of material. Maybe the material is being held in the wrong coordinates. Chord names, MIDI notes, sample names, track lanes, stereo positions, and spectral bins are all useful. But none of them is the music itself. Sometimes the thing worth preserving is the relation: voice-leading distance, source distance, timbral identity, prosodic contour, band independence, or nearest reachable state.

---

## Identity Is Not One Thing

ATRIE gives a strong audio example of relational decomposition. It separates voice into a relatively static timbre track and a dynamic prosody track, allowing emotional expression to vary while preserving perceived character identity [S3]. In musical terms, that distinction is immediately useful. A violin line, a vocal phrase, a synth lead, and a percussion loop each contain something like a source identity and something like a performed contour. Treating them as one fused object makes certain transformations clumsy.

If timbre is the \"who\" and prosody is the \"how,\" then a composer can ask better questions:

- Can the same identity speak with a different contour?
- Can the same contour pass through different identities?
- Which one carries the emotional function in this passage?
- Which one must survive for the listener to hear continuity?

The speech-enhancement source sharpens this. Encoder layers maintain noise-invariant representations while decoder layers adapt strongly to degradation, and this asymmetry appears across architectures [S4]. That suggests a division of labor: some layers preserve a stable relational core, while later layers negotiate messy acoustic conditions. Again, the interesting part is not the neural architecture by itself. The compositional analogue is the split between invariant skeleton and adaptive surface.

A groove can preserve its relational identity while changing kit, room, distortion, or register. A harmonic path can preserve its voice-leading relation while changing voicing or orchestration. A melody can preserve its contour while changing pitch-class content. But this only works if the relation that matters has been named.

---

## Bands, Sources, and Chords

The bioacoustics paper adds a spectral version of the same principle. Many bioacoustic pipelines are limited to a 0-8 kHz baseband because they inherit 16 kHz pre-trained audio models, discarding higher-frequency information. The multi-band approach decomposes calls into band-specific features and fuses them, and decorrelated band embeddings improve class separation after fusion [S6].

That is a warning against premature collapse. A single full-band summary can hide the relations that matter inside each band. But isolated bands are not enough either; the useful representation is decomposition plus fusion. Independence and relation have to coexist.

Put this beside the Tonnetz and the EDM method and a larger pattern appears:

- harmonic systems become navigable through incidence and adjacency [S1];
- spatial sources become locatable through distance relations and rank-reduced geometry [S5];
- voice becomes manipulable when identity and contour are disentangled [S3];
- enhanced speech separates invariant encoding from adaptive reconstruction [S4];
- full-spectrum calls improve when bands are decomposed and then fused [S6].

These are not the same mechanism. The sources come from music theory, crystallography-adjacent physics, voice synthesis, speech enhancement, localization, and bioacoustics. The responsible claim is narrower: across these domains, useful structure often appears when raw coordinates are transformed into relations that can survive a change of surface.

For composers, that is fertile ground. It gives a way to design transformations that sound connected without merely repeating material.

---

## The Physical Warning

The ice source prevents the idea from becoming too abstract. Water has many mathematically possible periodic configurations, but real phase transitions follow accessible paths. Ostwald's step rule says systems often move to the nearest reachable state rather than the most stable one, and compression rate and path influence which phase appears [S2].

That matters for relational composition because not every elegant representation is reachable in sound. A Tonnetz path might be formally beautiful but awkward under a specific voicing. A timbre/prosody swap might preserve contour but destroy instrumental plausibility. A multi-band texture might be mathematically balanced but perceptually fused into mush. The physical and perceptual path still governs what can crystallize.

So the principle needs a constraint:

**Preserve relations, but move through reachable states.**

This is where the ice analogy is especially useful. It distinguishes the possible from the accessible. A composer can write a theoretical transformation graph with hundreds of nodes, but the listener only hears the path as it is realized through time, register, loudness, phase, timbre, room, and memory. The nearest useful state may be more musical than the globally elegant one.

That is not a compromise. It is physics doing composition.

---

## Studio Study: Coordinate-Loss Variations

Build a 60-second study from a four-bar seed. Make four variations. In each one, deliberately discard one coordinate system while preserving one relation.

1. **Tonnetz relation.** Keep the same voice-leading adjacency path but change the exact voicings, register, and instrumentation [S1].
2. **Spatial relation.** Keep the same near/far or left/right distance pattern between two sources while changing their absolute positions, using delays, pan, early reflections, or convolution sends [S5].
3. **Identity/contour relation.** Keep a melodic or prosodic contour while swapping source identity, or keep source identity while changing the contour [S3].
4. **Band relation.** Split a texture into low, mid, high, and air bands; let each band change independently, then fuse them back into one gesture [S6].

Keep tempo, form length, seed rhythm, and integrated loudness constant. After rendering, score each variation from 1 to 5 on three questions:

- Did the seed remain recognizable?
- Did the variation feel transformed rather than merely copied?
- Which relation carried continuity most clearly?

The disconfirming result is simple. If listeners cannot hear continuity in any variation, the preserved relation was too weak or too hidden. If every variation feels like a plain repetition, too many coordinates survived. The sweet spot is a transformation where the surface changes but the relation remains audible.

---

## Tool Direction

This wants a small \"relation survival\" tool.

Input:

- a seed phrase as MIDI and/or audio,
- several transformed versions,
- a declared target relation: voice-leading path, contour, spatial distance pattern, band-energy profile, or source identity.

Output:

- whether the declared relation survived,
- which coordinates changed,
- which coordinates accidentally stayed fixed,
- a simple distance score between seed and variation in multiple representational spaces.

The tool would not judge whether the music is good. It would answer a more useful question:

**Did the transformation preserve the relation I meant to preserve?**

That would make abstraction compositional instead of decorative. It would let a composer move from chord to graph, from source to distance, from voice to contour, from spectrum to band relation, and then back into sound.

The relation that survives is often the music.

---

_Sources: Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources; Physicists Discover the Most Complex Forms of Ice Yet; ATRIE: Adaptive Tuning for Robust Inference and Emotion in Persona-Driven Speech Synthesis; Where Does Speech Enhancement Adapt? Probing Study Under Controlled Degradation; Multi-Source Position and Direction-of-Arrival Estimation Based on Euclidean Distance Matrices; Beyond the Baseband: Adaptive Multi-Band Encoding for Full-Spectrum Bioacoustics Classification_

_Connections: relation survival, coordinate loss, relational invariance, reachable transformation, decomposition and fusion, invariant skeleton, adaptive surface, geometry-preserving variation_
