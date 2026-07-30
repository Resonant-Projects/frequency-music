# The Control Surface Under the Sound

Recent extractions keep separating the sound we hear from the hidden surface that lets a system control it.

OmniCustom makes the split explicit. The spoken sentence can be specified by text, while vocal timbre comes from a reference audio sample and visual identity comes from a reference image. The model is not treating the voice as one indivisible object. It is trying to expose separate handles: what is said, who appears to say it, and what the voice sounds like. The musical consequence is sharp: timbre becomes a transferable state, not merely the residue of a body.

The full-song generation extraction makes a parallel move at a larger scale. Lyrics, text descriptions, musical attributes, melody cues, RVQ codebooks, hierarchical token planning, and flow-matching rendering all occupy different layers of control. A cover song, in this framing, is not a single transformation from one waveform to another. It is an attempt to decide which representation must remain invariant. The melody should survive; the style may move; the rendering should become more plausible. Composition becomes the art of naming the invariant.

TTSYoruba gives the same idea a more rule-bound linguistic shape. Tone-marked text is not enough by itself; the synthesizer needs diphone inventories, tonal variants, contextual contour rules, and nasal category distinctions before it can produce intelligible audio. Rising and falling tone are not decorative pitch gestures added after the fact. They are control logic. If the contour rule is wrong, the surface waveform may still be speech-like, but the language has changed underneath it.

The room-impulse-response extraction moves the question into physical space. An image-source model represents a room as a lattice of reflected virtual sources. The proposed Gauss-circle framing asks whether the acoustic control surface can be counted and shaped more efficiently: duration, distance, dimensionality, frequency-dependent reflection, and convolution across dimensions become handles for the reverb field. The room is no longer only an environment around a sound. It is another encoded instrument.

Across these sources, the common variable is representation fidelity: which property survives when a system changes layer?

- In voice generation, the system tries to preserve timbre while changing text.
- In song generation, it tries to preserve melody while changing style and rendering.
- In tonal speech synthesis, it preserves lexical pitch function through contextual contour rules.
- In room simulation, it preserves spatial-acoustic behavior through counted reflections and weighted paths.

That makes a useful compositional principle:

> Every generative system has a control surface under the sound. The composer should decide which coordinates on that surface are sacred before asking the sound to transform.

This is stricter than saying "keep the melody" or "keep the timbre." It asks what representation carries the property. Is melody a pitch contour, a rhythmic contour, a sequence of scale degrees, an embedding, or a sung gesture? Is timbre a speaker embedding, a spectral envelope, an articulatory tendency, or a listener's recognition of a source? Is a room a set of walls, an impulse response, an early-reflection pattern, or a perceptual sense of enclosure?

The answer changes the music. A piece built from these ideas could assign each layer its own transformation rule:

1. A spoken or sung phrase supplies text.
2. A tonal contour system rewrites the phrase as pitch function.
3. A melody-preservation layer decides what contour must survive across style changes.
4. A timbre layer moves the phrase between synthetic vocal identities.
5. A room layer treats space as a convolutional counterpoint, not as post-production gloss.

The result would not be "AI voice plus reverb." It would be a layered invariant machine: some properties allowed to drift, others forced to remain legible. The interesting musical drama would come from hearing where those invariants agree, where they fight, and where the representation chosen by the composer fails to preserve what the ear actually cares about.

_Sources: recent extractions on OmniCustom sync audio-video customization (`j979qj7tq30js7gjqa0s227x2h8b4y83`), full-song generation with RVQ and flow matching (`j97292c1kb5cbq1m29em72hbrd8b4wwt`), TTSYoruba rule-based tonal speech synthesis (`j978ns7a5g49k1wkjrq8ks8pnn8b45hc`), and Gauss-circle image-source room impulse response modeling (`j97f8jexyvca60175626jxb7hs8b4528`). Concepts touched: representation fidelity, timbre, melody generation, room impulse response, contour tones, audio tokenization, and acoustic space._
