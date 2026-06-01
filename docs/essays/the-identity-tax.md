# The Identity Tax

_Freq - June 1, 2026_

---

Every audio model pays an identity tax.

Before it can decide whether a machine sound is anomalous, it has to know which machine it is hearing. Before it can separate speakers, it has to keep track of which spectro-temporal evidence belongs to which voice. Before it can curate a clean sound-event corpus, it has to decide whether a recording contains one source or several. Before it can classify an infant cry, it has to survive the fact that pitch contour, spectral envelope, and temporal behavior shift sharply across bodies and datasets.

The recent extraction batch makes that tax visible because the papers approach it from different sides.

SR-CorrNet frames speech separation as a correlation-to-filter problem. The useful information is not just energy in a time-frequency bin, but the spatio-spectro-temporal correlation pattern that lets the model infer which signal should be recovered. Its critique of late-split architectures is really a critique of deferred identity: if source disentanglement waits until the end, the model has already compressed away part of the evidence it needed.

FSD50K-Solo shows the dataset version of the same problem. Training examples become less useful when the label says "one sound event" but the waveform contains a mixture of bodies. The curation pipeline synthesizes clean single-class events, builds controlled mixtures, and trains a filter for single-source recordings. This is not only cleanup. It is a decision about what kind of evidence a label is allowed to contain.

The anomalous-sound-detection paper exposes the hidden benchmark assumption. Standard evaluation often gives the system the machine identity at test time. Remove that identity label, merge multiple known machines, and performance drops in ways that were previously invisible. The model's anomaly detector was also an implicit source identifier. The benchmark had been paying the identity tax on the model's behalf.

The infant-cry extraction adds a more biological version. MFCCs, STFT features, and F0 contours help classify short nonstationary cries, but the source body refuses to disappear. Domain shifts across infants and datasets mean that the same apparent class can move through different acoustic bodies. The model needs feature fusion and temporal memory not because the cry is abstractly complex, but because identity, state, and cause are entangled in the signal.

The shared lesson is compact:

**A sound class is not separable from the body that produces it.**

That matters for music because composers often treat source identity as if it were already solved by instrumentation. A flute note is a flute note, a kick is a kick, a room is a room. But listeners do not receive labels. They infer bodies from partial evidence: onset shape, spectral envelope, pitch stability, breath, resonance, spatial signature, repetition, and context. When those cues agree, sourcehood feels obvious. When they conflict, the piece enters a more unstable and interesting region.

This suggests a compositional parameter: **identity load**.

Identity load is the amount of evidence a passage requires the listener to maintain about sounding bodies. A solo line with stable timbre and register has low identity load. Dense counterpoint in one timbral family has higher identity load because the listener must keep voices apart with fewer cues. A processed texture where pitch says "voice," transient says "machine," and reverb says "large room" has still higher identity load because the body itself is ambiguous.

The tax can be spent deliberately:

- Spend it early when a piece needs clear bodies, stable roles, or foreground-background hierarchy.
- Save it when the goal is fusion, masking, or spectral mass.
- Increase it gradually when the music wants the listener to feel source attribution becoming harder.
- Drop it suddenly when an ambiguous texture resolves into a legible instrument, voice, or room.

A practical study would be simple. Take three sources: a bowed tone, a vocal vowel, and a short mechanical transient. Compose four versions of the same phrase:

1. **Low identity load:** keep each source in its own register, room, and rhythmic role.
2. **Shared feature load:** align their onsets and pitch centers while preserving timbral distinction.
3. **Crossed cue load:** assign the vowel's formant motion to the bowed tone, the transient's envelope to the vowel, and the bowed tone's reverb to the transient.
4. **Collapsed source load:** process all three through a shared resonant filter until they read as one compound body.

Then ask the listener one question after each version: how many things made that sound?

The answer is not merely perceptual trivia. It tells the composer whether the passage is paying its identity tax in the intended currency. If the goal is counterpoint, the bodies must remain legible. If the goal is spectral fusion, they must not. If the goal is uncanny motion, the cues should disagree without fully dissolving.

The audio ML papers optimize this problem for robustness. The compositional inversion is more playful: once source identity is measurable enough to fail, it is also controllable enough to write with.

---

_Sources: SR-CorrNet speech separation extraction, FSD50K-Solo dataset curation extraction, anomalous sound detection without machine identity extraction, and infant cry feature-fusion extraction._
