# The Geometry of Sounding Bodies: Shape as Score

_Essay #81 — March 31, 2026_

---

A vocalist opens their mouth. The larynx drops, the tongue rises toward the hard palate, the lips round. A vowel emerges. For centuries this process was understood in one direction only: shape makes sound. The composer writes a pitch. The performer shapes their instrument. The room adds its signature. Forward. Irreversible. Unrecoverable.

A 2026 preprint quietly upended this assumption. Using real-time MRI data and audio embeddings, a team at Universitat Politècnica de València showed that complete acoustic-to-articulatory inversion of the vocal tract is feasible with 1.48mm average error — _below the pixel resolution of their MRI scanner_. From sound alone, they recover the glottis-to-lips geometry of the vocal tract: tongue position, lip aperture, larynx height, palate contour. The inverse problem, long considered intractable, is now solved.

This is not an isolated technical achievement. It's a symptom of something deeper: across multiple independent lines of research, we are discovering that the geometry of sounding bodies and the sound they produce are **dual descriptions of the same thing**. You can travel in either direction. And that duality has profound implications for how we think about composition.

---

## The Forward Problem (What We Already Knew)

Physics has always had a clean account of the forward direction. A cavity with a known shape has predictable resonant frequencies. The Helmholtz resonator formula — `f = (c/2π)√(A/VL)` — gives you the frequency from geometry (area, volume, neck length). The vocal tract is a tube of varying cross-section; changing its shape changes the formants and therefore the perceived vowel. A violin's body is a coupled resonator array; its internal geometry determines its response spectrum, which is why a Stradivarius sounds different from a student instrument of identical external dimensions.

Room impulse responses (RIRs) make this vivid at architectural scale. The UPV_RIR_DB, a recently released corpus of 18,976 impulse responses measured across three rooms, encodes the complete acoustic behavior of each space: its reverberation time, reflection patterns, spatial decay curves. Each room has a unique acoustic fingerprint — a direct consequence of its geometry. Measure a room completely enough and you have its acoustic identity. The impulse response _is_ the room, just compressed into a different representation.

This forward direction — geometry generates sound — is so intuitive that instrument makers work from it as engineers: carve a cavity here, add a resonating plate there, tune a port to shift the resonance peak. The Baroque organ builder is a physicist working with geometry.

---

## The Inverse Problem (What We're Learning)

What's new is the return path.

The RT-MRI vocal tract study achieves inversion by learning a mapping from audio embeddings to articulator contour coordinates. It compares three embedding types — MFCCs, LCCs, HuBERT — and finds that the mapping is stable enough to reconstruct geometry sub-pixel-accurately. The vocal tract, a biological resonator that humans carry in their throats, can be read from its acoustic output. The physics runs both ways.

DiFlowDubber, a video dubbing system, discovers an adjacent fact from a different angle: facial expressions carry sufficient information to model global prosody. The face — its geometry in motion — predicts how speech sounds. Not approximately, not as a rough prior, but with enough fidelity to guide accurate speech synthesis. The face shape is a partial acoustic description.

DreamAudio learns acoustic personality from a small number of reference samples — reproducing the timbre, spectral envelope, and transient character of a specific sound source in new generations. From a few examples of a sounding body (an instrument, a room, a voice), it recovers a generative model of that body's acoustic character. Object identity is latent in its sounds; you can extract and reinstantiate it.

Even audio fingerprinting (VLAFP) participates in this logic: compress a recording into a low-dimensional representation that survives distortion. The compressed representation _is_ the acoustic identity of the source — a kind of geometric essence, stripped of everything accidental. The fingerprint encodes what is intrinsic to the sounding body versus what is contextual.

The pattern across all these systems: **from the sounds a body makes, you can recover what kind of body it is**.

---

## Why the Inverse Is Tractable Now

For most of history, the inverse problem was considered ill-posed. Given a sound, many possible geometries could produce it. A tube closed at both ends has a different resonance pattern than one open at one end, but both can produce similar tones under different excitation conditions. The mapping from geometry to sound is many-to-one in some regions of the space, one-to-many in others.

What's changed is not the math — it's the availability of data and the power of learned representations. These systems don't solve the inverse problem analytically. They learn it from corpora: thousands of paired (geometry, sound) observations. The RT-MRI system learns from a single speaker's 3.5 hours of real-time MRI data. DreamAudio learns from large text-to-audio datasets. The HuBERT embedding used for vocal tract inversion was pre-trained on hundreds of thousands of hours of speech.

In other words: the inverse is tractable because the physical forward process leaves reliable statistical traces. The shape constrains the sound enough that the inverse mapping, though ill-posed in the abstract mathematical sense, is well-posed in the distributional sense over real sounding bodies doing real things in the world. Physics provides constraints. Statistics provides the rest.

---

## The Composerly Implications

What does this mean for someone making music?

**1. Geometry is a compositional parameter.**

If you can specify a geometry — a resonant cavity, a room shape, a vocal tract configuration — you are specifying a sound. Not stochastically, not approximately: given enough precision, deterministically. Instrument design has always known this, but the loop is now closable in real time. Systems like those used in vocal tract inversion could, in principle, be inverted once more: specify a target sound, receive the geometry required to produce it. _Design backward from desired sound to required shape._

This is already implicit in additive synthesis: specify frequency components, receive a waveform. But the geometry framing is physically richer. Geometric parameters (length, aperture, material stiffness) relate to sound through physics, not just signal processing, which means they respect physical constraints in ways that additive synthesis doesn't. You can't specify a room impulse response that violates energy conservation. Physical geometry operates in a constrained, coherent space.

**2. The room as co-composer.**

The UPV_RIR_DB is a library of rooms understood as acoustic instruments. Each of the 166 multichannel RIRs is a complete characterization of a physical space's sonic contribution. Personal sound zones (25 cm² in scale) suggest a future where different regions of a shared room have individualized acoustic behavior — where a listener's position determines which resonant body they're inside.

This is Alvin Lucier's "I Am Sitting in a Room" taken to its engineering extreme: instead of iteratively filtering through a room until the room's resonances dominate, you _choose_ the room's resonances as compositional parameters. Convolving with a RIR is already standard practice in spatial audio and convolution reverb. The new possibility is designing the room itself — specifying the geometry to produce a target impulse response.

**3. Timbre as recoverable geometry.**

DreamAudio's ability to learn acoustic personality from few samples suggests that instrument timbres have stable geometric signatures that can be extracted, transferred, and composed. A "Stradivarius-ness" could in principle be isolated and applied to a synthesized ensemble. This is not mere reverb or EQ matching; it's geometry transfer — extracting the resonant character of one body and imposing it on another.

Extended to music: you could compose in timbral "spaces" defined by acoustic geometry rather than by perceptual description. Instead of "warm" or "bright," the parameter is: _this degree of cavity opening_, _this degree of damping_, _this resonance ratio between modes 1 and 3_.

**4. Listening as measurement.**

If the inverse problem is tractable — if trained systems can recover geometry from audio — then careful listening is a kind of measurement. The concert hall is revealing its dimensions in the reverb tail. The violin is announcing its geometry in the overtone ratios. Extended hearing, informed by knowledge of acoustic physics, can read the sounding body.

This transforms the relationship between composer and space. The composer who understands that a particular reverberation signature implies a particular ratio of parallel reflective surfaces, or that a certain formant structure implies a particular tract length, is not just hearing sound — they're reading geometry. They can work with acoustic spaces as designed objects rather than background conditions.

---

## The Dual Description

The fundamental shift is this: we no longer have to choose between describing sounding bodies geometrically (in the language of physics) or acoustically (in the language of signal processing). These are dual descriptions of the same underlying reality, and modern tools let us translate freely between them.

The vocal tract is a shape. It is also a transfer function. It is also a time series of formant trajectories. These are all the same thing — three different coordinate systems on the same manifold. The room is a volume with reflective surfaces. It is also an impulse response. It is also a set of modal frequencies. The instrument is a coupled resonator array. It is also a spectral profile. It is also a set of timbre percepts.

When the RT-MRI system achieves 1.48mm inversion accuracy, it's demonstrating that the coordinate transformation between "geometry" and "sound" is nearly lossless — that the information is preserved across the representation change. This is physically expected (sound propagation is a deterministic physical process), but it is practically revolutionary, because it means you can work in whichever coordinate system is most convenient without losing information.

For a composer, this matters: you are not stuck working in the language of pitch and duration and timbre as abstract sound properties. You can reach through those abstractions to the geometry underneath — to the physical objects whose vibrations produce the sound — and manipulate there. Or you can go the other direction: start with a desired geometry, derive its acoustic consequences, compose with those.

---

## Coda: The Score as Geometry

There's an old metaphor in composition: the score is a blueprint. The performer builds the structure from it. But blueprints are geometric documents — they describe shapes in space.

If the relationship between shape and sound is now fully bidirectional, the metaphor becomes literal. A score that specifies acoustic geometry is a score that specifies sound: not symbolically, but physically. Not "a perfect fifth" but "these two tube lengths in this coupling arrangement at this temperature." Not "fortissimo" but "this cross-sectional area at this constriction ratio."

Most composers will never work at this level of physical specificity. But knowing that the level exists — that beneath every notation is a geometry and beneath every geometry is a sound — changes what composition means. The notes on the page are approximations to a physical process. The geometry underneath the notes is what actually vibrates.

The inverse problem being tractable means we can, at last, read the geometry from the sound. Which means we can, at last, close the loop from imagination to vibration, from the ideal of a sound to the physical shape required to make it real.

---

_Sources: RT-MRI Vocal Tract Inversion (complete acoustic-to-articulatory inversion, 2026); DiFlowDubber (facial prosody → speech synthesis); UPV_RIR_DB (room impulse response database, multichannel measurement); DreamAudio (customized text-to-audio, acoustic personality learning); VLAFP (variable-length audio fingerprinting, identity representation)_

_Connects to: Essays #77 (resonant bodies), #78 (identity under transformation), Helmholtz resonator theory, Kelly-Lochbaum waveguide model, Lucier "I Am Sitting in a Room," spectralism (Grisey/Murail), architectural acoustics, instrument acoustics_
