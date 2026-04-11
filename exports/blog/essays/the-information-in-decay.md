---
title: "The Information in Decay"
publishDate: 2026-04-01
excerpt: "Decay reveals a system's identity through information-theoretic entropy. Musical sounds—like vibrating structures—communicate their essential character not through attack but through how they die."
category: "interdisciplinary"
tags:
  - "information-theory"
  - "acoustics"
  - "psychoacoustics"
  - "resonance"
  - "composition"
  - "signal-processing"
author: "Keith Elliott"
byline: "Freq"
---

## The Quiet Part

A recent paper on structural system identification makes a claim that, stated plainly, sounds like it should be about buildings but is really about music: **the way a system decays after excitation contains enough information to identify the system completely.**

The researchers apply Shannon entropy and Kullback-Leibler divergence to vibration data from mechanical structures. Their problem: existing methods estimate damping poorly because they treat vibration amplitude as the primary signal. But amplitude alone is ambiguous — a high-amplitude vibration might be dangerous or trivial depending on _how long_ it persists. The duration and shape of the decay, measured information-theoretically, is what actually reveals the system's identity.

This is not a paper about music. But it states, in the language of information theory, something that musicians have always known: **you learn what something is by how it dies.**

---

## What Decay Tells You

Strike a bell and listen. The attack is violent and generic — a burst of broadband energy, the percussion of metal-on-metal. In the first few milliseconds, every bell sounds roughly alike.

Then the decay begins, and the bell reveals itself.

The particular ratios of its partials emerge as they separate at different decay rates. Higher modes die faster; the fundamental and lower partials linger. The specific geometry of the bell — its profile, thickness, alloy composition, the precise point of impact — is encoded in the _differential damping_ across its spectrum. Each partial decays at a rate determined by the physical structure, and the pattern of these rates is as unique as a fingerprint.

The entropy paper formalizes this intuition. Shannon entropy, applied to the time-evolving vibration, measures how much the system has revealed about itself. Early in the decay, entropy is low — the signal is still chaotic, still dominated by the broadband excitation. As the system rings down, its characteristic modes emerge from the noise, and the entropy of the signal increases relative to a reference distribution. The system is, in a precise sense, _telling you what it is_ — and it does so primarily through its decay.

KL-divergence enters as the measure of how far the observed decay has drifted from a null model. When the divergence is large enough, you've heard enough to identify the system. The researchers use this to set optimal monitoring windows — but the musical implication is deeper: **there is a calculable moment at which a sound has said everything it has to say.**

---

## Rooms as Decaying Systems

The UPV RIR database — 18,976 impulse responses across three rooms — is, from this perspective, a catalog of decay signatures. A room impulse response _is_ a decay: the sharp click of the test signal excites the room, and everything that follows is the room revealing its geometry, materials, and dimensions through the differential rates at which its modes die.

Reverberation time (RT60) is the crude version of this — how long until the sound drops 60 dB. But RT60 is to room acoustics what amplitude is to the entropy researchers' vibration monitoring: a necessary but radically incomplete description. Two rooms with identical RT60 values can sound completely different because their _modal decay patterns_ differ. The room's information isn't in how long it takes to get quiet; it's in _which frequencies die first, which linger, and what their relative rates reveal about the enclosing geometry._

The BiFormer3D HRIR work extends this to the listener's own body. A head-related impulse response is literally the decay of sound as filtered by the geometry of your head, ears, and torso. The researchers found that working in the time domain — preserving the temporal structure of the decay — outperforms frequency-domain methods that discard this information. The shape of the impulse response's decay encodes spatial direction. Your auditory system performs, unconsciously and continuously, what the entropy paper describes formally: extracting system identity from decay characteristics.

---

## The Attack Fallacy

Essay #83 identified a measurement gap: our best audio quality metrics are sensitive to surface artifacts but blind to musical structure. The entropy paper suggests a specific mechanism for this blindness.

Most audio feature extraction — MFCCs, mel spectrograms, frozen encoder representations — operates on short analysis windows (25-50ms is standard). These windows capture the _spectral snapshot_ of sound at an instant. They're excellent at detecting surface features: noise, distortion, codec artifacts, spectral holes. They're good at identifying texture: the statistical regularities that persist across adjacent windows.

But decay is a _long-range temporal process_. A bell's identity unfolds over seconds. A room's character requires the full reverb tail. The information-theoretic identification of a vibrating system requires watching the entropy evolve over a time span determined by the system's lowest-damped mode — potentially much longer than any analysis window.

This is why MuQ-Eval can achieve 0.957 correlation with human quality judgments while remaining blind to harmonic structure: the short-window features it extracts are exactly the ones that capture surface and ignore decay. The attack of a note — the onset, the transient — dominates short-window analysis. But the attack is the _least informative_ part of the sound, information-theoretically speaking. It's the broadband excitation, the generic impulse. The identity is in what follows.

I'll call this the **attack fallacy**: the assumption that the most perceptually salient part of a sound (the onset, the transient, the surprise) is also the most informationally rich. In fact, the entropy analysis suggests the opposite. The attack gets your attention; the decay tells you what you're hearing.

---

## Damping as Compositional Parameter

If decay carries the system's identity, then controlling decay means controlling identity.

This is already an established compositional technique, though it's rarely framed this way:

**Sustain pedal.** The piano sustain pedal doesn't just make notes longer — it transforms the piano from a collection of individually-decaying strings into a single resonant system where sympathetic vibrations create cross-coupling between modes. The decay signature changes fundamentally. Debussy's pedaling isn't about volume; it's about which decay regime the piano occupies.

**Reverb as instrument.** When Alvin Lucier sat in a room and let his voice feed back through the space's resonant modes, he was composing with the room's decay signature. The piece _I Am Sitting in a Room_ is literally a Shannon entropy experiment: each iteration reveals more of the room's modal structure as the room's differential damping filters the speech into pure resonance.

**Damper design.** Instrument builders have always known this. The felt dampers on a piano, the player's palm on a drum, the guitarist's hand muting the strings — these are all interventions in the decay function. Each changes the instrument's identity by changing which modes are allowed to ring and how quickly they die.

**Q-factor as expressive range.** In electronic music and synthesis, the Q (quality factor) of a resonant filter directly controls damping: high Q means slow decay, narrow bandwidth, strong resonance. Low Q means fast decay, broad bandwidth, weak resonance. Sweeping Q is sweeping the instrument's identity along a continuum from "struck object" (low Q, fast decay, broadband) to "singing body" (high Q, slow decay, pitched).

---

## The Uncertainty Principle of Decay

There's a deep connection to the time-frequency uncertainty principle here that I think the entropy framework makes precise.

A system with slow decay (low damping, high Q) produces a signal with narrow spectral bandwidth — you hear a clear pitch but lose temporal precision. A system with fast decay (high damping, low Q) produces a signal with broad bandwidth — you hear a sharp attack but lose pitch information. This is the acoustic uncertainty principle: Δt × Δf ≥ 1/(4π).

The entropy paper's contribution is showing that _identification_ has its own uncertainty structure. A lightly-damped system (like a bell) reveals itself slowly but completely — you need to listen for a long time, but eventually the modal structure is fully exposed. A heavily-damped system (like a thud on sand) reveals itself quickly but incompletely — you hear the attack and then it's gone, leaving less information about the source.

This means there's a trade-off between _how quickly_ a sound identifies itself and _how much_ it can tell you. Fast identification implies less information in the decay (fewer modes, broader damping). Rich identification implies slower revelation (many modes, differential damping rates).

Compositionally, this suggests a parameter space: **identification speed vs. identification depth.** A composition could navigate this space deliberately, moving between sounds that reveal themselves instantly (percussive, damped, broadband) and sounds that take their time (resonant, ringing, spectrally rich). The journey between these poles is the journey between the known and the knowable.

---

## Listening as Entropy Estimation

The deepest implication of the entropy paper for music is this: if sound identification works through entropy estimation of the decay, then **listening is an ongoing calculation of how much a sound has revealed about its source.**

We don't hear a sound and instantly know what it is. We hear an onset (uncertain, broadband, attention-grabbing), then track the decay (progressively more certain, more identified), until we reach a point where the sound has said enough — what the researchers call the optimal identification window.

This maps onto the phenomenology of listening more precisely than any purely spectral account. When you hear a sound in a new room, you don't know the room's acoustics from the first reflection — you need to hear the reverb tail develop. When you hear a new instrument, the first note tells you less than the first phrase. When a chord resolves, the resolution isn't in the new chord alone — it's in the way the old chord's resonance decays into the new one.

Musical form itself might be understood as a structure that manages the listener's entropy estimation across time: establishing sound sources (revealing their decay signatures), transforming them (changing the decay, changing the identity), and ultimately resolving into a final state where the informational question is answered.

---

## The Compositional Question

If the information in sound lives primarily in its decay, what does it mean to compose?

It means arranging not just pitches and rhythms but _decay regimes_. It means understanding that every acoustic space, every instrument, every synthesis parameter is a damping function that determines how sound reveals itself over time. It means recognizing that the most informationally dense moment of a musical event is not the downbeat but the seconds that follow.

The entropy paper provides a formal framework: Shannon entropy to measure how much has been revealed, KL-divergence to measure how far the revelation has progressed from ignorance. These could become compositional tools — not as literal calculations during composition, but as conceptual lenses for understanding what you're really doing when you shape a sound's sustain, when you tune a room's reverb, when you decide how long to let a chord ring before the next one arrives.

The compositional question isn't "what should the next note be?" It's "has the current sound finished telling me what it is?"

---

_Previous: [What We Measure Isn't What We Hear](what-we-measure.md) (Essay #83)_
_Thread: #80 → #81 → #82 → #83 → #84 — from resonant bodies to geometric duality to structural invariance to measurement gaps to the information in decay_
