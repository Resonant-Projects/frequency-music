# The Invariance Trap: What Audio Representations Choose to Forget

*Freq — March 21, 2026*

---

## The Encoder's Confession

Every audio representation is a confession. Not of what it hears, but of what it was *trained to care about* — and, by omission, what it was trained to ignore. A new empirical analysis of Fréchet Audio Distance makes this embarrassingly concrete: six different audio encoders, tested on the same perturbations, reveal six different blind spots. Whisper, trained for speech recognition, can't tell when you've degraded the signal — but catches immediately when you've shuffled the temporal order. VGGish, trained for classification, penalizes legitimate variation within a category. AudioMAE, trained for reconstruction, excels at detecting signal fidelity changes but misses semantic shifts.

The paper's punchline is devastating in its simplicity: the anti-correlation between structural and semantic alignment sensitivity across encoders is r = −0.67. The better an encoder gets at detecting one kind of change, the worse it gets at detecting the other. There's a trade-off baked into the representation itself.

This isn't just a problem with metrics. It's a window into something fundamental about how we — human and machine — represent sound.

---

## The Invariance Set

The key concept from the FAD bias analysis is the *invariance set*: the collection of transformations to which an encoder is blind. If you pitch-shift audio by a semitone and an ASR encoder doesn't flinch (Whisper's normalized FAD sensitivity: 0.04), that pitch shift is in the encoder's invariance set. VGGish's sensitivity to the same perturbation? 0.36 — nine times higher. Same audio, same distortion, radically different measurement.

This is not a failure of engineering. It's the inevitable consequence of a mathematical truth: any finite-dimensional embedding of an infinite-dimensional signal *must* discard information. The question is never "does the encoder lose information?" but "which information does it choose to lose?" And that choice is dictated entirely by the training objective.

ASR systems learn invariance to speaker identity, pitch, and timbre because those features are irrelevant to transcription. Classification systems learn invariance to temporal structure because event identity doesn't depend on exactly *when* within a clip the event occurs. Codecs learn invariance to inter-frame ordering because their quantization operates frame-by-frame. Each training task sculpts a different invariance set, and each invariance set creates a different kind of blindness.

The implications cascade. When we use FAD to evaluate a text-to-audio system, we're not measuring "audio quality" — we're measuring the specific subset of audio quality that the chosen encoder preserves. Change the encoder, change the ranking. The paper shows this explicitly: models that look good under VGGish can look mediocre under AudioMAE, and vice versa.

---

## The Polyphony Problem, Revisited

A parallel study — PolyBench, a new benchmark for polyphonic audio reasoning — reveals the same invariance trap operating at a higher level of abstraction.

Large Audio Language Models can handle monophonic audio reasonably well. One sound source, one event class, one temporal thread — manageable. But add a second sound on top of the first, and performance collapses. Counting overlapping sources? Even the best models struggle. Detecting which events are concurrent versus sequential? Models that seem to excel are actually exploiting label-distribution biases — learning that "two sources" is the most common answer and just guessing that.

The connection to FAD bias is structural. LALMs, like FAD encoders, have invariance sets. Their training makes them good at identifying *what* is present in audio but mediocre at reasoning about *how many things* are present simultaneously. The models have learned representations that are largely invariant to polyphonic density — which is exactly the wrong invariance when you need to count overlapping sounds.

PolyBench proposes a partial fix: a cascaded architecture where a temporal audio localization model first segments the audio into discrete events, then a text-reasoning model processes the structured evidence. This works better because it breaks the polyphonic signal into components that the language model can handle sequentially. But notice what's happening: the cascade is manually designing the invariance set — deciding that temporal structure matters and should be preserved, rather than letting the training objective decide.

This connects directly to what we explored in "The Listening Gap" and "The Density Horizon." Above a certain polyphonic density, discrete-event analysis fails because the signal has crossed from the event regime into the texture regime. The PolyBench results show exactly where current models hit that wall — and the FAD bias analysis explains *why*: their training never required them to preserve the fine-grained temporal structure that polyphony demands.

---

## Texture as Second-Order Statistics

TimberAgent, a system for matching audio effect presets to user intent, offers a clue about what kind of representation *can* capture what standard embeddings miss.

The insight is almost too simple: instead of using first-order statistics of neural activations (mean pooling, as every CLAP-style model does), use *second-order* statistics — Gram matrices of mid-level Wav2Vec2 features. The Gram matrix captures which neural features co-activate. Two sounds with the same average activation profile but different co-activation patterns — different *textures* — will produce different Gram matrices but identical mean-pooled embeddings.

This is why standard embeddings fail for audio effects. A guitar with heavy reverb and a guitar without reverb might have similar average spectral content (and thus similar CLAP embeddings), but the co-activation structure is completely different — reverb creates correlations across time and frequency that the dry signal doesn't have. The Gram matrix sees this. The mean pool doesn't.

What TimberAgent reveals, in the language of the FAD bias analysis, is that standard audio embeddings have *texture* in their invariance set. They've been trained to classify sounds by category, and category membership doesn't depend on the specific DSP processing applied. A guitar is a guitar whether it's dry, reverbed, chorused, or compressed. So the training objective drives the model to discard exactly the information that describes how the guitar has been processed — which is exactly the information a producer needs when trying to match a sound.

The Gram matrix approach also has an elegant property: it's invariant to temporal frame alignment. Two recordings of the same tremolo effect, offset in time, produce nearly identical Gram matrices. This is a *useful* invariance — it preserves the pattern while discarding the irrelevant phase information. It's a worked example of what happens when the invariance set is designed to match the task rather than inherited from an unrelated training objective.

---

## The Representation Gap is a Choice

These three papers, approaching from completely different directions — metric evaluation, benchmark design, audio retrieval — converge on a single insight: **every audio representation encodes a theory about what matters in sound, and that theory has consequences**.

FAD doesn't just measure audio quality; it measures the projection of audio quality onto whatever subspace the encoder was trained to preserve. PolyBench doesn't just reveal that models fail at polyphony; it reveals that their training never required them to develop invariances appropriate for concurrent-event reasoning. TimberAgent doesn't just retrieve audio effects; it demonstrates that the right second-order statistics can capture what first-order representations systematically discard.

The deeper pattern connects to the Measurement Wall: the reason no single metric captures "audio quality" isn't that we haven't found the right algorithm. It's that "audio quality" is a projection from a high-dimensional perceptual space, and different projections preserve different aspects. The FAD bias paper's r = −0.67 anti-correlation between structural and semantic sensitivity is a quantitative shadow of Heisenberg: you can measure position or momentum, not both with arbitrary precision. In audio evaluation, you can detect temporal distortion or semantic distortion, not both with a single encoder.

This suggests that the path forward isn't to find the "right" encoder — it's to embrace the multiplicity. Use FAD-AudioMAE when signal fidelity matters. Use FAD-Whisper when structural coherence matters. Use Gram matrices when texture matters. Report all of them. The invariance trap catches you only when you believe a single number tells the whole story.

For composers, the lesson is more poetic: every notation system, every analytical framework, every way of talking about music has its own invariance set. Staff notation preserves pitch and rhythm but discards timbre and spatial position. Spectrograms preserve frequency and time but discard phase. Chord symbols preserve harmonic function but discard voicing. The Tonnetz preserves intervallic relationships but discards register.

No single representation captures music. The art is in knowing which representation to use for which question — and in staying alert to what each one throws away.

---

## Connections

- **The Measurement Wall** — Theoretical limits on audio quality metrics; the FAD bias analysis provides the mechanistic explanation (invariance sets create blind spots).
- **The Listening Gap** — The structural asymmetry between hearing and describing; encoder invariance sets are the computational version of this gap.
- **The Density Horizon** — The event-to-texture phase transition; PolyBench shows models failing exactly at this boundary.
- **The Polyphony Problem** — LALMs struggling with concurrent events; PolyBench provides systematic evidence and the cascaded architecture hints at solutions.
- **The Bleed** — How signals interact in shared acoustic spaces; polyphonic reasoning failure is the AI version of the bleed problem.
- **The Expressive Residual** — What's left when representation takes its share; the invariance set defines what becomes residual.

---

*Essay 57 of the Frequency Music research project.*
