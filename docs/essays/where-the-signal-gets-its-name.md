# Where the Signal Gets Its Name

The latest extraction batch keeps asking a deceptively simple question: what is the system actually allowed to know about the sound?

In the room-acoustics paper, the answer is almost embarrassingly decisive. A model that sees measurements from the target receiver position can report strong predictive accuracy, but the result changes when the validation split is grouped by receiver position and the inputs are restricted to information available at an unmeasured point. The impulse response stops behaving like transferable acoustics and starts behaving like a position fingerprint. The signal has been named by its location.

GigaSpeechBench finds the same problem in human voice, but stretched across language, accent, dialect, domain terminology, and age. A speech-recognition system can look robust on high-resource benchmarks while failing on the human variation that gives speech its social and physical specificity. Here the hidden name is not a seat in a hall but a speaker's linguistic and bodily context. The acoustic event is not merely phonemes plus noise; it is phonemes carried by age, accent, dialect, vocabulary, and recording condition.

The replay-detection paper turns that lesson into spatial security. Single-channel replay detection discards much of the evidence that a sound belongs to a particular room/device/listener geometry. Multi-channel audio reintroduces spatial cues, especially inter-channel phase differences between adjacent microphone pairs. The system is no longer judging only "what does this waveform contain?" It is asking "from where, through what acoustic path, did this waveform arrive?"

These three sources form a useful triangle:

- Room-acoustic prediction shows that a model may cheat by using a signal as a location label.
- ASR benchmarking shows that models can miss identities that matter when evaluation smooths away human variation.
- Multi-channel replay detection shows that phase relationships can restore an otherwise hidden spatial identity.

The musical implication is strong. We often treat timbre as if it is self-contained: a note, a sample, a voice, a patch. But these papers suggest that timbre is partly an attribution process. A sound becomes musically meaningful when the listener can infer a cause, a place, a body, or a path. Remove too much context and the sound becomes generic. Leak too much context and the system confuses recognition with fingerprinting.

That gives a compositional protocol:

1. Start with one vocal or instrumental source and record it across several positions in a room.
2. Build two layers: a "content" layer that preserves pitch/rhythm/phonetic identity, and a "naming" layer that preserves room position through inter-channel phase, early reflections, and spectral coloration.
3. Deliberately swap the layers: let one phrase carry another phrase's spatial fingerprint, or let a single body appear to move through impossible room identities.
4. Test the result by removing channels or collapsing to mono. If the musical identity changes, the piece is making the attribution layer audible.

This is not just a technical concern about machine learning benchmarks. It is a way to compose with evidence. A sound can be recognized by what it says, where it stands, how it reaches the ear, and which variations the listener has learned to treat as meaningful. The hidden variable is the name-bearing layer around the signal.

_Sources: "What does the model actually see? Evaluation protocols and input availability in data-driven prediction of room acoustic parameters"; "GigaSpeechBench: A Real-World Multilingual Speech-to-Text Benchmark"; "Acoustic Simulation Framework for Multi-channel Replay Speech Detection." Connections to: receiver-position generalization, impulse-response fingerprinting, dialect and age variation, inter-channel phase difference, spatial attribution, and compositional source identity._
