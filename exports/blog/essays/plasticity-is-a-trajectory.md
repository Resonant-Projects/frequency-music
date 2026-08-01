---
title: "Plasticity Is a Trajectory"
publishDate: 2026-07-14
excerpt: "Plasticity becomes compositional when a sonic gesture is treated as a trajectory: some sounds are fixed anchors, while others remain learnable and steerable across developmental time."
category: "interdisciplinary"
tags:
  - "composition"
  - "AI-music"
  - "signal-processing"
  - "perception"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The newest extraction adds a useful word to the project's vocabulary:
plasticity. Not plasticity as vague flexibility, but plasticity as a measurable
trajectory: how far a vocal gesture would move if it were produced at another
developmental age.

The birdsong paper proposes "trajectory variance" for zebra finch vocalizations.
A displacement model predicts age-conditioned shifts in an autoencoder latent
space, then scores each vocalization by the variance of those predicted shifts
across target ages. In plain musical terms, the method asks: if this sound were
made earlier or later in the life of the singer, how much would it have to
change?

That question is more compositional than it first looks. A note is usually
treated as an event with properties: pitch, duration, loudness, timbre,
articulation. A developing vocalization asks for another property: developmental
mobility. Some gestures are comparatively fixed; others are still capable of
moving. The paper reports that this score modestly separates learned song
syllables from innate calls in three zebra finches, and that higher plasticity
correlates with lower spectral flatness. More plastic vocalizations tend to be
more tonal and spectrally structured.

That last result is the small hinge. Spectral flatness is often heard as a
noise-to-tone axis. Here it also becomes a clue about learnability. The more
tonal object is not merely cleaner or more pitch-like; it may be the object that
development can grab. A structured spectrum gives the learning system something
to steer.

This connects directly to the recent extraction cluster around task-specific
time and slow handles. Music-game generation exposes beat-shift tokens because
interactive events need beat-relative time. SPAM exposes phonological features
because vocal timbre needs articulatory time. ReGen exposes low-rate latents
because generation decisions can live slower than the waveform. Trajectory
variance adds another clock: developmental time. It does not ask where the sound
is in the bar, or which phonological feature is active now. It asks how the
gesture would deform across a life of learning.

For composition, that suggests a practical control lane: automate plasticity,
not only parameters. Imagine a vocal or instrumental model where each gesture
has a "developmental variance" value. Low-plasticity material behaves like an
innate call: stable, repeated, resistant to transformation. High-plasticity
material behaves like a learned syllable: tonal, steerable, capable of taking on
new contours while remaining recognizable. A piece could move from call-like
fixity to song-like learnability without simply increasing complexity or adding
ornament.

The design test is crisp. If a representation claims to expose musical control,
ask whether it can say which gestures are worth changing. Not every sound should
be equally mutable. Some sounds are anchors. Some are probes. Some are still
learning their own shape.

This also sharpens the sourcehood thread running through the recent essays. A
source is not just something separable from a mixture; it is something with a
history of possible transformations. Two sounds may be similar at one moment but
different in plasticity: one is a fixed identity, the other is a trajectory
waiting to unfold. That difference matters for musicians because composition is
often less about choosing the present sound than choosing what kinds of change
the present sound is allowed to undergo.

The useful concept, then, is **trajectory plasticity**: the degree to which a
sonic gesture remains itself while moving through an imposed developmental,
performative, or formal timeline. It belongs beside beat-relative time,
phonological feature time, and low-rate latent control. Each names a different
axis where sound becomes playable.

_Sources: recent extraction on trajectory variance in birdsong
(`j97ckpqqxzkj19gbw70dkwhk218ahj6w`), plus the prior synthesis around
task-specific time (`task-specific-time`) and handle rates (`the-rate-of-handles`)._
