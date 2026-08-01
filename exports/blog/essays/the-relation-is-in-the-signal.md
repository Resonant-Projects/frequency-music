---
title: "The Relation Is in the Signal"
publishDate: 2026-06-15
excerpt: "Relation—the interaction between voices, sources, or speakers—is encoded directly in the audio signal, not metadata applied afterward."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "perception"
  - "information-theory"
  - "acoustics"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Pattern

Several fresh sources point at the same quiet reversal: audio systems are getting better when they stop treating relation as metadata.

Speaker labels, turn boundaries, source trajectories, prosodic style, and conversational adaptation are often handled as things outside the sound: annotations applied after capture, controls wrapped around the model, or labels supplied at evaluation time. The recent extraction queue suggests the opposite. In realistic listening, relation is already inside the signal. The task is not to attach it later. The task is to preserve enough evidence for it to remain recoverable.

That is a technical claim, but it is also a compositional one.

## Pairing Is a Structure

The dyadic interaction source is especially direct. Its Dyadic Distance Matrix encodes pairwise similarities between turns across an entire conversation, then uses a speaker-switch test to ask whether the representation captures genuine interaction or merely individual speaker traits. Replacing one speaker's turns with an unrelated speaker preserves local turn statistics while breaking the original coadaptation.

That control is elegant because it separates two things that often blur together:

- a speaker's own acoustic habits,
- and the relation formed between two speakers over time.

The relation is not reducible to either voice alone. It appears in the cross-pattern: timing, lexical mirroring, prosodic response, semantic uptake, and the long-range shape of adaptation.

Music has the same phenomenon. A duet is not two isolated monologues played at once. The relation between parts is audible in imitation, delay, register avoidance, dynamic yielding, and shared phrase endings. If one line is replaced by a statistically similar but non-responsive line, the surface may remain plausible while the musical relation collapses.

## Turn-Taking Is Not Just Silence Detection

The full-duplex speech model makes a parallel argument. Turn-based systems often rely on external voice activity detection to decide when the user has stopped speaking. BayLing-Duplex instead lets a single autoregressive model decide when to listen, when to speak, and when to stop, including overlap and interruption.

The important move is not simply lower latency. It is moving turn-taking into the same representational space as speech generation. Barge-in, hesitation, overlap, and response onset are not edge cases around conversation. They are part of conversation's signal.

For composition, this reframes counterpoint. Entry timing is not just a scheduling layer placed over notes. It carries social information: interruption, support, refusal, completion, anticipation. A canon, a call-and-response pattern, and a shouted overlap can share pitch material while expressing different relational physics.

## Prosody Wants Its Own Coordinates

The prosodic embedding source adds another axis. Self-supervised speech models often entangle prosody with linguistic and speaker information, which becomes fragile when prosody is the primary thing that must transfer across changing speakers or content. The proposed direction is to build global prosodic embeddings from pitch and energy models so prosody can be analyzed and reused more directly.

This matters musically because prosody is already halfway between speech and melody. Pitch contour, energy shape, stress, and timing form a gestural curve that can survive changes in words or timbre. A singer can preserve the emotional contour of a phrase while changing vowel, language, or register. A producer can move a vocal inflection into a synth line. A composer can extract the energy contour of speech and use it as orchestration.

But that only works if prosody is represented as something more specific than "everything left over after transcription."

## Localization and Separation Co-Produce Each Other

The moving-source separation source states the same principle physically. Sound source localization helps separation, and separation helps localization. The proposed iterative loop refines source trajectories and separated signals together, especially under reverberant conditions and moving sources.

This is a wonderfully concrete version of relation-in-the-signal. Position is not just a coordinate attached to an object after the fact. It changes what separation evidence is available. Separation is not just cleanup after localization. It changes the evidence from which location can be inferred.

In music production, spatial motion and timbral identity also co-produce each other. A moving sound is not merely the same object at changing coordinates. Doppler shift, reverb smear, level change, filtering, and masking alter the perceptual object. The room participates in the identity of the source.

## The Compositional Control

The shared lesson is that relation can be composed as a first-class parameter.

A piece can hold source identity stable while relation changes: the same instrument interrupts, shadows, contradicts, or merges with another line. It can hold relation stable while source identity changes: a call-and-response pattern migrates from voice to percussion to bowed string. It can deliberately break relation: one part mimics the surface features of dialogue without actually responding.

This suggests a useful tool shape for Resonant Projects: a relation layer that estimates interaction over time. Not just "who spoke" or "what pitch occurred," but:

- which streams adapt to each other,
- where turn-taking pressure accumulates,
- which gestures preserve prosodic contour across timbral change,
- and where localization and separation reinforce or contradict each other.

Such a tool would sit between source separation, score following, and orchestration analysis. It would show not only the objects in the sound field, but the evidence that they are listening to, following, resisting, or replacing each other.

## The Point

The newest audio papers are converging on a deeper fact: relation is measurable because relation leaves traces.

Conversation leaves traces in turn similarity and timing. Prosody leaves traces in pitch and energy trajectories. Moving sources leave traces in spatially structured mixtures. Musical interaction leaves traces in the same places: spectrum, time, energy, contour, room, and recurrence.

The compositional opportunity is to stop treating those traces as cleanup problems. They are material.

---

_Connections: dyadic interaction, speaker switching, full-duplex speech, target speaker tagging, prosodic embeddings, moving-source separation, source identity, counterpoint, orchestration, spatial audio._
