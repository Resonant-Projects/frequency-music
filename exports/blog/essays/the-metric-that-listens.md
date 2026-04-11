---
title: "The Metric That Listens"
publishDate: 2026-04-03
excerpt: "Metrics fail because they measure absolute values, but perception works through relationships across timescales. The best expressiveness measures learn these multi-scale relational patterns—explaining why musicians were right about tempo variation and why click tracks miss the music."
category: "perception"
tags:
  - "perception"
  - "rhythm"
  - "signal-processing"
  - "psychoacoustics"
  - "mathematical-music-theory"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

## The Question From Last Time

Essay #89 showed that perceptual dimensions are entangled — pitch, timbre, rhythm, and identity share acoustic substrate in ways that resist clean separation. But entanglement is a statement about signals. What about the *tools we use to evaluate them*?

If the dimensions are tangled, then metrics built on those dimensions should fail. And they do — spectacularly.

---

## The Musicians Were Right (But Couldn't Prove It)

When the click track arrived in recording studios, musicians pushed back. "It's unnatural," they said. "Speeding up and slowing down gives the music a better feel." Producers and engineers mostly overruled them. The click won because it solved a production problem: consistent tempo makes editing, overdubbing, and synchronization trivially easier.

The musicians weren't wrong. They were making an empirical claim about expressiveness — that *tempo variation itself carries musical information* — but they lacked a metric to prove it. The best they could offer was "feel," which doesn't survive a budget meeting.

This isn't just a historical anecdote. It's the founding case of a pattern that keeps repeating: practitioners know something matters, but the available measurements can't capture it.

---

## The Prosody Gap

Decades later, the same pattern appears in speech synthesis. Researchers building text-to-speech systems needed to evaluate whether their systems sounded "natural" — specifically, whether they produced appropriate *prosodic variation* (the speech analogue of musical expressiveness: pitch contour, timing, emphasis, rhythm).

The standard approach: compute acoustic features (F0 mean, variance, energy envelope, duration statistics) and correlate them with human ratings. It should work. These features are what prosody *is*, physically. The voice goes up, gets louder, stretches certain syllables.

It doesn't work. DS-WED (Discretized Speech Weighted Edit Distance), a 2026 study, built a proper evaluation dataset — 1000 speech samples, 7 TTS systems, 2000 human ratings — and showed that conventional acoustic metrics *correlate poorly with human perception of prosodic variation*. The features that define prosody acoustically don't predict whether humans hear the speech as expressively varied.

What works instead? Weighted edit distance over *semantic tokens* — discrete representations learned by self-supervised models like HuBERT and WavLM. Not pitch. Not energy. Not duration. A distance metric computed in a learned latent space that nobody can fully interpret.

The implication is uncomfortable: the best measure of expressiveness is *not a function of the acoustic features that constitute expression*. It's a function of something else — something the self-supervised models learned to encode but that we can't name in traditional acoustic vocabulary.

---

## Why Absolute Metrics Fail

A parallel finding from speech extraction research illuminates why. When trying to identify a target speaker in a multi-speaker mixture, researchers compared two strategies:

1. **Absolute cues**: describe the target speaker's voice in categorical terms (male/female, high/low pitch, loud/quiet)
2. **Relative cues**: describe the target *in comparison to other speakers present* (louder than the other, closer, spoke first)

For continuous-valued attributes — loudness, distance, temporal position — relative cues dramatically outperformed absolute ones. Some relative cues even beat having an enrollment audio sample (a recording of the actual target speaker).

This is a deep finding about perception itself. Continuous acoustic attributes aren't heard as absolute values; they're heard as *relationships*. A voice isn't "loud" — it's "louder than the other voices." A note isn't "high" — it's "higher than what came before." A tempo isn't "fast" — it's "faster than the previous section."

Metrics that compute absolute values (mean F0, global tempo, average energy) are measuring things that perception doesn't directly access. Perception works in the *differences*. The musicians resisting click tracks sensed this: what matters isn't the tempo at any moment, but the *change* in tempo, the *relationship* between where the beat is and where the listener expects it to be.

---

## The Timescale Hierarchy

A study of self-supervised speech models (Wav2Vec2 and HuBERT) adds another layer. These models develop internal representations of linguistic structure during training, and the researchers found that *the timescale at which information is integrated determines which layer encodes it*.

Short-timescale features (phonemes, individual sounds) live in early layers. Long-timescale features (prosody, sentence structure) live in later layers. The abstraction hierarchy mirrors the temporal hierarchy.

This means that measuring expression at a single timescale is structurally doomed. Musical expression isn't a property of any one temporal level — it's a property of the *relationships between levels*. The rubato that makes a phrase breathe is a long-timescale feature (phrase shaping) that manifests through short-timescale events (note onsets). An acoustic metric that captures note onset timing won't see the phrase shape. A metric that captures phrase-level tempo won't see the micro-timing. You need both, and you need their interaction.

The self-supervised models solve this implicitly: their layered architecture naturally integrates across timescales. That's why their learned tokens correlate with human perception when acoustic features don't. They've built the multi-timescale integration that no single acoustic metric can.

---

## The Metric That Listens

There's a pattern in all of this:

| What fails | What works | Why |
|---|---|---|
| Global tempo | Targeted micro-timing (#88) | Perception is local and temporal |
| Absolute acoustic features | Relative comparisons | Perception is relational |
| Single-scale metrics | Multi-scale learned representations | Expression spans timescales |
| Named dimensions | Entangled latent spaces (#89) | Perceptual dimensions aren't acoustic dimensions |

The metrics that work are the ones that *listen the way humans listen*: relationally, across timescales, in entangled dimensions. They don't decompose the signal into components and measure each one. They compare whole patterns to other whole patterns, allowing the relevant features to emerge from the comparison rather than being specified in advance.

This is why "feel" resists formalization. It's not that feel is subjective or mystical. It's that feel is a *multi-scale relational property* — a function of how timing relates to pitch relates to timbre relates to what happened two bars ago. Any metric that collapses this to a single number or a small set of acoustic features will fail, not because the metric is imprecise, but because it's *structurally incapable* of representing what it's trying to measure.

---

## The Compositional Consequence

If expression lives in relationships rather than absolute values, then composing for expressiveness means composing *relationships*:

1. **Don't specify tempo; specify tempo trajectories.** A phrase doesn't need to be "at 120 BPM" — it needs to *arrive at* a tempo from somewhere and *depart* toward somewhere else. The trajectory is the expression; the instantaneous value is just a coordinate.

2. **Don't balance loudness; balance loudness contrasts.** If a melody needs to be heard, don't make it louder — make it *change differently* from the accompaniment. (This connects to #89's insight about orthogonality: separability through different *directions* of change, not through magnitude.)

3. **Design for the edit distance, not the feature.** If the best expressiveness metric is edit distance over learned tokens — i.e., how *different* each rendition is from others — then expressiveness is variation itself. A system that produces the same prosodic contour every time is inexpressive even if that contour is "objectively correct." The goal is a space of plausible renditions, not a single ideal one.

4. **Trust what the musicians always knew.** The click track resistance wasn't anti-technology sentiment. It was a correct intuition that tempo variation carries information — information that no available metric could quantify, but that every listener could hear. The new metrics are finally catching up to what performers' bodies have always known.

---

## The Arc

This essay continues a sequence:

- **#86**: Musical geometry exists in transport paths
- **#87**: Perception discretizes the continuous
- **#88**: The covert timing that shapes perception
- **#89**: Perceptual dimensions are entangled
- **#90**: Measurement must match perception's structure — relational, multi-scale, entangled — or it fails

The thread is tightening: perception doesn't decompose signals the way physics does. It doesn't measure absolute values. It doesn't operate at a single timescale. It doesn't respect our named dimensions. Any tool, theory, or composition that assumes otherwise will miss what listeners actually hear.

Next question: if perception is relational and multi-scale, what is the *smallest unit of musical perception*? Not a note, not a beat — but the minimal pattern that the auditory system treats as a "thing." Essay #87 started this with discretization; it's time to go deeper into what gets discretized and why.
