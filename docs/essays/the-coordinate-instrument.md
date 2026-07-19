# The Coordinate Instrument

The latest extraction cluster makes a simple compositional claim feel newly concrete: before a sound can be used, it has to be placed inside a coordinate system. That coordinate system is not neutral. It decides what counts as nearby, separable, stable, recoverable, meaningful, or playable.

SceneBind makes this explicit at the scene level. It tries to bind vision, audio, and language into a representation that carries object identity, spatial attributes, and uncertainty. The important detail is not just that sound can be localized. It is that localization becomes part of semantic understanding. A sound is not only a waveform or a class label. It is a possible object in a possible place, with uncertainty attached.

SARL shows the same problem from inside audio encoders. Pretrained representations appear to make source variables easier to decode than room variables: azimuth, elevation, and distance are more accessible than RT60, room volume, or room shape. That is musically suggestive because it says a model may hear the actor more clearly than the stage. The representation's coordinate system privileges some spatial facts and blurs others.

The moving-speaker tracking paper turns that bias into a control loop. A spatial filter enhances the speech signal; the enhanced signal feeds back into a Bayesian tracker; the tracker guides the next frame of filtering. Location is no longer a static annotation. It becomes an evolving estimate that steers the instrument as it plays. For composition, this is a strong idea: spatialization need not be a post-production parameter. It can be an autoregressive musical variable, revised by the sound it just produced.

The scale-evolution extraction gives a different coordinate system: melodic step size. Across 1,314 scales from 96 countries, the reported model finds a strong preference for 1-3 semitone steps, while harmony contributes only a weaker bias toward fourths, fifths, and octaves in performance-measured scales. Here the coordinate system is not physical space but pitch space. The claim is still parallel. A scale is shaped less by abstract harmonic landmarks than by the local moves a voice can make and remember.

Separation-aware watermarking adds the forensic version. A watermark that survives generic distortion may fail after source separation, because separation is not just damage. It is a change of coordinate system. The detector must know the separator's geometry, or the embedded identity collapses when the mixture is re-expressed as stems. A mark placed in the wrong coordinates is not really robust.

Taken together, these sources point to a useful design rule: choose the coordinate system before choosing the gesture. If the piece is about bodies moving through a room, use azimuth, distance, and reverberation as first-class musical parameters. If it is about songlike motion, treat 1-3 semitone steps as the locally available moves and let larger intervals behave like structural anchors rather than default material. If it is about hidden identity in mixtures, compose the watermark, stem, or signature in the same representation that will later be used to recover it.

The practical instrument is not "audio" in general. It is audio plus a map.

A composer could test this directly. Write one short study three times:

1. In source coordinates: each event is defined by performer identity, direction, and distance.
2. In room coordinates: each event is defined by RT60, apparent volume, and reflection density.
3. In melodic coordinates: each event is defined by local step size and contour memory.

Use the same pitches and rhythms where possible. The audible differences should reveal what each coordinate system makes easy, what it hides, and what kinds of continuity it can preserve.

That is the deeper connection across the batch. Scene understanding, spatial representation learning, real-time tracking, scale evolution, and watermark recovery all ask the same question in different dialects: what map does the sound have to survive?

_Sources: recent extractions on SceneBind (`j97ejyzx49mef8hykhbaf8xt6d8ave1q`), global scale evolution and melodic constraints (`j974tgk5gh6tc1deh6bse6vzg98avknh`), separation-aware multi-stream watermarking (`j97136a3cxa7tzb8yb113hvfb98atf3n`), SARL spatial-audio representation probing (`j9718kahkvm0zmm4watm7bt0kd8avqh4`), and autoregressive moving-speaker tracking (`j97btmntmx9jf57xgd2z7xhbg58avdfc`). Connections to: spatial audio, coordinate systems, melodic locality, source separation, watermark robustness, representation bias, and compositional control._
