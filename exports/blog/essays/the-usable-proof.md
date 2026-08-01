---
title: "The Usable Proof"
publishDate: 2026-07-08
excerpt: "Mathematical proof complexity reveals a compositional principle: musical structures only matter to listeners when there is usable evidence of them, not merely when they exist."
category: "interdisciplinary"
tags:
  - "perception"
  - "composition"
  - "information-theory"
  - "signal-processing"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## In Principle Is Not Enough

A recent extraction on zero-knowledge proofs introduces a useful distinction for listening systems: some things may be true in principle but unavailable in practice. A mathematical statement can be provable only by a proof too long to write down. A vulnerability can exist but be impossible to prove, which makes it operationally indistinguishable from no vulnerability at all.

That sounds distant from audio until it is placed beside the current batch of machine-listening extractions.

SR-CorrNet argues that late speaker disentanglement creates a bottleneck. The speakers are physically present in the mixture from the beginning, but if the architecture waits too long to separate them, the usable evidence of identity may be weakened or lost. FSD50K-Solo makes the dataset version of the same claim: a sound event may have one dominant source in the world, but the training system cannot use that fact unless the corpus can certify it as single-source. Anomalous sound detection makes the evaluation version visible: a machine may be the source of a sound, but if the test protocol withholds machine identity, the model's idea of "normal" becomes unstable.

Together they point to a clean rule:

**A structure only matters to a listening system when there is a usable proof of it.**

Not a formal proof in the mathematical sense. A usable proof can be a spatial cue, a stable F0 contour, a correlation pattern, a curated label, an early attack transient, or a memory trace. It is whatever evidence lets a listener or model act as if the structure is real.

---

## Sourcehood Needs Evidence

Source identity is an especially good test case because the source can be real while still failing to become operational.

Two speakers may be present in a mixture. That is a physical fact. But the separator needs enough spatio-spectro-temporal correlation to assign energy to the right stream. Without that evidence, the truth of "speaker A is here" is not useful. It remains true but unactionable.

A dataset may contain many isolated events. But unless the curation process can distinguish single-source recordings from multi-source interference, the label "single source" is not a usable training condition. The class name arrives without proof.

A machine may have a characteristic acoustic signature. But anomaly detection depends on knowing what counts as normal for that machine. Remove the identity label, and the detector must either infer it implicitly or treat the sound as a floating deviation without a reference body.

This is where the proof-complexity analogy becomes compositionally fertile. Music is full of structures that are present but not yet usable: a hidden tonic, a submerged pulse, an instrument masked by another, a spectral relation that only becomes obvious after several repetitions. The question is not simply whether the structure exists. The question is how long, how loud, how redundant, or how contextually supported it must be before the listener can use it.

---

## A Compositional Use

Write a piece in which every important structure has two states: true and usable.

Start with a real but unproved identity. For example, let one source control several events, but distribute its cues across different parameters: its attack appears in one register, its resonance in another, its spatial position on a third layer. The source is genuinely coherent in the compositional system, but the listener cannot prove it yet.

Then gradually shorten the proof. Align attack and resonance. Repeat a contour. Let the spatial cue arrive earlier. Remove masking. At some point the listener begins to hear the scattered events as one agent. Nothing ontological changed in the score. What changed was the availability of evidence.

The reverse is just as useful. Establish a source clearly, then make its proof too expensive. Keep one cue, scramble another, bury the third. The source may still be present by rule, but the listener loses the ability to act on that knowledge. This creates a musical analogue of effective unprovability: a structure that exists inside the system but no longer functions for perception.

This gives composers a practical control surface:

- **Proof length:** how much time is required before a structure becomes clear.
- **Proof redundancy:** how many independent cues support the same inference.
- **Proof locality:** whether evidence appears near the event or only later.
- **Proof fragility:** how easily masking, reverberation, or transformation breaks the inference.

These are not metaphors pasted onto sound. They describe ordinary listening. A rhythm becomes meter when its evidence is strong enough. A timbre becomes a source when its cues cohere. A room becomes space when reflections support a stable geometry.

---

## The Musical Claim

The zero-knowledge extraction says that practical knowability can matter as much as truth. The audio extractions say the same thing in another language. Speaker identity, single-source labels, and anomaly baselines are not useful merely because they exist. They are useful when a system has enough evidence to rely on them.

For music, this suggests a disciplined way to compose with ambiguity. Do not ask only, "Is the structure there?" Ask, "What would count as proof for this listener, in this texture, at this moment?"

The answer may be a note, a room reflection, a repeated contour, a label, a pause, or a delay before commitment. That is the beautiful practical edge: proof in music is not a theorem. It is an experience becoming reliable enough to use.

---

_Sources: recent extractions on effective zero knowledge and proof complexity (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), anomalous sound detection without reliable machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), and infant cry feature fusion/domain shift (`j9735j1x9c8dxr97dax746vccd86q4tz`)._

_Connections: usable proof, effective unprovability, source identity, single-source curation, anomaly baselines, source evidence, proof length, perceptual reliability._
