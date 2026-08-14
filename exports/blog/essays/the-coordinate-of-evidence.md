---
title: "The Coordinate Of Evidence"
publishDate: 2026-08-14
excerpt: "Across scales, deepfake detection, spatial audio, and pitch design, the key question is where musical evidence lives—and how exposing that coordinate makes it composable."
category: "interdisciplinary"
tags:
  - "perception"
  - "AI-music"
  - "acoustics"
  - "signal-processing"
  - "composition"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

The recent extraction candidates keep changing domains, but not questions. A scale-evolution paper asks whether global scale structure is better explained by melody than harmony. Echoes asks how a music-deepfake detector can be prevented from winning by shallow shortcuts. SARL asks which spatial facts survive inside pretrained audio encoders. The pitch-strength source asks whether studio musicians need a lower-level control than text labels for how strongly pitch is present.

The shared question is this:

**where is the evidence allowed to live?**

In the scale-evolution source, the answer is local motion. Across 1,314 scales from 96 countries, the reported near-universal preference for 1-3 semitone steps suggests that pitch organization is carried first by adjacency, singability, memory, and melodic reachability. Harmony still leaves a trace, especially in music-theoretic scales, but performance-measured scales appear less governed by clean fourths, fifths, and octaves than older theory would predict [S1].

That matters because harmony and melody are not merely two explanations. They are two coordinates. A harmonic coordinate looks for privileged vertical ratios. A melodic coordinate looks for the cost of getting from one pitch to the next. If the wrong coordinate is chosen, the analysis can still sound sophisticated while missing the practical engine of the music.

Echoes makes the same move in evaluation. A detector trained to identify AI-generated music can cheat if generated and bona-fide examples differ in genre, arrangement, descriptor, or production context. The dataset's semantic alignment tries to remove that route by conditioning generated tracks on bona-fide waveforms or song descriptors. The intended evidence is not "this sounds like a different kind of song." It is whatever remains when real and generated music are forced to mean similar things [S2].

SARL turns the problem into space. Pretrained encoders may preserve source-level factors such as azimuth, elevation, distance, and class better than room-level factors such as RT60, volume, and shape [S3]. A representation can therefore seem spatially aware while mostly tracking the object rather than the acoustic environment. Source position and room behavior are different coordinates of spatial evidence. A tool that confuses them will give composers a thin kind of space: point placement without room agency.

Pitch strength brings the idea back to production. A text prompt such as "warm bass" or "clear lead" is too far above the workbench. Pitch strength names a lower-level perceptual coordinate: how strongly a sound behaves as pitched, how that strength varies inside and across songs, and how upper harmonics may become audible enough to affect structure and dissonance [S4]. It does not replace note choice. It gives the note another dimension of authority.

Together, these sources suggest a compositional rule:

**Every musical tool becomes expressive when it exposes the coordinate where evidence is doing the work.**

For scales, expose local step cost, not only interval inventory. For authenticity detection, remove semantic shortcuts so timbral and generative traces have to carry the decision. For spatial audio, separate source location from room signature. For generative production, expose pitch strength rather than hiding it behind adjectives.

This also suggests a small instrument design. Build a phrase engine with four linked lanes:

1. **Melodic evidence:** constrain the next pitch by local step cost.
2. **Semantic evidence:** keep descriptor or style fixed while changing generation process.
3. **Spatial evidence:** automate source coordinate separately from room coordinate.
4. **Pitch-authority evidence:** move salience between fundamental, upper partials, and noisy texture.

The same nominal phrase could then be played four ways. First it becomes scalar because nearby steps are cheap. Then it becomes a fair comparison because semantic content is held still. Then it becomes spatially legible because source motion and room decay separate. Finally it becomes timbrally alive because pitch authority moves inside the spectrum.

That is the connection worth keeping. Music theory often asks what a sound is: a note, a chord, a source, a room, a real track, a generated one. These extractions suggest the more useful operational question:

**which coordinate is carrying the proof?**

Once that coordinate is visible, it can be composed.

---

## Sources

[S1] "Evolutionary modelling reveals melodic and harmonic constraints on global scale structure" (`jx73m5jnqvmev3hpxmv0bb7wg58apbcx`, extraction `j97ed8sbvnndbsxqxm0p6k4vkn8ap7jh`).

[S2] "Echoes: A semantically-aligned music deepfake detection dataset" (`jx70gt5y82b5vn6d8qvntgm8358apqn3`, extraction `j971f5dxbtd4xkjge9gcj6y3p18aqmfv`).

[S3] "Probing Spatial Structure in Pretrained Audio Representations" (`jx71f05fwzsyktvpxssnaewkfh8apjm9`, extraction `j971crpns779mes78xt6s6794s8aq2d3`).

[S4] "An introduction to pitch strength in contemporary popular music analysis and production" (`jx74rd69jq2dch62gtx95nwx9h8akvm9`, extraction `j978yxjgnckm2px83ae5dqwgq18ajxwm`).
