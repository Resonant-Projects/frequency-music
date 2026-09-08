---
title: "The Critical-Band Score"
publishDate: 2026-09-08
excerpt: "The ear does not resolve sound in equal slices."
category: "interdisciplinary"
tags:
  - "psychoacoustics"
  - "perception"
  - "composition"
  - "signal-processing"
  - "acoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Ear Does Not Hear in Equal Slices

A spectrum analyzer tempts us to imagine frequency as a smooth ruler. Divide the ruler into equal regions, place events in different ranges, and call the texture separated. But the ear is not an equal-width measuring device. It listens through uneven windows: low frequencies are resolved differently from high frequencies; nearby partials can mask each other; a small spectral change may matter in one region and vanish in another.

That matters compositionally. If the listening system divides sound into perceptual bands, then orchestration is not only the art of assigning notes to instruments. It is also the art of assigning evidence to the bands where it can survive.

The cached synthesis behind this essay crosses Bark-scale dynamics processing, semi-fragile audio watermarking, phase-equivariant music representations, ultra-low-bitrate speech coding, rhythm-formant analysis, and score-understanding benchmarks. The shared claim is not simply that fidelity matters. It is sharper: **musical identity depends on where resolution is spent**.

A critical-band score treats perceptual frequency bands as lanes of responsibility. Each lane may carry attack, warmth, pitch evidence, source identity, rhythmic pulse, masking, hidden watermark, or deliberate ambiguity. The composer does not merely ask, "Is the mix detailed?" She asks, "Which band is allowed to answer this musical question?"

## Band Boundaries Are Musical Boundaries

The Bark24 dynamics source is promotional and thin as evidence, but its premise is useful: a dynamics processor based on the Bark scale respects psychoacoustic critical bands more directly than arbitrary crossover points. A five-band compressor can be musically excellent, but its bands are engineering conveniences. A Bark-aligned processor starts from the listener's frequency resolution.

That reframes multiband processing. The crossover is not just a technical setting. It is a boundary of attention. Put two musical claims inside one masking-prone region and the ear may fuse them, blur them, or let one dominate. Place them across perceptually meaningful bands and the same material may become legible without needing more volume.

This suggests a simple compositional move: sketch a phrase twice. In the first version, distribute instruments by register in the usual way. In the second, distribute them by perceptual responsibility. Let one critical-band region carry vowel-like source identity, another carry transient proof, another carry warmth, another carry rhythmic modulation, and another carry harmonic tension. The notes may be identical, but the listening grid changes.

The interesting question is not whether the Bark version is automatically better. It may not be. The test is whether the band assignments make musical evidence easier to recover: source, contour, pulse, consonance, distance, pressure, or instability.

## Hidden Information Lives Where Masking Allows It

StreamMark adds a more exacting version of the same idea. It embeds an imperceptible watermark that survives benign changes such as compression and noise, but breaks under meaning-changing transformations like voice conversion or speech editing. The reported numbers are striking: near-transparent quality around 24.16 dB SNR and PESQ 4.20, robust recovery above 98% after benign transformations, and near-chance recovery after deepfake attacks.

For composition, the point is not deepfake detection. The point is that an audio signal can carry a hidden identity contract in places the ear does not foreground. The watermark survives because the embedding uses structure that transformations preserve. It fails when the transformation changes the layer that mattered.

That is exactly the logic of a critical-band score. Some bands can carry foreground sound. Other bands can carry proof: tiny modulation, phase relation, noise color, residual texture, or a repeated spectral fingerprint. These details need not become consciously audible to matter. They can stabilize identity, cue continuity, or let a listener feel that two events belong to the same source.

A useful studio experiment would be to write a four-note motif, then embed a low-level recurring spectral gesture in one Bark region only. Render versions where that band is preserved, compressed, masked, or shifted. If listeners report that the motif feels more continuous when the hidden gesture survives, then the band was carrying identity. If they hear only surface tone changes, the hidden layer was not load-bearing.

## Phase Is Not Decoration

PHALAR contributes a warning against magnitude-only listening. Its stem-retrieval framework improves musical matching by enforcing pitch and phase equivariance with spectral pooling and a complex-valued head. In plain language: the model does better when it treats frequency shifts and phase relationships as structured musical facts rather than disposable details.

That should make composers careful. Many production workflows emphasize magnitude: EQ curves, spectral balance, loudness, masking, brightness. These are real. But phase and timing relations can carry coherence even when they are difficult to name. A stem can belong with a submix because its attacks, phase behavior, and temporal structure lock into the surrounding texture. Two notes can share pitch class and timbre but fail to feel related because their microtiming or phase relation does not answer the room.

The critical-band score therefore has two axes. One axis is frequency region: where in the ear's banded map the evidence sits. The other is relation type: magnitude, phase, onset, modulation, envelope, harmonicity, or source color. A band is not just a bucket. It is a place where different kinds of evidence can be made fragile or robust.

This is where the idea becomes genuinely compositional. Score a cello harmonic and a filtered synth not merely as high-register events, but as two occupants of a shared perceptual band with different phase responsibilities. Let one provide stable magnitude, the other unstable phase shimmer. Or reverse it: a noisy layer carries stable timing while a pitched layer carries unstable brightness. The band becomes contrapuntal.

## Intelligibility Is Not the Same as Fidelity

ClariCodec sharpens the claim under extreme pressure. At 200 bps, the codec cannot preserve everything. It uses reinforcement learning to optimize speech intelligibility rather than acoustic reconstruction, improving word error rate by rewarding the task that matters. This is a brutal but clarifying lesson: when bandwidth is scarce, fidelity is not one thing. The system must choose which evidence deserves bits.

Music has the same problem, even without literal compression. A dense arrangement has limited perceptual bandwidth. A small speaker has limited bass authority. A reverberant room has limited transient clarity. A listener has limited attention. A mix has limited headroom. The composer is always operating under a resolution budget.

The critical-band score makes the budget explicit. If a passage needs its words, melody, or rhythm to survive, spend resolution there. If it needs source mystery, spend resolution on ambiguous bands and withhold decisive evidence. If it needs harmonic pressure, keep the partials that create roughness, beating, or lock. If it needs distance, degrade the same bands a codec or wall would degrade.

This is not a call to make everything clean. It is a call to make loss intentional. A band can be blurred because the music does not need it to answer. Another can be protected because it carries the identity claim.

## Rhythm Has Formants Too

The rhythm-formant source extends critical-band thinking below ordinary pitch. It analyzes speech rhythm through low-frequency amplitude modulation, typically in the 1-10 Hz region, and reports that these modulation features can distinguish related languages with substantial accuracy. Macro-temporal rhythm becomes a spectral object.

That is a lovely bridge. Meter and groove are not only note placements on a grid. They are slow modulation spectra moving through the body of the sound. A sidechain pulse, tremolo field, consonant rhythm, kick pattern, bow pressure cycle, or syllabic stress pattern can act like a low-frequency formant: a broad temporal color that identifies a style or source.

In a critical-band score, these low-frequency modulation bands are not separate from timbre. They animate timbre. A pad with a 2 Hz amplitude swell and a hi-hat field with 8 Hz flicker can occupy different rhythmic formants even if their pitches are static. A melody can be preserved while its modulation formant changes, producing the uncanny feeling of the same line spoken by a different temporal body.

That opens a practical recipe:

1. Write a 60-second phrase with a stable melody and harmony.
2. Divide the arrangement into perceptual roles: low-frequency modulation, low-mid body, speech/vowel region, brightness/transient proof, and air/noise.
3. Assign one role per band: pulse, source identity, harmonic roughness, attack evidence, or hidden continuity cue.
4. Render three versions:
   - **clean-band version:** each role gets its own perceptual region;
   - **masked-band version:** two important roles are forced into the same critical band;
   - **loss-aware version:** one non-essential band is deliberately blurred while the identity-bearing band is protected.
5. Blind-rate same-piece identity, groove clarity, source continuity, and surface quality.

The falsifier is important. If critical-band assignment produces no more clarity than arbitrary EQ placement, then the score is over-theorized. If masking two roles creates a specific loss — the groove survives but source identity fails, or the source survives but phrase contour fails — then the band map has become musical form.

## The Score Beneath the Score

The traditional score names pitch, duration, dynamics, articulation, and sometimes timbre. The mix names level, pan, EQ, compression, space, and automation. A critical-band score sits between them. It names what each perceptual region is responsible for preserving.

That responsibility can be written plainly:

- Band 1 carries bodily pulse; it may distort, but must not lose periodicity.
- Band 6 carries vowel/source identity; avoid masking during entrances.
- Band 12 carries harmonic roughness; allow beating to remain audible.
- Band 18 carries transient proof; protect attack timing through reverb.
- Band 22 carries hidden continuity; keep the spectral fingerprint below foreground attention.

This kind of notation is not a replacement for notes. It is a second score for evidence. It tells the arrangement what the listener must be able to recover, what may be sacrificed, and where ambiguity is allowed to live.

The beautiful part is that this turns psychoacoustics into counterpoint. Critical bands become voices. Masking becomes suspension. Compression becomes orchestration. Watermarking becomes hidden thematic work. Phase becomes relation. Loss becomes form.

The ear does not hear in equal slices. So the music should not always be written as if it does.

---

_Sources: cached synthesis contexts `data/generated/synthesis/2026-05-21T00-26-47-882Z/` and `data/generated/synthesis/2026-05-20T16-26-49-940Z/`, including Bark-scale dynamics, StreamMark semi-fragile audio watermarking, PHALAR phase-equivariant musical representations, ClariCodec 200 bps intelligibility-first coding, rhythm-formant speech analysis, and related score/representation sources. Connects to: [The Resolution Budget](/docs/essays/the-resolution-budget.md), [The Translation Loss](/docs/essays/the-translation-loss.md), [The Listening Grid](/docs/essays/the-listening-grid.md), [The Evidence Carrier](/docs/essays/the-evidence-carrier.md), and [The Layer That Answers](/docs/essays/the-layer-that-answers.md)._
