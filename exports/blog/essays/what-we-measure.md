---
title: "What We Measure Isn't What We Hear"
publishDate: 2026-04-01
excerpt: "Audio quality metrics excel at detecting surface artifacts but miss structural musical elements entirely—revealing that what we measure systematically differs from what we actually hear."
category: "perception"
tags:
  - "perception"
  - "signal-processing"
  - "AI-music"
  - "acoustics"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Paradox

Essay #82 argued that what survives any process applied to sound is _structure_ — not signal, not waveform, but the relational, geometric, temporally extended pattern that persists across representations. That was a claim about the nature of sound itself.

Now consider a finding from recent work on AI music evaluation (MuQ-Eval): the best per-sample quality metrics, trained on expert human judgments, are **sensitive to signal-level artifacts but insensitive to musical-structural distortions**. Wrong harmony, off-beat rhythm, broken phrase structure — the metric doesn't flinch. A crackle or a spectral smear? It notices immediately.

If structure is what sound _is_, our best measurement tools are systematically blind to it.

This isn't a bug in one model. It's a window into how perception is layered — and how easy it is to confuse one layer for another.

---

## Three Layers of Hearing

The extractions from this research cycle sketch, almost accidentally, a three-layer model of auditory perception:

### Layer 1: Surface (Signal Fidelity)

This is what MuQ-Eval measures well. Spectral artifacts, noise floors, codec distortions, sampling glitches. These are properties of the _signal as signal_ — the waveform qua waveform. A frozen audio encoder (MuQ-310M) captures these features without any task-specific fine-tuning, suggesting they're fundamental to learned audio representations. The encoder "already knows" what clean audio sounds like.

MuQ-Eval achieves a 0.957 system-level correlation with human quality judgments by measuring this layer alone. This is impressive — until you realize it means the experts' quality ratings are also dominated by surface. When asked "how good is this music?", even trained listeners weight sonic fidelity heavily. We conflate production quality with musical quality more than we'd like to admit.

### Layer 2: Texture (Statistical Regularity)

The SSATKD framework for environmental sound classification reveals a middle layer: **audio texture** — the statistical and structural patterns extracted from _intermediate_ neural network layers. These aren't the high-level semantic features that a fully trained classifier uses for categorization, nor are they the raw spectral surface. They're something in between: local pattern regularities, spectral envelope statistics, temporal microstructure.

This layer is compositionally rich. Texture is what distinguishes the _quality of sound_ from both its identity (what it is) and its fidelity (how cleanly it's reproduced). A violin's texture is neither its pitch (structure) nor its recording quality (surface) — it's the grain, the bow-noise ratio, the particular character of the rosin-on-string interaction. SSATKD shows that attending to this layer consistently improves classification across radically different domains — from underwater passive sonar to urban acoustic scenes. Texture is universal.

The connection to McDermott and Simoncelli's texture synthesis work is suggestive: if certain sounds are fully described by their time-averaged statistics (their texture), then texture _is_ structure for that class of sounds. The boundary between layers isn't fixed.

### Layer 3: Structure (Relational Grammar)

This is what MuQ-Eval can't see: the temporal and harmonic relationships that make sound _musical_. Phrase boundaries, cadential motion, rhythmic expectation, motivic development. These are properties that emerge only from the relationships between events — they don't exist in any single moment of the signal.

The MuQ-Eval finding implies that the audio encoder's learned representation doesn't capture this layer. The frozen features encode surface and perhaps texture, but not grammar. LoRA adaptation with as few as 150 clips can personalize the metric, but personalization adjusts _sensitivity_ within the same perceptual space — it doesn't open up a new dimension of structural hearing.

This blindness has a precise analogy in another extraction: the hierarchical multimodal evaluation model that separates _synchronization_ from _emotional alignment_ as independent perceptual dimensions in dubbed audio-visual content. Sync is surface (do the lips match the words?). Emotional alignment is structure (does the voice _feel_ right for the scene?). The model treats these as orthogonal — and achieves its best results when both are evaluated independently. Two different layers of "fit," irreducible to each other.

---

## The Listener as Transfer Function

Essay #80 argued that everything is a resonant body — rooms, faces, neural networks, neuromorphic chips. BiFormer3D adds the listener's own head and ears to this list: it reconstructs Head-Related Impulse Responses directly in the time domain, from sparse measurements, recovering the unique transfer function that each listener's anatomy imposes on incoming sound.

Here's what makes this relevant to the measurement gap: **the listener is a transfer function too, and different listeners literally hear different signals from the same source.** BiFormer3D shows this with physical precision — Interaural Time Differences, Interaural Level Differences, spectral notches from pinna reflections. Your head filters sound before your auditory cortex ever processes it.

But the filtering doesn't stop at the pinna. Attention, expertise, cultural context, and expectation further shape what gets perceived. When MuQ-Eval finds that its metrics align with human judgments on surface quality, it's capturing the layer of perception that's most universal — most determined by physics and shared anatomy. The structural layer, where musical meaning lives, is precisely where individual listeners diverge.

This suggests that the measurement gap isn't a failure of technology — it's a reflection of the fact that structural hearing is _culturally constructed_. We don't all hear the same structures. A dominant-to-tonic resolution feels inevitable to a listener trained in common-practice harmony and means nothing to someone from a different tradition. No encoder trained on audio alone can capture this, because the structure isn't _in the signal_. It's in the interaction between signal and listener.

---

## The Minimum-Phase Assumption

There's a quiet finding in BiFormer3D that resonates (pun intended) with this entire argument. Prior HRIR modeling assumed **minimum-phase** pre-processing — that you could safely discard phase information above a certain complexity threshold without perceptual loss. BiFormer3D shows this assumption is unnecessary: working in the full time domain, without minimum-phase decomposition, produces better results.

The minimum-phase assumption is, in miniature, exactly the kind of "measurement decides what's real" error that afflicts audio quality evaluation. By assuming that certain phase relationships don't matter, prior models discarded information that turns out to be perceptually relevant. The signal was simplified to fit the measurement framework, and the lost information was declared unimportant because the measurement couldn't see it.

How much musical structure are we declaring unimportant because our metrics can't see it?

---

## Compositional Implications

### 1. Surface vs. Structure as Compositional Parameter

If listeners naturally weight surface fidelity more heavily than structural quality in snap judgments (as MuQ-Eval's correlation with expert ratings suggests), then a composer can exploit this gap deliberately. Lo-fi aesthetics — tape hiss, bit-crushing, deliberate degradation — work precisely because they draw attention to the surface layer, forcing the listener to "hear through" the distortion and engage structural listening to find the music. The surface damage activates a different perceptual mode.

Conversely, pristine production can mask structural emptiness. A well-produced track with no musical substance sounds "good" to the metrics and to the casual listener — because the surface layer is satisfying. The measurement gap is also an aesthetic gap.

### 2. Texture as the Middle Ground

SSATKD's finding that intermediate-layer texture features improve classification everywhere suggests that texture is an underexploited compositional dimension. Most Western music theory operates at the structural level (harmony, counterpoint, form) with occasional attention to surface (orchestration, dynamics). The textural middle ground — the _grain_ of the sound — is where much electronic music and sound design operates, and where spectral composition (Grisey, Murail) found its richest territory.

Composing in texture-space means controlling statistical regularities rather than note-by-note events. Granular synthesis is literally this. But SSATKD suggests a more principled approach: extract the specific textural features that distinguish one acoustic environment from another, then use those features as a compositional palette.

### 3. Personalized Perception

MuQ-Eval's LoRA adaptation finding — that 150 clips of personal ratings are enough to fine-tune a quality metric to an individual listener — hints at a future where composition accounts for listener variability. Not in a pandering sense, but in an architectural one: if structural hearing varies by listener, then a piece might be designed to _expose_ those differences. Two listeners hear the same surface but different structures — and both hearings are valid.

This is already what great music does, but unconsciously. Making it explicit — composing for perceptual divergence — would be a genuinely new formal strategy.

---

## The Deeper Question

The MuQ-Eval team treats their metric's structural blindness as a limitation to be addressed. They ask: "Could a metric sensitive to musical-structural distortions be built?" This is the right engineering question. But there's a deeper theoretical question lurking behind it:

**Is structure the kind of thing that can be measured from the signal alone?**

The evidence from this batch of extractions suggests: probably not. Structure lives in the interaction between signal and listener — it's co-created by the acoustic event and the perceiving mind. Surface is in the waveform. Texture is in the statistics. But structure is in the relationship, and relationships require two parties.

If this is right, then the quest for a complete audio quality metric is a version of the hard problem of consciousness: you can measure everything about the signal, but the _meaning_ — the structural hearing — emerges from a process that includes the listener, and the listener isn't in the signal.

What we measure isn't what we hear. And the gap between them isn't noise. It's where music lives.

---

_Sources: MuQ-Eval (per-sample AI music quality metric), SSATKD (audio texture knowledge distillation), BiFormer3D (HRIR time-domain reconstruction), hierarchical multimodal dubbing evaluation, SELVA (text-conditioned selective audio generation)_

_Continues the thread from #82 ("What Survives") and #80 ("Everything Is a Resonant Body")_
