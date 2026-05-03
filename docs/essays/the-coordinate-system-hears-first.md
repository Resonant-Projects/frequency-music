# The Coordinate System Hears First

_The listener never receives raw sound. Every system hears through a coordinate system first: a graph, a tokenizer, an embedding space, a microphone geometry, a physical propagation model. What becomes musically possible depends on what that coordinate system makes easy to move through._

## Before Interpretation, There Is a Map

A cluster of recent extractions points to the same hidden premise from very different directions: sound is not only analyzed by features; it is made available by coordinates.

The Tonnetz paper makes this explicit in music theory. Diatonic seventh chords, pentatonic scales, Tristan-genus chords, and chromatic triads become traversable when they are embedded in combinatorial configurations: Fano, Desargues, Cremona-Richmond, and Daublebsky von Sterneck structures. Harmony is no longer just a collection of named objects. It becomes a geometry of adjacency.

Geo2Sound gives the ecological version. A satellite image does not contain sound, but it contains spatial cues that can be mapped into an acoustic embedding space. Forest, coast, city, elevation, water, and density become coordinates that constrain what soundscape is plausible.

The underwater sound-speed paper gives the physical version. Sound does not propagate through an abstract medium; it moves through a changing profile of temperature, pressure, salinity, and depth. The coordinate system is not metaphorical there. It is the ocean itself, stratified into acoustic lanes.

The microphone-array papers give the spatial-engineering version. Steering vectors, Euclidean distance matrices, Gram matrices, and time-difference-of-arrival estimates turn sound location into a geometry that can be optimized. The room is not merely where sound happens. It is a coordinate field that decides what can be localized, separated, or rendered.

And the speech-synthesis papers give the representational version. Qwen3.5-Omni’s ARIA mechanism treats prosody as an alignment problem between text and speech tokenization units. ATRIE separates voice identity into static timbre and dynamic prosody. The ultra-low-latency TTS architecture replaces continuous acoustic regression with residual-vector-quantized discrete codec space.

Across all of them, the important move happens before output: choose the space in which the signal will be represented.

## A Coordinate System Is a Theory of Motion

The practical musical question is not only “what notes are in the system?” It is “what movements are cheap, natural, or even visible inside the system?”

In a piano-roll grid, octave displacement and equal-tempered semitone motion are easy. In a Tonnetz, parsimonious voice-leading and triadic neighborhood become easy. In a waveform editor, transients and envelopes are visible. In a spectrogram, partials and noise bands become visible. In a modulation spectrum, groove and tremolo become visible. In an ambisonic or steering-vector space, direction becomes a continuous musical parameter.

That is the deep connection between Tonnetz geometry and microphone-array geometry. One maps harmonic distance; the other maps spatial distance. Both make some paths legible and hide others. Both turn composition into traversal.

A coordinate system is therefore not a neutral container. It is a theory of motion.

If you represent harmony as Roman numerals, functional progression becomes obvious. If you represent it as pitch-class sets, inversion and transposition become obvious. If you represent it as a graph, adjacency, cycles, dualities, and forbidden jumps become obvious. The same musical material behaves differently because the map offers different affordances.

## Embeddings Are New Instruments

Geo2Sound is especially suggestive compositionally because it treats geography as a latent acoustic instrument. A forest is not just a sample category; it is a point or region in a learned geo-acoustic space. So is a harbor, road, wetland, suburb, or mountain pass.

That means a composer could use location not as field-recording decoration, but as a control surface. Move north in image space; listen for what changes in density, brightness, onset rate, and noise profile. Move from coast to inland; translate that path into orchestration. Trace a river; turn its changing surrounding land use into a timbral modulation score.

This is not “make music from satellite images” as a novelty. It is a richer claim: if an embedding preserves meaningful acoustic relationships, then paths through that embedding can become compositional gestures.

The same is true for voice. ATRIE’s timbre/prosody split suggests an instrument whose “body” and “behavior” are separate axes. One axis says who or what is sounding; the other says how it is moving emotionally and temporally. Qwen3.5-Omni’s alignment problem adds a further warning: expressive speech fails when symbolic and acoustic coordinate systems drift out of sync.

That warning applies directly to music generation. A MIDI token, an audio codec token, a spectral frame, and a phrase-level harmonic function are not equivalent coordinates. When a model or composer jumps between them carelessly, expression can shear apart.

## Physics Is the Coordinate System You Cannot Ignore

The underwater sound-speed extraction is a useful corrective to purely symbolic thinking. In air-conditioned studio work, we often treat sound speed as constant enough to ignore. In the ocean, that assumption collapses. Temperature and pressure gradients bend acoustic possibility.

This matters musically because site-specific sound always has a physics layer. A concert hall, cave, stairwell, courtyard, forest, and underwater installation each has a propagation geometry. The “same” pitch, rhythm, or timbre does not arrive as the same musical object after the medium has transformed it.

The steering-vector and EDM localization papers make this computable. If sparse measurements plus physics-aware kernels can reconstruct continuous spatial acoustic fields, then space itself can become a playable model. A composer could write not just for violin, speaker, and room, but for a field of changing listener positions, scattering paths, uncertainties, and localization thresholds.

The beautiful possibility is an acoustic score whose primary notes are not pitches, but positions and propagation states.

## The Failure Mode: Coordinate Blindness

Every coordinate system has a blind spot.

A satellite image can imply acoustic plausibility but may miss transient human activity. A Tonnetz can make harmonic adjacency elegant while ignoring timbre, rhythm, and cultural association. A low-latency speech codec may preserve interactivity while testing the limits of high-frequency musical nuance. A timbre/prosody split may be useful, but musical identity often lives exactly in the coupling between body and gesture. A microphone array can localize sources only through assumptions about geometry, reverberation, and source count.

So the principle is not “use better coordinates and the problem is solved.” The principle is sharper:

**A representation is powerful precisely where its coordinates match the transformations that matter.**

If the musical question is voice-leading, use a harmonic graph. If it is spatial plausibility, use a room or geo-acoustic embedding. If it is emotional timing, use prosodic coordinates. If it is propagation, use physics. If it is timbral identity, use a space that preserves spectral and temporal behavior rather than only pitch labels.

When the coordinate system and the musical question mismatch, the work becomes strangely hard. You start fighting the map.

## Studio Recipe: Compose by Changing Maps

Try making one short study where the same source material passes through three coordinate systems:

1. **Harmonic map:** choose a small pitch collection and arrange it by graph adjacency rather than by keyboard habit. Use a Tonnetz-like rule: every gesture must move by nearest available relation.
2. **Prosodic map:** freeze the pitches, then vary only envelope, timing, articulation, silence, and phrase contour. Treat this as the “behavior axis,” separate from harmonic identity.
3. **Spatial/physical map:** freeze the notes and prosody, then move the sound through an imagined or measured space: near/far, direct/scattered, dry/reverberant, above/below, left/right, occluded/open.
4. **Geo-acoustic map:** choose a real location or satellite image as a timbral constraint. Forest might mean high-density broadband texture; coast might mean slow noisy envelopes; city might mean transient grids and low-frequency machinery.
5. Compare the versions. Ask: when did the identity survive, and when did changing the coordinate system create a new piece?

The point is not to obey any one representation. The point is to hear what each representation makes available.

## The Principle

The coordinate-system principle is this:

**Sound becomes composable only after it is placed in a space where some transformations are meaningful.**

Tonnetz geometry makes harmonic motion meaningful. Geo-acoustic embeddings make place-to-sound motion meaningful. Sound-speed profiles make propagation meaningful. Steering vectors and distance matrices make space meaningful. Tokenizers and codec codes make streaming synthesis meaningful. Timbre/prosody factorization makes identity and behavior independently steerable.

The coordinate system hears first. The composer hears second.

That is not a loss of freedom. It is where craft begins: choosing the map whose biases reveal the movement you actually want to make.

---

_Sources: Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources; Geo2Sound; underwater sound-speed field reconstruction; Gaussian Process steering-vector regression for augmented listening; Euclidean Distance Matrix source localization; Qwen3.5-Omni; ATRIE; ultra-low-latency streaming speech synthesis._

_Connections: Every Basis Has a Bias; The Medium Is the Map; The Control Layer; The Instrument Is a Theory; The Bandpass Principle._
