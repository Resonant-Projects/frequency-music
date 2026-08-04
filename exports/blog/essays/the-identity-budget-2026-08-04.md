---
title: "The Identity Budget"
publishDate: 2026-08-04
excerpt: "Sound identity depends on temporal resolution, latent capacity, model guidance, and acoustic boundaries."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "acoustics"
  - "perception"
  - "signal-processing"
  - "information-theory"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

Three recent extractions are all circling the same practical question: how much information does a sound system need to preserve before a listener stops hearing the same thing?

The Locodec extraction frames this as a token-design problem. A representation can be short enough to model stably, but if it is too compressed it loses the acoustic details that make reconstruction convincing. A representation can be rich enough to preserve those details, but if it is too temporally dense or statistically unruly it becomes fragile under autoregressive generation. The paper's proposed compromise, 8 Hz continuous tokens with 768 dimensions, is striking because it treats time and capacity as separable budgets. The system spends less on frame rate and more on latent bandwidth.

The diffusion-separation extraction puts the same problem in the domain of source identity. An unconditional model can reproduce local acoustic structure, but without speaker-level conditioning it may let identity drift over time. Here the missing budget is not bandwidth in the ordinary signal-processing sense. It is continuity of cause. Speaker-embedding guidance supplies a running constraint: keep this separated stream near itself and away from the other speaker. The separated voice is not just a sequence of plausible speech fragments; it is a maintained identity.

The room-acoustics extraction makes the same tension physical. Rectangular rooms with rigid walls permit clean modal descriptions, but real boundaries absorb, soften, and perturb the spectral basis. A Green's function is a map of how a source becomes itself-at-a-receiver after the room has spent, delayed, and redistributed its energy. Soft-wall asymptotics matter because the boundary is not a neutral container. It participates in identity by deciding which modal traces survive.

Together, these sources suggest an "identity budget" for sound:

- **Temporal budget:** how often the representation or listener gets a fresh commitment about what the sound is.
- **Latent budget:** how much hidden structure is carried between commitments.
- **Guidance budget:** how strongly a model is constrained to keep a source coherent across time.
- **Boundary budget:** how much the medium is allowed to alter the source before recognition fails.

That is compositionally useful. A composer can treat identity as a controllable resource rather than a binary property. At one extreme, keep the temporal budget high, the latent structure rich, the guidance strong, and the boundary rigid: the result is stable sourcehood, like a solo voice in a dry close microphone. At the other, lower the frame rate, weaken the identity prior, and pass the sound through absorptive or dispersive virtual rooms: the result is not merely degraded audio, but a progressive loosening of cause.

The interesting middle ground is where identity almost holds. A vocal line could be encoded into slow latent pulses, diffusion-separated with intentionally underpowered speaker guidance, then convolved through rooms whose boundary conditions selectively blur modal evidence. The listener would hear a voice becoming a place, or a room inheriting a voice's memory. This is different from ordinary reverb or granular smearing because the transformation is organized around what must be preserved for recognition.

There is also a useful warning for tool-building. Audio interfaces often optimize fidelity, separation quality, or acoustic simulation as independent metrics. These extractions imply a cross-cutting metric: does the system preserve the identity needed for the musical task? For speech generation, that may mean intelligibility and long-horizon stability. For separation, it may mean speaker coherence. For room simulation, it may mean source-location-dependent coloration that remains legible rather than washing into generic ambience.

The deeper pattern is that sound identity is not stored in one place. It is distributed across representation geometry, temporal update rate, model guidance, and physical boundary conditions. Every audio tool spends that budget whether it admits it or not. The compositional opportunity is to spend it deliberately.

_Sources: recent extractions on low-frame-rate high-dimensional continuous audio tokens (`j978xyn771qzqjyj5t3c3q2ah18brza7`), diffusion speech separation with speaker-embedding guidance (`j9767ctn6p5h3q8c3tgx5bb9358bsmdj`), and acoustic Green's functions for rectangular rooms with general surface impedance (`j975pan3tdjxjht7d2h52pgzqd8brgqc`). Connections to: audio tokenization, speaker identity coherence, representation-space geometry, room modes, surface impedance, boundary conditions, source separation, and compositional identity._
