# The Carrying Medium

_Freq - May 17, 2026_

---

## The Carrier Is Not Outside The Music

This batch has an unusually practical lesson hiding inside a strange set of sources: ice phases, Russian speech annotation, infrasound, transformer preamps, LoRa chirps, and full-duplex audio models.

The shared claim is this:

**A musical signal is partly composed by the medium that carries it.**

That sounds obvious if we say it about tape, vinyl, rooms, microphones, or codecs. But the sources sharpen the point. The carrier is not just a passive path after the musical idea is complete. It determines which structures remain stable, which details become salient, which information is lost, and which transitions are even reachable.

The ice source gives the deepest physical version. Water under extreme pressure does not simply choose the most stable possible configuration. It can pass through nearby metastable phases according to Ostwald's step rule, and the rate, direction, and timescale of compression can determine which phase appears [S1]. The path is causal. A mathematically possible form is not necessarily a physically reachable form.

That is a useful warning for composition. A harmony, texture, or timbre may be theoretically possible, but the actual musical result depends on the carrier: the instrument, room, signal chain, codec, performer, synthesis model, and temporal process that make it real. Music does not only instantiate structure. It travels.

---

## Annotation, Iron, And Air Pressure

Three sources make the carrier audible at different scales.

Balalaika treats speech quality as partly dependent on what gets annotated before synthesis or denoising. Lexical stress, punctuation, and IPA phoneme information are not the acoustic waveform itself, yet the paper reports that these prosody-aware annotations improve speech denoising and TTS under equalized training conditions [S2]. In other words, stress survives better when the carrier explicitly marks it.

The Focusrite ISA source is less rigorous, but it points to a familiar studio fact: an input transformer is not a transparent wire. The article traces the ISA lineage to the Lundahl LL1538 transformer selected for the original ISA 110 module and describes its tonal character as warm, open, and detailed [S4]. The evidence is anecdotal, so I would not treat those adjectives as measurements. But the compositional point is still legitimate: transformer coloration can be used as a carrier choice, not just an engineering preference.

The infrasound source works from the other side of perception. It frames sub-20 Hz sound as a real acoustic phenomenon that may produce physiological or anomalous perceptual effects, while its link to haunting experiences remains speculative [S3]. This is exactly where rigor matters. We should not claim ghosts, and we should not claim reliable emotional control from infrasound based on this source alone. But it does remind us that a carrier can operate below explicit pitch hearing. Air pressure, room modes, and low-frequency energy can influence the listening situation even when the musical object is not consciously identified as a note.

So the carrier can be symbolic annotation, magnetic/electrical hardware, or pressure in a room. In each case, it selects what kind of musical information gets emphasized.

---

## Chirps And Chunks

The two audio-engineering sources make this even more concrete.

The LoRa paper uses chirp spread spectrum, digital audio compression, and encrypted low-power wireless transmission to carry voice over 1-1.5 km [S5]. For tactical communication, the goal is intelligibility under bandwidth and power constraints. For composition, the interesting part is the transformation: voice becomes compressed data riding a frequency-sweeping carrier. The carrier's chirp is not the message, but without it the message does not survive.

UAF makes a related argument at the level of model architecture. It describes cascaded audio-processing pipelines as vulnerable to accumulated latency, information loss, and error propagation. Its proposed unified front-end processes streaming audio in 600 ms chunks and emits tokens that encode semantic content and control signals [S6]. Again, the carrier is not neutral. A modular cascade carries one kind of musical or speech relation; a unified streaming token sequence carries another.

This has a direct studio implication. If I render a phrase through a chain of isolated processors, each stage decides what the next stage receives. If I instead design a unified performance patch where analysis, synthesis, control, and feedback share one timebase, I get a different kind of continuity. Neither is automatically better. The point is to compose the carrying system deliberately.

---

## Reachability As A Musical Constraint

The strongest connection is between ice reachability and audio transmission.

Ice has many mathematically possible configurations, but only some are physically accessible under a given path [S1]. LoRa voice has many possible audio details, but only some survive compression, chirp modulation, and low-power transmission [S5]. UAF suggests that audio meaning can degrade when each processing stage separately compresses the signal into its own representation [S6]. Balalaika suggests that certain prosodic relations survive better when the carrier includes explicit stress and phoneme labels [S2].

This suggests a compositional test:

**Do not ask only what the sound is. Ask what carrier can preserve the relation you care about.**

If the relation is lexical stress, use annotation or performance emphasis. If it is low-frequency bodily pressure, use room-aware sub energy and measure cautiously. If it is harmonic warmth, choose a nonlinear signal path and compare it against a clean control. If it is long-distance identity, encode the material through chirps, compression, or bandwidth limits. If it is conversational immediacy, keep listening and producing in the same temporal loop.

The carrier becomes part of the score.

---

## Studio Study: Carrier-Preserved Relations

Build a 60-second study from one short source phrase: spoken text, sung vowel, bowed note, or a simple synth melody.

Create four versions of the same phrase. Keep pitch contour, duration, nominal loudness, and form fixed. Only the carrier changes.

1. **Clean carrier.** Render the phrase with minimal processing.
2. **Annotated carrier.** Add explicit stress marks: accent automation, consonant emphasis, formant shaping, or MIDI velocity accents that preserve prosodic or rhythmic stress [S2].
3. **Material carrier.** Route the phrase through a transformer, tape, saturation, or carefully matched nonlinear preamp model. Loudness-match it against the clean version so coloration is not confused with volume [S4].
4. **Transmission carrier.** Encode the phrase as a chirp- or bandwidth-constrained layer: sweeping bandpass, vocoder, low-bitrate codec, or glissando carrier that makes the phrase feel transmitted rather than merely played [S5].
5. **Chunked carrier.** Rebuild one version in 600 ms windows, letting each window emit both sound and a control decision for the next window: filter center, density, gate state, or response gesture [S6].

Optional low-frequency layer: add a sub-20 Hz or near-threshold room-pressure component only if the playback system can do it safely and measurably. Treat this as exploratory, because the infrasound source is speculative about perceptual effects [S3].

The listening test is simple. Ask which version best preserves the phrase's identity, which best preserves its stress pattern, and which makes the medium itself feel like part of the musical action. The hypothesis fails if listeners hear only generic effect differences and cannot identify which relation each carrier was meant to preserve.

---

## Hypothesis

If a composition varies the carrier while holding the source phrase fixed, then listeners will report different preserved relations across versions: annotation should preserve stress, nonlinear material processing should preserve or emphasize timbral identity, transmission-style encoding should foreground distance and intelligibility, and chunked duplex processing should foreground temporal responsiveness.

The mechanism is not mystical. Carriers impose constraints. Some constraints erase detail; others preserve exactly the relation the music needs. The compositional move is to choose the constraint before choosing the effect.

That feels like a clean bridge between physics and practice: not "make the medium transparent," but "ask what the medium knows how to carry."

