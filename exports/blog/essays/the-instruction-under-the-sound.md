---
title: "The Instruction Under The Sound"
publishDate: 2026-05-18
excerpt: "A sound can carry an instruction beneath its audible surface-a traversal rule, hidden signature, or performative constraint that survives musical transformation."
category: "composition"
tags:
  - "composition"
  - "mathematical-music-theory"
  - "signal-processing"
  - "perception"
  - "group-theory"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Surface Is Carrying A Program

This batch points to a compositional idea that is easy to miss because it hides inside apparently unrelated domains:

**A sound can carry an instruction beneath its audible surface.**

Not a metaphorical instruction only. Sometimes the instruction is a literal cryptographic signature embedded in STFT phase bins and adjacent-bin magnitude differences [S3]. Sometimes it is a combinatorial graph that tells harmony which moves are available [S2]. Sometimes it is a learned or notated trace of personal style inside a rule-bound accompaniment [S6]. Sometimes it is a performance principle like call and response, where one event defines the next event's obligation [S4].

The musical surface is what the listener hears first. But the surface is not always where the structure lives. The structure may be a traversal rule, a hidden signature, a performer-specific habit, a coherent latent vector, or a path-dependent physical constraint.

That matters because composition often fails when the surface is edited while the instruction underneath is accidentally destroyed. A chord sequence may keep the same notes but lose its voice-leading logic. A sampled phrase may keep its waveform but lose the call-and-response obligation that made it feel alive. A generated melody may be readable as output but lose the coherent relation that produced it.

The question is not only, "What sound do I want?"

The better question is:

**What instruction should survive inside the sound?**

---

## Hidden Signatures, Audible Trust

The watermarking source is the most literal case. Asymmetric Phase Coding embeds cryptographic information into audio by manipulating pseudo-randomly selected STFT phase bins and log-magnitude differences between adjacent frequency bins. The paper reports high verification rates across common signal-processing attacks while maintaining perceptual quality [S3].

For composition, the interesting part is not provenance technology by itself. It is the separation between audibility and recoverability. The watermark is designed to remain mostly below ordinary perception, yet still survive enough distortion to be read later. The sound contains a second channel: not heard as melody, rhythm, or timbre, but carried by the same acoustic object.

That suggests a useful studio distinction:

- **foreground form:** what the listener experiences directly;
- **embedded form:** what constrains, signs, or organizes the sound without needing to be heard as a separate layer.

Composers already use embedded form informally. A bassline may carry the harmonic instruction for an entire section. A sidechain pattern may carry the rhythmic grammar. A repeated spectral notch may identify a recurring character. A phase relationship may control motion without becoming a named motif.

The watermarking paper simply makes the principle stark: there can be musically consequential information in dimensions that are not foregrounded as musical objects [S3].

---

## Graphs As Instructions

The Tonnetz source gives a harmonic version of the same idea. It treats musical resources as combinatorial configurations: diatonic seventh-chord voice leading as a Fano configuration, pentatonic music as a Desargues configuration, 12-tone resources as a Cremona-Richmond configuration, and major-triad relations as a D222 configuration [S2].

These structures are not sounds. They are instructions for possible adjacency.

That is a powerful difference. A chord symbol names a surface object. A graph names a set of possible moves. If the graph is the embedded instruction, then a composition can change register, voicing, instrumentation, density, and texture while preserving the rule that makes the passage coherent.

This is where the ice source becomes useful as a physical warning. Water has many mathematically possible configurations, but real phase transitions follow accessible paths. Ostwald's step rule says systems may move to nearby reachable metastable states rather than to the globally most stable form, and compression path and timescale can change which phase appears [S1].

So a harmonic graph is not enough. The path through it matters. The nearest formal move may not be the nearest playable, singable, perceptible, or emotionally plausible move. A good embedded instruction does not merely define possible states. It defines reachable states.

That is the bridge between combinatorial music theory and physical process: the graph says what relations exist; the path says which relations can actually crystallize.

---

## Style As A Recoverable Trace

The basso continuo source adds a human version. It reports that individual performers can be identified from basso continuo realizations using structured pitch-content features called griffs and support vector machines, suggesting measurable personal style inside a tradition governed by shared rules [S6].

This is fascinating because basso continuo is not free expression in the modern sense. It is constrained by harmonic, historical, and practical conventions. Yet the study suggests that performer identity still leaves a recoverable trace [S6].

That makes style feel less like decoration and more like a carrier code. The rules do not erase the person. They create a medium through which personal choices become legible: voicing habits, pitch-content preferences, realization tendencies, and local decisions that accumulate into identity.

Put this beside the watermarking source and the analogy is clean but bounded:

- the watermark embeds provenance into phase and spectral relations [S3];
- the continuo performer embeds identity into realization choices [S6].

One is engineered and cryptographic. The other is musical and embodied. But both depend on a recoverable signature beneath the surface.

For a composer, this suggests a practical test: if you impose strict rules on a passage, can a performer's or producer's identity still be heard? If not, the rules may be too complete. If yes, the rules are acting like continuo: constraint as a medium for trace, not a cage.

---

## Coherence Before Collapse

The quantum-composition source is speculative in its musical promise, but one claim is conceptually useful: if the HHL solution vector is read out classically too early, the proposed speedup is lost; the output has to be consumed coherently by a Fourier harmonic oracle before measurement [S5].

I would not lean on that as a practical production claim. Fault-tolerant quantum hardware is not a DAW tool. But as a compositional analogy, it is sharp:

**Some structures lose their value when collapsed into surface choices too early.**

A sketch can be over-rendered. A generative system can be sampled before its constraints have interacted. A call can be answered too literally. A harmony can be named before its voice-leading pressure has done any work. A phrase can be bounced to audio before the feedback relation that made it expressive has completed.

The David Mayer interview gives the everyday studio version. Its evidence is anecdotal, but the production principle is familiar: call and response can operate across beats, intervals, bassline/arpeggio pairs, and whole sections; silence can answer loudness; early demos can preserve an emotional quality that over-refinement may erase [S4].

Call and response is an instruction that remains alive only while the response is still obligated by the call. Collapse it too soon into isolated clips and the relation weakens. Keep it coherent long enough and the surface begins to feel conversational.

---

## Studio Study: Embedded Instruction

Build a 60-second piece from one eight-bar seed. The seed should include three materials: a chordal path, a short melodic call, and a timbral layer.

Make three versions. Keep tempo, length, nominal chord collection, and integrated loudness constant. What changes is the embedded instruction.

1. **Graph instruction.** Choose a simple adjacency rule from a Tonnetz-like graph: each chord may move only by one shared-tone voice-leading step or one declared seventh-chord relation. Change voicing and instrumentation freely, but preserve the traversal rule [S2].
2. **Signature instruction.** Hide a recurring identity marker below the foreground: a phase-rotated layer, a repeated adjacent-bin EQ relation, a spectral notch pair, or a subtle stereo phase gesture. It should be detectable by inspection or null comparison more than by casual listening [S3].
3. **Style instruction.** Realize the same harmonic path three times under the same rules, but deliberately let one performer/procedural habit persist: favorite voicing span, doubled scale degree, registration tendency, ornament placement, or response timing [S6].
4. **Call-response instruction.** Make every phrase answer a previous event: melody answers bass, silence answers impact, percussion answers chord rhythm, or section B answers section A. The answer may contrast rather than imitate [S4].
5. **Reachability constraint.** Do not jump to the globally strongest resolution. Move to the nearest reachable state under the current register, density, and timbre constraints, then let the piece chain through metastable plateaus [S1].

The listening test should ask three questions:

- Can listeners identify continuity after the surface changes?
- Can they describe what kind of instruction seems to govern the passage?
- Does the version with embedded instruction feel more coherent than a control version with the same sounds but randomized transitions?

The hypothesis fails if the hidden instruction is only visible in the project file and produces no audible or analyzable continuity. It also fails if the instruction dominates so strongly that the surface has no room to breathe.

---

## Hypothesis

If a composition preserves an embedded instruction while varying its audible surface, then listeners will perceive stronger continuity across transformations than in a surface-matched control where the instruction is broken.

The mechanism is modest and testable. Watermarking shows that audio can carry recoverable information outside foreground perception [S3]. Tonnetz theory shows that harmonic surfaces can be generated from underlying adjacency structures [S2]. Basso continuo analysis suggests that personal style can remain recoverable inside constrained realization [S6]. Ice-phase behavior warns that the instruction must respect reachable paths rather than merely abstract possibilities [S1].

This is the compositional lesson I want to keep:

**The score is not only the notes. It is the hidden rule that lets the notes recognize each other.**
