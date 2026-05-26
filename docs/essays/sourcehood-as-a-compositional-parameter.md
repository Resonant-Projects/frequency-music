# Sourcehood as a Compositional Parameter

_Freq - May 26, 2026_

---

## Before the Note, the Source

The recent extraction batch points at a quiet but useful compositional variable: not pitch, rhythm, timbre, or harmony, but _sourcehood_.

By sourcehood I mean the degree to which a listener or machine can answer the question: what physical or inferred thing is making this sound? A flute tone has strong sourcehood. A dense reverberant cluster has weak sourcehood. A whispered consonant turning into bowed noise sits somewhere in between. This is not just classification metadata. It is part of the musical surface.

Three recent audio papers approach the same boundary from different sides. FSD50K-Solo tries to curate clean single-source sound events. SR-CorrNet tries to recover speakers from overlapping, noisy, reverberant mixtures by using spatio-spectro-temporal correlations to estimate filters. A streaming SpeechLLM learns when enough audio context has arrived to emit translation tokens. Together they suggest that sourcehood has at least three axes: purity, separability, and commitment time.

## Purity Is a Training Fiction

The FSD50K-Solo extraction is explicit about a problem that music usually treats as an aesthetic fact: most real audio is contaminated by other audio. Backgrounds leak in. Events overlap. Rooms smear attacks. A "single-source" recording is often less a natural category than a curated achievement.

For machine learning, that purity is useful because it gives the model stable labels. For composition, the more interesting point is that purity itself can be varied. A sound can enter as an isolated event, acquire environmental residue, merge into a texture, then re-emerge as a named object. That trajectory is musically legible because the ear is constantly estimating whether it is hearing one thing, many things, or one thing pretending to be many.

This reframes orchestration. Instead of asking only which instrument plays which pitch, ask how strongly each gesture asserts its source. Unison doubles, spectral blending, shared attacks, and similar envelopes reduce separability. Contrasting onsets, spatial positions, registers, and modulation patterns increase it. The old craft vocabulary already knows this. The new extraction vocabulary gives it a parameter name.

## Separation Is a Form of Listening

SR-CorrNet adds the next piece: sourcehood is not merely present or absent in the signal. It is reconstructed by a system that uses correlations across time, frequency, and space. The model's "correlation-to-filter" framing is a technical architecture, but it is also an auditory metaphor. To hear a source is to discover a filter that makes one coherent stream emerge from the mixture.

That maps neatly onto counterpoint. Independent voices are not independent because the score says so. They are independent because the listener can maintain separate filters for them. Parallel motion, shared envelopes, and overlapping critical bands make those filters collapse into one fused object. Contrasting contour, registral spacing, and rhythmic independence keep the filters apart.

The compositional lever is not simply density. It is _filterability_. Two dense textures can behave differently if one preserves enough correlation cues for stream segregation and the other destroys them. This suggests a practical exercise: write a passage whose number of sounding parts stays constant while perceived source count changes. The score would be stable; the inferred scene would move.

## Commitment Time

The streaming SpeechLLM extraction seems less directly musical, but it contributes a crucial temporal axis. A streaming system must decide when enough evidence has arrived to commit to an interpretation. Too early, and it guesses. Too late, and it loses responsiveness.

Music has the same problem. The listener does not wait until the end of a phrase to decide what kind of source is present. Sourcehood is inferred online. A noisy attack may first read as percussion, then as breath, then as bowed string once pitch stabilizes. A reverberant harmonic cloud may become a choir only after enough correlated partials and formants accumulate.

That means sourcehood can be composed as delayed recognition. The sound can withhold the cues required for commitment, then reveal them. Or it can do the opposite: begin with a clear source and gradually remove the evidence until only a residue remains. This is not just timbral morphing. It is the choreography of when the listener is allowed to know what they are hearing.

## A Small Grammar

These papers suggest a small grammar for composing sourcehood:

- _Isolate_: present a sound with strong single-source cues.
- _Contaminate_: add background, room, masking, or overlapping events.
- _Fuse_: align envelopes, pitch regions, or spatial positions until sources collapse into one object.
- _Split_: introduce decorrelated motion, onset differences, or spatial separation until streams become recoverable.
- _Delay_: withhold identifying cues so source commitment arrives late.
- _Mislead_: provide early cues for one source class, then reveal another.

This grammar is useful because it sits between acoustics and form. It can shape a phrase, a texture, or an entire piece. A composition can move from source certainty to source ambiguity and back, the way tonal music moves from stability to tension and resolution.

## Why This Matters

The connection across these extractions is not that machine listening can replace human listening. It is that machine listening often names the hidden control surfaces composers already manipulate. Dataset curation calls it single-source purity. Separation models call it disentanglement. Streaming models call it latency and alignment. Musicians hear it as the question: what is that sound, and when did I know?

Sourcehood belongs next to pitch, duration, loudness, and timbre as a compositional parameter. It is not reducible to any of them. It is an inferred relation between signal, room, body, and listener. That makes it slippery, but also powerful.

The ear is not only measuring frequencies. It is building a world of causes. Composition can write for that world-building process directly.

---

_Sources: FSD50K-Solo extraction on single-source audio dataset curation; SR-CorrNet extraction on speech separation via spatio-spectro-temporal correlations and deep filtering; streaming SpeechLLM extraction on low-latency audio-text commitment. Connections to: auditory scene analysis, source separation, orchestration, stream segregation, and "The Polyphony Problem."_
