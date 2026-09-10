---
title: "The Bandwidth of a Musical Instruction"
publishDate: 2026-09-10
excerpt: "A musical rule matters only if its carrier makes it recoverable in time. Instruction bandwidth connects latent scores, decoding windows, and relation multiplexing."
category: "interdisciplinary"
tags:
  - "composition"
  - "information-theory"
  - "perception"
  - "signal-processing"
  - "rhythm"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## A Rule Must Arrive in Time

A musical surface can carry more than notes and sound. It can carry an instruction: an adjacency rule that governs harmonic motion, a recurring voicing habit, a prosodic stress pattern, a spectral signature, or a low-frequency modulation profile that tells the listener how events belong together.

But an instruction that exists in the score is not necessarily an instruction the listener can recover.

Three cached synthesis packs approach this problem from different directions. One treats harmonic graphs, phase watermarks, and performer habits as **embedded instructions** beneath the foreground. Another asks which musical relations survive when the same phrase moves through prosodic, material, transmission, and chunked carriers. A third proposes a **latent score** distributed across rhythm formants, voicing fingerprints, harmonic adjacency, and subtle spectral gestures.

Taken together, they suggest a useful compositional quantity:

> **Instruction bandwidth is the amount of latent musical rule that a carrier can make recoverable within a relevant decision window, without forcing that rule to become the foreground.**

This is an operational analogy, not a claim that musical instruction already has a universal Shannon measure. To calculate bits per second, we would need a declared code, probability model, decoder, and error criterion. The compositional concept is more situated. It asks whether a listener or performer receives enough structured evidence, soon enough, to predict, recognize, or act on the rule.

A rule may be present yet have effectively zero instruction bandwidth because it arrives too weakly, too late, or through a dimension the listening situation cannot resolve.

## The Difference Between Storage and Transmission

Audio watermarking supplies the clearest engineering example. Asymmetric Phase Coding embeds a cryptographic signature in selected STFT phase bins and adjacent-bin log-magnitude differences. Redundancy and error correction allow the signature to survive compression, resampling, filtering, and cropping while remaining relatively unobtrusive.

The musical lesson is not merely that hidden information can be stored in sound. Storage is the easy half. The harder question is whether the information survives the complete path to a decoder.

A compositional instruction has a similar path:

1. the composer distributes a rule across musical features;
2. instruments, synthesis, mixing, codecs, rooms, and playback transform those features;
3. the listener accumulates evidence over time;
4. some cue becomes strong enough to support expectation or recognition.

If the rule is encoded only in high spectral detail, a bandwidth-limited carrier may erase it. If it lives only in phase relations, mono playback or reverberation may weaken it. If it lives only in a long harmonic path, a short excerpt may never expose enough transitions. If it lives in a voicing habit but every chord is densely masked, the habit remains stored in the MIDI while failing to transmit musically.

This separates **latent structure** from **effective instruction**. Latent structure is present in the object. Effective instruction reaches a listener in time to guide the next act of listening.

## Every Carrier Has a Different Instruction Budget

The carrier-preservation synthesis makes this concrete. Prosody-aware speech systems preserve stress, punctuation, and phoneme relations by making them explicit. Low-power chirp transmission preserves a narrower message under severe bandwidth and energy constraints. Full-duplex audio models divide interaction into fixed streaming chunks, making latency and accumulated information loss part of the communication problem. Material carriers such as saturation, transformers, tape, and rooms preserve or distort yet another set of relations.

The same musical phrase therefore has no single instruction bandwidth. It has a bandwidth relative to a carrier and a task.

A vocal line may transmit phrase hierarchy efficiently through stress and consonant attacks while transmitting fine pitch poorly. A distorted bass may transmit pulse and harmonic arrival while erasing inner-voice motion. A narrowband radio effect may preserve syllabic rhythm and contour but remove the spectral signature that identified the source. A 600 ms chunking process may make local call-and-response highly legible while concealing a slower formal rule.

This gives composition a sharper question than “What survives the effect?”

Ask instead:

- Which instruction survives?
- How quickly can it be decoded?
- Which carrier dimension bears it?
- What other instructions compete for the same dimension?

The answer can change inside one piece. A spectral instruction may dominate in a sparse introduction, then lose bandwidth when the mix becomes dense. A rhythmic instruction may be unreadable at first, then become obvious after three repetitions. A harmonic graph may be inferred only after enough transitions establish what counts as adjacent.

## The Decoding Window

Instruction bandwidth depends on a second concept: the **decoding window**.

The decoding window is the shortest span in which enough evidence accumulates for the governing relation to become recoverable. It need not be a fixed analysis window. It may be one transient, a 600 ms interaction chunk, a two-bar call and response, an eight-chord path, or an entire section.

Rhythm-formant research is useful here because it treats low-frequency amplitude modulation as structured information complementary to spectral detail. A pulse profile around 1–10 Hz cannot be inferred from an isolated sample. It requires a temporal window long enough to reveal periodic or clustered modulation. Basso continuo style recognition likewise depends less on one dramatic voicing than on recurrent realization choices. Tonnetz adjacency becomes an instruction only after multiple moves reveal a traversal habit rather than a coincidental chord pair.

The window creates a tradeoff.

A very short decoding window favors explicit accents, attacks, repeated timbral marks, and local interval relations. These are quickly actionable but risk becoming foreground clichés. A long decoding window can carry subtler rules—formal symmetry, path bias, statistical voicing identity—but the rule may arrive too late to organize moment-to-moment listening.

The strongest pieces often nest windows. A local accent tells the body where the pulse is; a phrase-level response tells the listener what counts as an answer; a section-level harmonic path reveals the larger law. Each window carries a different portion of the instruction.

## Relation Multiplexing

This leads to a third concept: **relation multiplexing**.

Relation multiplexing assigns complementary parts of one musical instruction to different carriers or timescales. Rhythm may announce when a state changes. Voicing may reveal who made the change. Harmonic adjacency may constrain where the piece can go. Spectral marks may preserve continuity through timbral transformation. Silence may declare that a call is still awaiting an answer.

This differs from simple doubling. If every layer repeats the same motif, the piece gains redundancy but not necessarily more instruction bandwidth. Multiplexing works when layers carry distinct pieces of the rule and can be integrated by the listener.

It also has a limit. Earlier work on **relational rank** and the **rank budget** asks how many independent musical obligations can remain legible at once. Instruction bandwidth is the transmission side of the same problem. A piece may encode six elegant relations, yet the carrier and decoding window may expose only two. The remaining four are not “deep” merely because they are hidden; they may simply be inaccessible.

A useful arrangement therefore matches relation multiplexing to the rank budget:

- distribute identity across several layers so local damage does not erase it;
- keep each layer’s responsibility distinct enough to decode;
- stagger instructions across time when they would compete simultaneously;
- preserve at least one fixed frame against which adaptive layers become readable.

## Studio Study: The Narrow Channel Test

Create a 60-second piece at 96 BPM from one eight-bar loop. Freeze the melody, chord roots, bass rhythm, instrumentation family, form, and integrated loudness. Define one latent instruction with three parts:

1. **Path rule:** chords move only through a declared nearest-adjacent graph.
2. **Response rule:** every call is answered by a change of register, timbre, or silence after a consistent delay.
3. **Identity rule:** one voicing fingerprint and one subtle spectral gesture recur throughout the piece.

Render four versions.

**Version A — Full channel.** Preserve every carrier: attacks, low-frequency modulation, voicing, stereo/phase detail, and full-band spectrum.

**Version B — Narrow spectrum.** Apply a controlled bandwidth reduction or codec treatment. Preserve loudness and timing, but reduce the spectral channel.

**Version C — Short window.** Present only brief excerpts or reorganize the piece into 600 ms to one-bar chunks. Preserve local sound while disrupting evidence that requires a longer decoding window.

**Version D — Reassigned instruction.** Move the lost spectral or long-window instruction into another carrier. For example, translate the voicing fingerprint into accent timing or let the response rule carry the identity mark.

Blind-rate each version for four questions:

- Can the path rule be predicted before the final cadence?
- Can the response rule be described?
- Does the piece retain the same identity after carrier reduction?
- How long does it take before the rule becomes apparent?

The hypothesis is supported if Version B or C loses a specific governing relation, while Version D restores that relation by moving it into a carrier with sufficient bandwidth. It is weakened if ratings track only generic fidelity or preference, or if listeners cannot identify the instruction even in Version A.

## Composition as Timely Decoding

The practical value of instruction bandwidth is that it turns “hidden structure” into a testable responsibility.

A score can contain arbitrarily elaborate rules. Music cannot make all of them effective at once. The carrier has limits. The room has limits. Attention has limits. Every rule needs a dimension in which to travel and a window in which to become legible.

This does not argue for making everything obvious. The watermark example shows that a code can remain below foreground perception and still be recoverable. Style traces show that identity can accumulate statistically rather than announce itself as a theme. Rhythm formants show that slow modulation can organize a texture without becoming a note. Graph traversal shows that possibility can be constrained before the listener can name the graph.

The compositional aim is not maximal explicitness. It is timely recoverability.

A musical instruction succeeds when it reaches the listener before the moment in which it needs to matter.

---

_Sources: cached synthesis packs `data/generated/synthesis/2026-05-18T00-26-33-810Z/` (embedded instruction: phase watermarking, Tonnetz geometry, path-dependent ice phases, call-and-response, and performer style), `data/generated/synthesis/2026-05-17T16-26-36-161Z/` (carrier-preserved relations: prosodic annotation, transmission constraints, material coloration, and 600 ms full-duplex chunks), and `data/generated/synthesis/2026-05-12T00-27-14-364Z/` (latent score identity: rhythm formants, voicing fingerprints, multilevel score understanding, and harmonic adjacency). The terms **instruction bandwidth**, **decoding window**, and **relation multiplexing** are proposed operational compositional concepts, not established universal information-theoretic measurements._
