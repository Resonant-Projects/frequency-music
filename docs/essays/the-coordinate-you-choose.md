# The Coordinate You Choose

_Freq - August 9, 2026_

---

## Listening Becomes A Coordinate System

The newest extraction cache keeps making the same quiet move: before a machine can improve, classify, transfer, or judge a sound, it has to decide which coordinates the sound lives in.

That choice is never neutral. A speech enhancer that learns a trajectory between noisy and clean speech hears restoration as a path. A mixing-style model that predicts tokenized FX chains hears style as an ordered recipe. A browser guitar classifier that leans on MFCCs hears string identity as a small spectral fingerprint. A music-structure benchmark that trims boundary annotations hears form as a stricter temporal target. A phone recognizer hears voice as articulatory features distributed across languages. A pitch-strength study hears tone as a salience parameter, not merely a frequency.

The interesting connection is not that all these systems use measurements. It is that each measurement creates a different musical object.

## Restoration As A Path

The Schrödinger Bridge Mamba extraction frames speech enhancement as joint denoising and dereverberation with one inference step. The technical claim is about efficiency and quality, but the musical idea is larger: restoration can be modeled as a trajectory, not only as a mapping from damaged input to clean output.

That matters because noise and room are not just defects. They are coordinates of a performance. A dereverberation system decides how much room can be removed before the voice stops belonging to its space. A denoising system decides which breath, consonant edge, or transient belongs to speech and which belongs to interference. When the coordinate is a bridge from corrupted to clean, the compositionally useful question becomes: where along that bridge should the sound live?

One-step inference sharpens the constraint. In real time, the system cannot endlessly deliberate over possible clean worlds. It commits to a point on the path. That commitment is a musical act when applied to vocals, field recordings, or sampled instruments: not "remove the room," but "choose a location between witness and reconstruction."

## Style As An Ordered Chain

StemFX chooses a very different coordinate system. It treats mixing style as variable-length, tokenized FX chains predicted per source-separated stem. Level, spatialization, effect choice, effect order, and parameterization become a sequence the model can retrieve or transfer.

This is a beautiful correction to vague style language. "Make this mix sound like that one" usually hides the actual studio mechanism. StemFX proposes that at least part of style is procedural: what happens to each stem, in what order, with which effects, under which spectral conditions.

The coordinate is powerful because it is editable. A learned embedding of style might retrieve similar mixes, but a tokenized chain can become a score for production. The composer can ask: is the identity of this mix carried by compression before saturation, by reverb after delay, by a band-limited distortion on the vocal stem, by stereo treatment on drums, or by the order relation among them?

Here, style is not a color sprayed over the song. It is a sequence of decisions attached to musical bodies.

## String Identity As A Residual Trace

Fretiq gives the most instrument-specific version. On electric guitar, the same pitch can be played on different strings and fret positions. To many untrained listeners, those timbral differences are subtle or largely imperceptible. The classifier still extracts a 26-dimensional feature representation with band energies, spectral statistics, and MFCCs, then reports a large gap between shuffled validation and held-out free-play performance.

This is the measurement lesson in miniature. The nominal pitch is not enough. The string leaves a residual trace in the spectrum, and MFCCs become the coordinate that makes that trace actionable. But the held-out free-play result also warns that a coordinate can overfit the ritual by which data was collected. Alternating comparison training can reduce one confusion pair while producing mixed effects elsewhere.

For composition, this suggests a subtle control surface: keep pitch class constant while moving the source coordinate. Play the same note on different strings, pickups, positions, or articulations, then arrange the piece so the listener may not name the change but still feels the physical identity move underneath the pitch.

## Tests Also Choose Coordinates

The fair-test sources extend the claim from tools to evaluations. Music-structure analysis scores depend on whether boundary annotations are trimmed. Spatial-audio probes show source factors are easier to decode than room factors. Echoes aligns generated and bona-fide music semantically so detectors cannot solve the wrong distinction. PhoneticXEUS evaluates phones across more than 100 languages using phone feature error rate. Pitch strength asks for a low-level perceptual coordinate that studio musicians can actually use.

Each case asks the same methodological question:

Which coordinate is allowed to count as evidence?

If the coordinate is too loose, the model appears smarter than it is. If it is too abstract, the musician cannot use it. If it is too tied to collection conditions, it fails when performance becomes free. If it ignores uncertainty, it turns a spread of human perception into a false point.

The right coordinate is not always the finest one. It is the coordinate that matches the musical action.

## A Studio Exercise

Take one short phrase: a sung line doubled by electric guitar and a simple drum stem.

Make five versions, changing only the coordinate system you privilege:

1. Restoration coordinate: move the voice gradually from reverberant/noisy to clean/dry.
2. FX-chain coordinate: keep the same stems but reorder effects until style changes while harmony does not.
3. Source-coordinate: keep a guitar pitch fixed while changing string, pickup, or fret position.
4. Boundary coordinate: move the perceived section change by tightening or blurring the drum transition.
5. Pitch-strength coordinate: keep the bass note fixed while shifting pitch authority from fundamental to upper partials.

The goal is not variation for its own sake. The goal is to hear how the musical object changes when its coordinates change.

## The Research Handle

A good audio tool should expose the coordinate it acts in.

That is the practical connection across these sources. Enhancement should say whether it is moving through noise, room, or speech intelligibility. Mixing transfer should expose ordered stem-level decisions. Instrument classifiers should distinguish pitch identity from physical-source identity. Benchmarks should state which evidence carriers are legitimate. Generative music controls should offer low-level perceptual handles, not only high-level adjectives.

The coordinate you choose becomes the instrument you are building.

That is the real compositional lesson. A note, voice, mix, room, string, section, or style is not only an object in sound. It is an object made available through a measurement frame. Change the frame, and the same waveform can become a different musical fact.

---

_Sources: Schrödinger Bridge Mamba speech-enhancement extraction (`j97d337kfk4agn4a6h0vqktdcn8b3b4e`), StemFX mixing-style extraction (`j972b99xapwke0nsrs9mydqez58b2v83`), Fretiq guitar-string classification extraction (`j976hka8k1xqgt9rbagkz562e18b12er`), Echoes music deepfake extraction (`j97bt3nyk8vhkpchhncydmk7v18av5ta`), music-structure trimming extraction (`j97449t2gg1cqfff5nrqf1fa5d8atd0x`), SARL spatial-audio probing extraction (`j9718kahkvm0zmm4watm7bt0kd8avqh4`), PhoneticXEUS phone-recognition extraction (`j977bjx4mn520e8ebrmvjvnrw58agpf6`), and pitch-strength extraction (`j978yxjgnckm2px83ae5dqwgq18ajxwm`). Connects to: [The Evidence Carrier](/docs/essays/the-evidence-carrier.md), [The Fair Test](/docs/essays/the-fair-test.md), [The Plastic Tone](/docs/essays/the-plastic-tone.md), and [The Resolution Grid](/docs/essays/the-resolution-grid.md)._
