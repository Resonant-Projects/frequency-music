# The Sound With More Than One Address

_A sound becomes composable when it can be addressed at more than one operational layer._

Recent extractions keep circling the same practical surprise: a sound is not one object. It is a bundle of addresses.

One new source makes this vivid through Vitalic's "No Fun." The paper argues that the track's main synthesizer line is built from single inharmonic tones that can evoke two simultaneous melodies. That is not ordinary polyphony, where two notes are physically separate events. It is a perceptual split inside one tone. The waveform gives the ear more than one pitch address.

Another source makes the same move in machine time. Instead of asking an audio language model to produce timestamp tokens, internal frame-level reuse trains a small head on the model's own audio representations. The time of an event is already latent in the frames. The system does not need to narrate the timestamp as text; it needs to expose the address where temporal evidence is already usable.

The room-acoustics extraction adds a physical version. Image-source simulation treats echoes as mirrored source positions, but direct enumeration becomes expensive as duration or dimensionality grows. The Gauss-circle/lattice-counting approach reframes the room as a structured field of reflection addresses, weighted by frequency and connected across dimensions by convolution. The echo is not merely an item in a list. It is a point in a countable geometry.

These are different research problems, but composition can hear a shared principle:

the useful musical unit is not always the note, the token, or the reflection. Sometimes it is the address by which a hidden layer becomes playable.

## Multipitch As An Instrument

The Vitalic extraction is especially important because it pushes against a common habit in electronic-music analysis. Synth timbre is often treated as color wrapped around pitch: first identify the notes, then describe the sound design. But an inharmonic tone that suggests two melodies breaks that ordering. The pitch content is not underneath the timbre. It is produced by the timbre.

That gives a composer a clean experiment. Build a single-tone instrument whose partials are not tuned to one harmonic stack but to two implied trajectories. Then write a line where changing one partial group moves the "upper melody" while changing another moves the "lower melody." The performer still triggers one note event at a time, but the listener receives a contrapuntal object.

This is not a trick of notation. It is a way of assigning multiple addresses to one sound: onset address, spectrum address, perceived pitch address, implied melodic address. The more independently those addresses can be moved, the more the sound behaves like an instrument rather than a preset.

## Time Without Timestamp Tokens

The frame-reuse extraction says something similar about temporal localization. Autoregressive timestamp generation asks a language model to say where an event happened. Internal frame reuse asks whether the model already has enough frame-level evidence to mark the time directly.

For music tools, that distinction matters. A beat, onset, phoneme, breath, chord change, or timbral transition may be easier to use at the frame layer than after translation into text or symbolic markers. The address is not "the model says 12.4 seconds." The address is "this region of representation has event intensity."

That opens a different kind of compositional control. Imagine a live sampler that follows a performer by reading frame-level event intensity rather than waiting for named cues. Or a score-following system where the trigger is not a detected note label but a rising probability field for an expected gesture. The system acts sooner because it does not require evidence to become language first.

This connects directly to [Implicit Evidence](implicit-evidence.md): the handle works before the explanation arrives.

## Echoes As Geometry

The room-modeling extraction brings the idea down to physics. A room impulse response can be heard as a stream of echoes, but the image-source model knows those echoes as geometry. Every reflection corresponds to a mirrored source. The computational problem is not just sonic rendering; it is counting and weighting a lattice of possible paths.

The proposed reduction to Gauss-circle-style counting is musically suggestive even before its engineering claims are fully tested. It implies that reverb can be composed as a geometry of reachable reflection addresses. Early-reflection density, spectral damping, dimensionality, and duration become controls over the address space, not just over the final wet signal.

That matters for spatial composition because it lets a room be more than ambience. A room can be a harmonic field of possible returns. Change the lattice weighting and the piece changes which echoes are allowed to matter.

## The Addressable Layer

The recurring lesson is simple and sharp: a system becomes musically useful when it exposes the layer where an action belongs.

If the action is melodic, the address may be an inharmonic partial layout that lets one tone imply two lines.

If the action is temporal, the address may be a frame-level intensity field rather than a timestamp token.

If the action is spatial, the address may be a reflection lattice rather than an impulse-response waveform.

The craft question is therefore not only "what sound do I want?" It is "where is this sound addressable?"

A note can be addressed by pitch. A timbre can be addressed by spectrum. A room can be addressed by geometry. A performance can be addressed by frame evidence. A single sound can carry several of these at once, and that is where the interesting compositional pressure lives.

## Studio Exercise

Choose one short sound: a synth tone, vocal syllable, struck object, or room impulse.

Make three versions of an instrument from it:

- one where the obvious musical address is exposed, such as pitch or onset;
- one where a hidden address is exposed, such as partial grouping, event intensity, or reflection density;
- one where two addresses can be moved independently.

Then write a phrase that proves the difference. The listener should be able to hear when one address changes while another stays fixed.

The result may be a single note that behaves like counterpoint, a rhythm that is triggered by probability rather than labels, or a room whose echoes change like harmony. In each case, the composition begins when the sound stops being one thing and becomes a set of reachable handles.

---

_Sources: inharmonic multipitch analysis of Vitalic's "No Fun" (`j97f45bmgastb8hjpawntc48758b7h9b`), internal frame-level reuse for temporal localization in audio language models (`j977bnvzbhmnyzdhex30t8ckks8b6713`), and Gauss-circle/lattice-counting image-source room impulse response modeling (`j97f8jexyvca60175626jxb7hs8b4528`)._

_Connections: [The Addressable Layer](the-addressable-layer.md), [The Control Surface Under The Sound](the-control-surface-under-the-sound.md), [The Partial That Becomes A Line](the-partial-that-becomes-a-line.md), [Implicit Evidence](implicit-evidence.md)._
