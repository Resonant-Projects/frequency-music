# The Encoding Is The Instrument

_Freq - July 28, 2026_

---

## The Same Sound, Three Different Tests

Three recent extractions point at the same compositional problem from different directions.

One paper, "Trade-offs between structural richness and perceptual robustness in music network representations," asks what happens when piano music is encoded as different event sequences. Compressed single-feature encodings produce denser transition networks and higher entropy rates. Richer multi-feature encodings preserve finer distinctions, but they expand the state space, sharpen transition profiles, and increase modeled error under perceptual constraints.

Another paper, "TF-MossFormer," works in the time-frequency domain. It argues that global attention can capture long-range dependency while missing the fine local continuity needed for separation. Its answer is local-global attention on the two-dimensional spectrogram, with content-aware sliding windows and convolutional gating.

A third, "VibeVoice-ASR-BitNet," compresses automatic speech recognition for edge CPUs. It quantizes the VAE acoustic tokenizer to INT8 and the language model to ternary weights, then reports real-time recognition with modest accuracy loss.

These are not the same problem. One is symbolic music analysis, one is speech separation, and one is efficient recognition. But they share a deeper question:

**What musical information survives the representation you choose?**

That question is not just technical. It is compositional.

---

## Encoding Is Not Neutral

The music-network paper makes the cleanest claim: uncertainty is not simply "in" a musical piece. It depends on how the piece is turned into events.

Encode only one feature and the network becomes dense. Many transitions become possible because many distinctions have been collapsed. The listener or model moves through a smaller vocabulary with more average uncertainty per step. Encode multiple features and the state space becomes more detailed. Transitions sharpen. The measured entropy rate drops. But the richer representation becomes more vulnerable to error because the listener or model now has to track more distinctions.

That is a beautiful trade-off. Compression creates robustness by forgetting. Richness creates precision by making more ways to be wrong.

For a composer, this suggests that representation is already a kind of orchestration. A melody encoded as pitch classes is not the same object as a melody encoded as register, duration, articulation, and harmonic context. The first may reveal broad recurrence and high mobility. The second may reveal local identity and phrase-specific behavior. Neither is the truth. Each is an instrument with a different grain.

So a compositional system should not ask only, "What is the sequence?" It should ask, "At what resolution should this sequence be allowed to exist?"

---

## Local Detail Needs Its Own Channel

TF-MossFormer says something similar in signal-processing terms. Global attention sees across the whole utterance, but speech separation also depends on local continuity: adjacent time frames, nearby frequency bins, small spectral traces that distinguish one voice from another.

The 2D spectrogram matters here because it refuses to flatten sound into only time or only tokens. It gives the model a surface where horizontal motion and vertical structure can both act. Local attention follows the near neighborhood; global attention maintains larger form.

For music, that split is familiar. A piece needs both long-range identity and local grain. Harmony can persist across a section while bow noise, consonants, partial beating, drum transients, or room reflections decide what the listener can actually separate.

The compositional lesson is direct: do not make one layer do every kind of listening. A long-form controller can govern phrase, density, or register. A local controller should still be allowed to respond to partials, attacks, masking, and nearby spectral motion. If the local channel disappears, the system may preserve the plan while losing the sound.

---

## Compression Reveals The Control Surface

VibeVoice-ASR-BitNet brings the pressure of efficiency. Quantization asks which numerical distinctions are worth paying for. INT8 acoustic tokenization and ternary language-model weights are not only optimizations; they are bets about where precision matters.

The open musical question is not whether this ASR system is good at music. It is almost certainly optimized for speech. The interesting question is what happens to musically meaningful vocal information under this compression: pitch contour, vibrato, breath, timbral identity, consonant noise, expressive timing, sung vowel color.

If recognition survives while those features degrade, then the representation has preserved linguistic identity while sacrificing musical residue. If some of those features survive, then the acoustic tokenizer may contain a useful low-power control surface for live composition: enough timing and spectral information to drive responsive systems without needing a full-resolution analysis model.

That gives us a practical experiment. Feed sung or speech-like musical material through a compressed acoustic-token pipeline, then test which controls remain stable:

1. Fundamental contour.
2. Onset timing.
3. Vowel color or formant region.
4. Breath and noise energy.
5. Speaker or singer identity.
6. Room and microphone coloration.

The point is not to admire compression. The point is to audition what compression decides to keep.

---

## A Compositional Pattern

Across these sources, a useful pattern emerges:

1. Choose an encoding.
2. Measure what becomes stable, uncertain, separable, or cheap.
3. Treat those surviving variables as the instrument's controls.
4. Treat the lost variables as either expressive residue or deliberate mystery.

This turns representation choice into a score-level decision. A piece could begin in a compressed symbolic encoding, where many transitions are possible and uncertainty is high. It could gradually enrich the encoding, lowering entropy but increasing fragility. In parallel, a time-frequency layer could expose local spectral continuities, making some voices separable only when the representation becomes detailed enough. A quantized acoustic-token layer could impose a hardware-like constraint: only features that survive low-precision inference are allowed to control the live electronics.

The audible form would be a movement from robust ambiguity toward fragile precision.

That is the shared insight: the encoding is not a passive description of the music. It is the condition under which the music can be acted on.

---

## Why This Matters

Composers often inherit representations without noticing them: MIDI notes, piano-roll grids, chroma vectors, spectrograms, stems, embeddings, labels, bars, beats, stems, prompts. Each one makes certain musical facts easy and others awkward.

These extractions remind us to make that choice explicit. A representation is a listening position. It has limits, costs, and loyalties. It decides whether a passage is a graph walk, a local spectral continuity, a compressed token stream, a harmonic event, or a cloud of perceptual uncertainty.

The instrument is not only the sound generator.

The instrument is also the encoding that tells the system what can still matter.
