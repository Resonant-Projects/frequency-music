---
title: "The Source Is a Verdict"
publishDate: 2026-05-30
excerpt: "A source verdict is the moment a system—dataset, neural network, room, or listener—decides acoustic evidence belongs to one cause. This reframes orchestration around who gets to define what counts as a single source."
category: "interdisciplinary"
tags:
  - "perception"
  - "signal-processing"
  - "composition"
  - "AI-music"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

Several recent extractions circle the same practical fiction: the clean source.

FSD50K-Solo makes the fiction explicit. The dataset is valuable because it tries to separate single-source events from messy recordings where background interference or overlapping events confuse the label. The work is framed as curation, but it is also a theory of listening. A sound becomes usable when a classifier can say, with enough confidence, that this event is one thing rather than several things at once.

SR-CorrNet approaches the same problem from inside the mixture. Instead of treating separation as a late reconstruction step, it tries to disentangle speakers early, using spatio-spectro-temporal correlations as evidence for filters that recover target signals. Here the source is not given by the waveform. It is inferred from correlation structure: which pieces of energy behave as if they belong together across time, frequency, and space?

Room impulse response generation complicates the story further. A room turns every source into a distributed event. Direct sound, early reflections, and decay are all consequences of one excitation, but the listener receives them as a cloud of arrivals. The room says: a source is not only where the sound began; it is also how the environment keeps answering after the beginning has passed.

The unconscious-auditory-perception extraction adds a human limit case. If auditory processing can persist below conscious awareness, then source formation is not identical to explicit recognition. Some layers of the nervous system may keep sorting, adapting, or learning before the listener can name what is being heard. The verdict can begin before it becomes conscious.

That suggests a compositional concept: **source verdict**.

A source verdict is the moment a system treats acoustic evidence as belonging to one cause. The system might be a dataset curator, a neural separator, a room, a performer, or a listener. The verdict can be strong or weak, early or late, conscious or unconscious, correct or musically useful despite being wrong.

This reframes orchestration. Instead of asking only "what sources are present?", a composer can ask:

- which layer is allowed to decide that a source exists?
- how much evidence does it need?
- does the room support the verdict or blur it?
- does the listener's body decide before analysis catches up?
- can two systems disagree about whether the same sound is one source or many?

The practical payoff is rich. A piece could begin with events that a machine separator treats as distinct but a human listener hears as one texture. It could introduce a reverberant space that makes a single instrument behave like a crowd. It could train a classifier on artificially clean events, then place those events into mixtures that deliberately break the classifier's confidence. It could let the body follow a source contour while the conscious ear remains unsure what caused it.

The clean source is useful, but it is not innocent. It is a thresholded interpretation of acoustic evidence.

So the compositional question becomes:

**who gets to decide when a sound has become one thing?**

_Sources: recent extractions on FSD50K-Solo single-source audio curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`), and unconscious auditory perception (`j974gtwmrad9zxbdz7787858m586pwp7`)._
