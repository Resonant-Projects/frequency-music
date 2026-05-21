# The Source Identity Budget

_Essay #144 - May 21, 2026_

## The Question

How much of a sound can change before the listener loses track of what made it?

Several recent extractions circle the same problem from different directions. Speech separation models try to recover speakers from mixtures. Dataset curation systems try to isolate single-source events. Anomalous sound detection papers warn that performance collapses when the machine identity is no longer given at test time. Infant cry classifiers struggle with strong domain shifts across infants and datasets. These are different engineering tasks, but they share one hidden variable: **source identity is not a label attached after listening. It is part of the signal itself.**

For music, that matters. Instrument identity, performer identity, room identity, and gesture identity all consume part of the listener's attention. A composition can spend that budget clearly, ambiguously, or deceptively.

## The Evidence

### Separation Begins Before Reconstruction

The SR-CorrNet extraction is framed around a critique of late-split architectures: if a model waits until the final stage to disentangle speakers, it creates an information bottleneck. Its proposed answer is a separation-reconstruction strategy that uses spatio-spectro-temporal correlations as features for estimating filters.

That is a useful musical clue. In dense polyphony, source identity cannot be treated as a final annotation. By the time the listener asks "which voice is this?", the relevant cues have already passed through time, spectrum, onset alignment, spatial position, and reverberant smear. Voice-leading is not only pitch motion. It is the continuous preservation of source identity across overlapping evidence.

### Single-Source Is a Construct

The FSD50K-Solo extraction makes the complementary point. The dataset exists because large audio corpora contain many multi-source samples, and those mixtures weaken training. The proposed pipeline synthesizes clean single-class events, then uses an encoder and classifier to filter out samples with overlapping sources.

This sounds simple until it is translated into music. A "single source" is often not physically single. A violin note contains bow noise, body resonance, room response, and performer microgesture. A piano note contains hammer impact, string coupling, soundboard radiation, and pedal resonance. The ear hears one source because those components cohere. Single-source identity is therefore a perceptual achievement, not a bare acoustic fact.

### Attribution Is a Hidden Assumption

The anomalous sound detection extraction is especially sharp: standard benchmarks assume the monitored machine is known at test time, but real deployments may contain multiple known machines operating together. When identity labels are withheld, model performance degrades, and that degradation tracks implicit machine identification accuracy.

Music information retrieval often makes the same quiet assumption. We evaluate pitch, timbre, onset, and quality as if the relevant source stream has already been assigned. But in actual listening, attribution and evaluation happen together. A wrong note on a flute is not the same perceptual event as the same pitch from a clarinet offstage. The note's meaning depends on who, where, and what the listener thinks produced it.

### Biological Signals Shift Under the Same Name

The infant cry classifier adds a final pressure: even within the same sound class, different individuals and datasets produce strong domain shifts. F0 contours, MFCCs, and STFT features help, but they are source-dependent. The class "cry" is not one acoustic object. It is a family of source-conditioned gestures.

That maps cleanly onto performance. "A sung A4" is not one event. It is a singer, vowel, breath state, room, microphone, emotional pressure, and tuning context passing through a nominal pitch label. Musical notation collapses that richness on purpose. Audio analysis has to reopen it.

## The Compositional Claim

Source identity behaves like a budget because it competes with other musical variables. The more ambiguous the source, the more attention the listener spends resolving attribution. The clearer the source, the more attention can move toward harmony, rhythm, form, or text.

This suggests a practical compositional control:

- **Preserve identity** when a line must carry structural memory. Keep attack profile, register, spatial position, or spectral envelope stable enough that the listener can follow the thread.
- **Spend identity** when transformation itself is the subject. Morph timbre, spatialize reflections, or crossfade instrumental roles so the listener hears sourcehood becoming unstable.
- **Exploit false identity** when the piece wants misdirection. Let one source inherit another's contour, envelope, or room signature, then reveal the substitution later.

The old orchestration question "what instrument should play this?" becomes a deeper question: "how much source evidence does this event need to remain itself?"

## A Tool Shape

A useful Resonant Projects tool would not merely classify instruments. It would estimate a **source identity budget** over time: a curve showing how strongly an audio stream supports continuity of sourcehood. Inputs could include F0 contour stability, onset synchrony, spectral envelope similarity, spatial coherence, reverberant consistency, and learned embeddings. The output would not be a hard label but a confidence surface: where does the listener have enough evidence to bind events into one source?

Compositionally, that surface could become a score layer. A composer could write passages where pitch continuity remains high while source identity collapses, or where timbral identity remains stable while harmonic function changes underneath it. The result would be a measurable way to compose with the thing listeners do constantly but notation barely names: deciding what made the sound.

## Why It Matters

The recent audio papers are not only improving models. They are clarifying a perceptual primitive. Source identity sits between physics and meaning. It is grounded in measurable correlations, but it becomes musically active only when a listener binds those correlations into an agent, instrument, room, or gesture.

That makes it exactly the kind of bridge this project is looking for: acoustics as evidence, mathematics as structure, music as controlled ambiguity.

---

_Connections: SR-CorrNet, FSD50K-Solo, anomalous sound detection, infant cry classification, source separation, timbre, orchestration, perceptual binding, voice-leading_
