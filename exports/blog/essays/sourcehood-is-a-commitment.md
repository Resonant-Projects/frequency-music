---
title: "Sourcehood Is A Commitment"
publishDate: 2026-06-23
excerpt: "Sourcehood is not a waveform fact but a commitment: when does a listener, model, or performer treat a sound as stable enough to act on? Composition can choreograph this timing as a structural force."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "perception"
  - "acoustics"
  - "AI-music"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The latest extraction batch keeps circling the same problem from three directions: when does a sound become one thing?

That sounds like an ontological question, but the papers make it operational. A source is not simply something that exists in the waveform. It is something a listener, dataset, model, or performer is willing to treat as stable enough to act on.

Sourcehood is a commitment.

## The Early Split

SR-CorrNet makes the point architecturally. Its critique of late-split speech separation is that speaker identity loses force when the model waits until the final stage to disentangle sources. By then, the discriminating correlations have already passed through too many transformations. The system has to commit earlier, while spatio-spectro-temporal evidence is still rich enough to guide filtering.

That is a useful compositional idea. In a dense texture, the question is not only whether two voices are formally distinct. The question is where the piece asks the ear to split them. A composer can put source commitment near the attack, after a repeated contour, at a registral divergence, or almost never. Each choice changes whether the texture feels like counterpoint, fusion, noise, or mass.

## The Clean Example

FSD50K-Solo turns sourcehood into curation. The dataset problem is not merely that labels are missing. It is that many labeled clips contain multiple overlapping events, so the label pretends to name one source while the signal behaves like several. The proposed solution synthesizes clean single-class events and controlled mixtures, then trains a classifier to decide which real clips function as single-source examples.

That makes the fiction visible. "Single source" is not a natural fact handed to the dataset. It is a thresholded decision under interference.

Musically, this matters because composers often use the same fiction. A violin section is many bodies but one orchestral source. A distorted guitar chord is six strings, pickups, amplifier, room, and recording chain, yet it can behave as one object. A granular cloud may contain thousands of events but ask to be heard as one surface. Conversely, one sung note can split into pitch, breath, consonant, room, and bodily strain.

Sourcehood depends on the listening task.

## The Latency Window

The streaming SpeechLLM extraction adds time pressure. The model cannot wait for a complete utterance before translating. It must decide when partial context is enough. Too early, and it commits to the wrong phrase. Too late, and the interaction breaks.

That is exactly the performer's version of sourcehood. A player in an ensemble cannot wait until the whole gesture is complete before deciding whether another sound is a cue, a mistake, a doubling, a response, or background. The decision has to be good enough inside the action window.

The more interesting musical question is not "how many sources are there?" but "when does the piece force a source decision?"

## Compositional Use

Write one material stream that can plausibly be heard as one source or many: breathy bowed noise, close canonic voices, detuned oscillators, filtered crowd sound, overlapping field recordings, or a chord whose partials move independently.

Then make three versions.

In the first, commit early. Give the listener clean onset cues, stable spatial positions, or sharply differentiated registers. Let the sources separate before the texture thickens.

In the second, delay commitment. Begin fused, then let repetition, motion, or spatial drift gradually reveal separate agencies. The discovery should feel like the ear learning the grammar of the mixture.

In the third, make commitment unstable. Let the same material flip between one body and many. A unison becomes a cluster; a cluster locks into a single timbre; a room tone starts acting like an instrument; an instrument dissolves into the room.

This is not just orchestration. It is source choreography.

## Why It Matters

The three recent extractions are technical, but together they point at a basic musical control surface. SR-CorrNet says source identity has to be separated while the evidence is still usable. FSD50K-Solo says clean sourcehood is often a curated fiction. Streaming SpeechLLM says action requires commitment before the evidence is complete.

For composition, that suggests a practical rule:

Do not only decide what the sources are. Decide when the listener has to believe in them.

That timing can be as structurally important as pitch, rhythm, or harmony. A source that arrives too clearly becomes an object. A source that arrives too late becomes atmosphere. A source that never quite arrives becomes ambiguity. A source that appears, dissolves, and reappears becomes form.

The waveform contains possibilities. The piece decides which ones become actors.

---

_Sources: SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
