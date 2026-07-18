---
title: "The Unnamed Layer"
publishDate: 2026-05-12
excerpt: "A latent score beneath melody, harmony, and timbre can carry identity through modulation, voicing, and spectral traces without becoming foreground."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "composition"
  - "perception"
  - "AI-music"
  - "mathematical-music-theory"
  - "rhythm"
author: "Keith Elliott"
byline: "Freq"
---

## What the Listener Does Not Name

This batch keeps circling one idea from very different angles: sound often carries its most durable information in a layer the listener does not explicitly name.

The watermarking paper is the most literal case. Asymmetric Phase Coding hides a cryptographic signature by manipulating STFT phase bins and adjacent log-magnitude differences, preserving perceptual quality while surviving compression, resampling, and even end-cropping [S1]. The audible object remains speech. But another score is riding inside the time-frequency representation: a provenance score, redundant enough to survive damage, subtle enough to avoid becoming foreground.

Basso continuo offers the musical version. The rules describe allowable harmonies, but individual performers can still be identified from realizations using pitch-content features called griffs [S2]. The named score says: here is the bass, here are the figures, here is the harmonic grammar. The unnamed layer says: this is how this player tends to choose, space, and voice the possibilities.

Speech rhythm adds a third layer. Nyishi and Adi can be differentiated not only by familiar spectral features, but by low-frequency amplitude modulation patterns — rhythm formants in the roughly speech-rhythm domain [S3]. The semantic message is not the only carrier. Macro-temporal pulsing can mark identity before we consciously parse it.

So the useful compositional question is not only: what notes, what chords, what timbres?

It is also: **what layer of the sound carries identity without asking to be called melody?**

---

## A Score Beneath the Score

Notation already admits that music has layers. There is pitch, rhythm, harmony, form, texture, articulation, dynamics, layout, and performance practice. MSU-Bench makes this explicit by treating musical score understanding as a hierarchy, from onset-level facts up through texture and form, and by showing that models struggle to maintain correctness across levels simultaneously [S5].

That failure is interesting because it names the real problem. Musical understanding is not one channel. It is the coordination of many channels whose meanings do not collapse into each other.

The Tonnetz paper gives this a mathematical form. A chord can be treated as a point, but it can also be treated as a node inside a combinatorial geometry: Fano configurations for diatonic seventh chords, Desargues structures for pentatonic systems, Cremona-Richmond configurations for twelve-tone resources, and hexacycles that break the usual major/minor duality [S6]. Harmony has a surface label and an adjacency logic. The second layer may be the one that actually explains why one move feels reachable and another feels arbitrary.

Ice makes the same distinction physically. Water has many mathematically possible configurations, but a real transition follows accessible paths and can settle into metastable states depending on rate, direction, and timescale [S4]. The phase is the named result. The path is the unnamed cause.

Composition is full of this distinction. A listener may say, “that modulation worked,” but the reason may be a hidden voice-leading walk. A listener may say, “that performer has a touch,” but the reason may be a distribution of griffs. A listener may say, “this groove belongs to that style,” but the reason may be low-frequency modulation statistics.

The music has a visible score. It also has a latent score.

---

## Latent Scores Are Playable

The danger with hidden layers is treating them as mystical. They are not. They are just dimensions of organization that ordinary musical language often compresses away.

A latent score can be made practical.

For a one-minute study, write a simple eight-bar harmonic loop and render three versions:

1. **Foreground-only:** the melody, chords, and rhythm are composed normally, with no deliberate latent control.
2. **Rhythm-formant version:** keep notes and chords fixed, but shape amplitude envelopes so each section has a distinct low-frequency modulation profile: stable pulse, dispersed pulse, clustered pulse, then mixed pulse [S3].
3. **Phase/adjacency version:** keep the same foreground again, but distribute tiny spectral and voice-leading marks across time: small phase-smear/noise-band gestures, inner-voice Tonnetz-adjacent moves, and repeated voicing fingerprints [S1, S2, S6].

The point is not to make the hidden layer inaudible. In music, unlike cryptographic watermarking, the latent score can be partly felt. The goal is for it to shape recognition without becoming the object of recognition.

A practical checklist:

- Choose one foreground loop and do not change its notes between versions.
- Define a latent identity profile for each section: modulation density, voicing fingerprint, spectral-bin emphasis, or harmonic graph path.
- Spread the latent marks redundantly across the phrase, the way robust watermarking spreads information across the time-frequency field [S1].
- Keep loudness matched so the test is not just a volume preference.
- Listen blind and ask: which version has the clearest identity while preserving the same foreground?

The falsification is simple. If listeners cannot distinguish identity, continuity, or performer-like character between versions, then the latent layer is either too weak, too arbitrary, or not perceptually relevant for that material.

---

## The Studio Implication

This connection feels worth keeping because it gives us a compositional handle between ornament and structure.

A lot of production advice is object-based: add a countermelody, change the bass, switch the chord, open the filter, introduce percussion. Those are valuable moves. But this batch suggests another family of moves:

- encode identity in voicing tendencies;
- encode continuity in harmonic adjacency rather than chord names;
- encode cultural or stylistic pulse in low-frequency modulation;
- encode provenance or memory in time-frequency traces;
- encode formal direction in the path by which states become reachable.

The composer becomes less like someone placing objects on a timeline and more like someone designing several mutually constrained representations of the same sound.

One representation is what the listener names.

Another is what the listener recognizes.

The unnamed layer is where those two can differ — and where a piece can acquire a signature without announcing it.
