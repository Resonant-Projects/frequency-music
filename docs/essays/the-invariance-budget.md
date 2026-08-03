# The Invariance Budget

A few recent extractions point at the same compositional problem from different technical directions: every audio system has to decide what must remain the same when the sound is moved.

That movement may be mathematical. The AI-music detector remaps audio onto a log-frequency axis so that pitch shifting and speed changes become translations, then uses cross-correlation and max-pooling to preserve the forensic cue it cares about. In that frame, the musical surface is allowed to slide. The detector is not listening for a fixed frequency. It is listening for a pattern that survives frequency scaling.

That movement may be generative. The diffusion speech-separation paper treats separation as an inverse problem, but the extraction's most useful warning is that local acoustic realism is not enough. An unconditional model can make plausible speech fragments while letting speaker identity drift over time. Speaker-embedding guidance spends part of the model's control budget on identity coherence: one separated stream should continue to sound like one person, while different streams should move apart in embedding space.

That movement may be physical. The room-acoustics extraction studies Green's functions in rectangular rooms with general wall impedances, including soft or absorptive boundaries. The live-music separation extraction makes the same point in dataset form: a model trained on studio recordings does not automatically survive venue acoustics, loudspeaker coloration, and audience noise. PaRIRset and CrowdioSet are not just data augmentation. They are an attempt to teach the system which musical identities should survive the hall.

So the shared object is not "robustness" in the vague engineering sense. It is an invariance budget.

An invariance budget names the limited set of features a system chooses to preserve across transformation. Preserve too little, and the object falls apart: a speaker changes identity, a vocal stem dissolves into crowd noise, a detector misses a shifted artifact. Preserve too much, and the system becomes rigid: pitch shifts look like failures, room coloration looks like corruption, expressive timing looks like error.

Composition has always worked inside this budget. A theme survives transposition because interval relations matter more than absolute pitch. A singer remains recognizable through reverberation because timbre, articulation, and phrase timing survive the room. A groove survives tempo change only up to the point where gesture and bodily affordance stop feeling equivalent. An orchestration survives a new ensemble when enough functional roles remain audible, even if the spectra change completely.

The new extraction cluster gives this old musical intuition sharper handles:

- Log-frequency detection says: choose a coordinate system where the intended transformation becomes simple.
- Speaker-guided diffusion says: local plausibility is weaker than identity continuity.
- Soft-wall room acoustics says: the boundary condition is part of the instrument.
- Live-MSS data design says: the world a model survives must be represented in the training ecology.
- Field transcription under sirens and radio interference says: adaptation is not only linguistic; it is acoustic and situational.

For a composer, the practical question becomes:

What identity should this material keep when the world around it changes?

One can write a piece that makes the invariance budget audible. Start with a melody, voice, or texture that has several possible identities: pitch contour, source timbre, rhythmic placement, spectral artifact, spatial position, lyric intelligibility. Then subject it to transformations one at a time: transposition, time scaling, convolution with different rooms, crowd masking, source separation, synthetic re-rendering, forensic detection. Each transformation asks the listener to renegotiate what "the same sound" means.

The compositional power is in spending the budget deliberately. Preserve pitch while destroying source identity. Preserve source identity while detuning the pitch frame. Preserve room signature while replacing the performer. Preserve artifact traces while changing every surface-level musical parameter. The moment the listener hears continuity through change, the invariant has become the material.

This also gives the knowledge graph a useful bridge concept. "Invariance budget" connects signal-processing robustness, group-theoretic transformation, room acoustics, source identity, AI forensics, and orchestration. It is mathematical enough to be precise, but practical enough to guide a patch, a score, or a listening experiment.

_Sources: recent extractions on embedding-guided diffusion speech separation (`j9767ctn6p5h3q8c3tgx5bb9358bsmdj`), rectangular-room Green's functions with general impedance boundaries (`j975pan3tdjxjht7d2h52pgzqd8brgqc`), out-of-distribution deepfake detection (`j97af3hstj98rrg7p8s4em9e958bsa11`), field transcription under sirens and radio interference (`j975q573fft5heed3d5esw18md8br5rs`), AI-music detection under pitch and speed changes (`j97fdykta9t6t9gy23mf1061es8bjvg8`), and live music source separation with crowd and venue acoustics (`j97f8ssp84ay50b70fct66gdwx8bpafp`). Connections: invariance, source identity, transformation, room acoustics, AI-music forensics, source separation, acoustic robustness, and compositional continuity._
