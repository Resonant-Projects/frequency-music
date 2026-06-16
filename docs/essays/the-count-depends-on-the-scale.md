# The Count Depends on the Scale

_Essay #243 - June 16, 2026_

## The Pattern

One recent source asks a deceptively simple physics question: how many elementary particles are there? The answer depends on how closely one listens. At classroom scale, the Standard Model has 17 particles. Count antiparticles, colors, chirality, and polarization, and the number splinters. Count quantum-field-theoretic degrees of freedom, and the number becomes stranger still.

Several recent audio sources are asking the same question in another register: how many sources are there in this sound?

That number is not always an integer in practice either. It depends on the resolution of the model, the task being asked, and the physical scale at which the signal is treated as evidence.

## Counting Is an Instrument

The Quanta particle-count article is useful because it refuses to treat counting as neutral. The count changes when the observer decides whether antiparticles are separate, whether gluon colors matter, whether chirality is a distinct state, and whether degrees of freedom are more fundamental than named particles.

This is not relativism. It is instrumentation. A count is a measurement protocol.

Audio analysis has the same structure. A single recorded mixture can be counted as one waveform, two speakers, eight spatial channels, hundreds of time-frequency bins, or a dense field of spectro-temporal correlations. None of those counts is simply "the truth." Each count is the truth for a particular intervention.

If the task is transcription, a robust ASR model may count words and ignore acoustic damage. If the task is hearing-instrument evaluation, that same shortcut can be misleading because the acoustic evidence matters. If the task is source separation, the model must count recoverable objects. If the task is composition, the count may be deliberately unstable: one sound can behave as a texture, a gesture, a room, or a crowd.

## Sources Split Under Magnification

SR-CorrNet frames speech separation as a correlation-to-filter problem. The source is not recovered by naming it first. Instead, spatio-spectro-temporal correlations in the mixture become the evidence from which filters are estimated. Speaker count, noise, reverberation, and overlapping voices are resolved together.

That is close to the field-theory lesson. When the scale changes, the apparent object splits into more degrees of freedom. A voice is no longer just "speaker A." It is a bundle of correlations across frequency, time, channel, room response, and interference. The model does not merely find the source. It chooses the resolution at which the source is separable.

FSD50K-Solo makes the inverse move. It tries to curate single-source sound events by filtering out multi-source recordings. But the need for such a dataset reveals the fragility of the category. "Single-source" is not a raw property of a file. It is a decision made by a classifier, trained with synthetic clean events and validated against expert judgment.

In other words: a single source is what remains single under the chosen listening scale.

## The Room Adds Degrees of Freedom

HIDVAS sharpens the point physically. Hearing-instrument evaluation is not just a question of speech plus noise. The dataset varies loudspeakers, external microphones, dummy-head microphones, behind-the-ear shells, receiver-in-canal loudspeakers, dome types, rooms, and reverberation times.

At one scale, this is one listener in one room. At another scale, it is a high-dimensional acoustic apparatus. The source count changes because the room, head, microphone geometry, and device coupling become part of what must be counted.

That is compositionally important. A note played in a dry close-mic recording and the same note played through a reverberant hearing-instrument simulation are not simply the same source in different wrappers. The wrapper has degrees of freedom that can become musically active: occlusion, leakage, early reflection, late decay, head shadow, device coloration, and spatial uncertainty.

The room is not metadata. It is part of the count.

## Effective Counts

The most practical lesson is that composers and tool builders need effective counts, not absolute ones.

An effective count answers: how many independently controllable things are present at the scale relevant to this task?

For a mix engineer, a cymbal wash may be one texture. For a source-separation model, it may be many partial events. For a drummer, it may be one gesture. For a hearing aid, it may be an interfering source field. For a spectral composer, it may be a harmonic cloud whose internal degrees of freedom are the entire point.

This suggests a tool design principle for Resonant Projects: expose multi-scale source counts rather than a single answer. A useful analyzer could show:

- waveform count: how many captured channels exist,
- perceptual count: how many objects a listener is likely to hear,
- separability count: how many streams can be robustly extracted,
- control count: how many parameters can be musically manipulated,
- room count: how much spatial/acoustic structure is acting as an independent source.

The point would not be to pick the correct number. It would be to show where the count changes.

## The Compositional Control

Counting can become a compositional parameter.

A piece could begin with one apparent source and gradually increase the scale of listening until hidden degrees of freedom become audible: breath separates from pitch, room separates from instrument, bow noise separates from tone, resonance separates from attack. Or it could move the other way, fusing distinct sources into a single effective object by aligning onset, spectrum, location, and decay.

This is not just orchestration. It is ontological modulation: changing how many things the listener believes are present.

The Quanta article ends in mystery because fundamental particles resist a single census. The audio papers point to a similar, usable mystery. Sound sources are not fixed atoms of music. They are scale-dependent agreements between physics, perception, model, and task.

That is good news for composition. A count that changes is a handle.

---

_Connections: elementary particles, degrees of freedom, source separation, single-source audio, hearing instruments, reverberation, spectro-temporal correlation, acoustic evidence, orchestration, perceptual grouping._
