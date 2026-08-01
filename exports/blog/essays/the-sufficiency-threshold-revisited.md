---
title: "The Sufficiency Threshold Revisited"
publishDate: 2026-06-20
excerpt: "Music and machine listening both grapple with a core question: when has a system heard enough to act?"
category: "interdisciplinary"
tags:
  - "perception"
  - "AI-music"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

Recent extractions keep circling a quiet but powerful question: when has a listening system heard enough?

That question appears first as dataset hygiene. FSD50K-Solo treats single-source audio as a prerequisite for strong supervision. The point is not merely that clean examples are pleasant. A single-source event gives the model a stable object to learn from. If the recording contains several unresolved causes, the label begins to lie by compression: one name is asked to cover a mixture whose internal boundaries remain undecided.

SR-CorrNet asks the same question inside the separator. Its critique of late-split speech architectures is that speaker identity should not be postponed until after the representation has already compressed the evidence. Spatio-spectro-temporal correlations are useful because they still carry the relations by which sources can be distinguished: common movement, spatial consistency, spectral continuity, and temporal co-occurrence. The system has heard enough not when the whole scene is finished, but when the evidence still contains the shape of separability.

The streaming SpeechLLM extraction makes the threshold explicit. A live translation model must decide when partial audio justifies action. It cannot wait for the full utterance without losing the value of streaming, but it cannot commit too early without damaging alignment. Translation quality therefore depends on a learned sufficiency function: the model emits when the local evidence is strong enough to bear the cost of commitment.

Together, the three sources suggest that audio intelligence is often governed less by recognition than by sufficiency. Recognition asks, "What is this?" Sufficiency asks, "Is there enough here to act as if this is what it is?"

## The Musical Version

Music has the same threshold problem, but we usually hide it under more familiar names: onset clarity, tonal confirmation, metric induction, timbral identity, phrase closure, cadence, entrance, arrival.

A listener does not receive a finished structure all at once. The structure becomes actionable over time. A pulse becomes meter when enough periodic evidence accumulates. A pitch becomes a root when enough harmonic context gathers around it. A texture becomes a voice when its partials, attacks, register, or location cohere long enough to survive the surrounding mixture.

This gives composers a precise control surface: delay, advance, strengthen, or weaken the moment of enough.

At a low sufficiency threshold, the music commits early. A source is identifiable at attack. A tonal center is named quickly. A rhythm establishes its grid before ambiguity can spread. This gives the listener handles: agents, functions, directions.

At a high sufficiency threshold, the music withholds commitment. A sound may be one instrument, several instruments, a room response, or an electronic shadow. A pulse may be present before the downbeat is knowable. A harmony may imply several centers before one becomes locally cheapest. The listener is not confused in a vague sense; the listener is being held before a decision boundary.

## Composition as Commitment Design

The practical move is to treat sufficiency as a parameter alongside pitch, rhythm, dynamics, and timbre.

A sketch:

1. Present a clean source with redundant evidence: clear attack, stable spectrum, narrow spatial image, repeated gesture.
2. Remove one cue while keeping the others intact.
3. Let several sources share one cue, such as rhythm or register, while diverging in another.
4. Delay the decisive cue until after the listener has formed competing hypotheses.
5. Confirm one hypothesis just late enough that the confirmation feels like form, not cleanup.

This is closely related to sourcehood, but it is not identical. Sourcehood asks what kind of object a sound is allowed to become. Sufficiency asks when the system has the right to treat it that way.

That distinction matters for machine listening too. A classifier trained on single-source examples, a separator that splits early, and a translator that emits with low latency are all building different versions of the same threshold. They decide how much evidence must remain before action becomes legitimate.

For a compositional tool, this suggests controls such as:

- source sufficiency: how many cues must agree before an event becomes one source;
- metric sufficiency: how many periodic confirmations are needed before a pulse becomes a grid;
- harmonic sufficiency: how much spectral or interval evidence is required before a center is named;
- latency cost: how expensive it is to wait for more context;
- commitment cost: how expensive it is to act on evidence that may later be contradicted.

The useful tension is that waiting preserves accuracy but spends time. Acting preserves liveness but risks false structure. Music lives inside that trade.

## The Threshold Is the Form

The strongest connection across these sources is that the threshold is not an implementation detail. It shapes the object being perceived.

If a dataset admits only clean single-source events, it teaches the model a world of separable objects. If an architecture separates early, it preserves identity as a first-class feature. If a streaming model emits after one second instead of four, it changes the social and musical character of the interaction. In each case, the decision about when evidence is enough becomes part of the system's ontology.

Composition can use this directly. A piece can begin with low-threshold listening, where every gesture is immediately attributable, then move toward high-threshold listening, where agency becomes delayed, plural, or only partially recoverable. Or it can do the reverse: begin as an undecided field and slowly lower the threshold until sources, meter, and harmony become actionable.

The question is not only what the listener hears.

It is when the listener is allowed to know what hearing has become.

---

_Sources: recent extractions on FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._

_Connections: [The Early Separation Principle](the-early-separation-principle.md), [The Sourcehood Contract](the-sourcehood-contract.md), [The Moment Of Enough](the-moment-of-enough.md), [The Latency Contract](the-latency-contract.md)._
