---
title: "The Orthogonal Unknown: Why Explicit Boundaries Beat Implicit Ones"
publishDate: 2026-03-22
excerpt: "When neural systems make the boundary between known and unknown information mathematically explicit-via orthogonal decomposition, frequency crossovers, or distributional ambiguity-they achieve…"
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "mathematical-music-theory"
  - "information-theory"
  - "acoustics"
  - "composition"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

## Three Boundaries

Three recent papers solve different problems in audio — reconstructing waveforms from mel-spectrograms, extending bandwidth from low sample rates to high, and recognizing emotion in speech — but they all discover the same principle. When you make the boundary between what you _know_ and what you must _infer_ mathematically explicit, you get dramatically better results with dramatically fewer resources.

This isn't a vague insight about "knowing your limits." It's an architectural principle with concrete, measurable consequences.

---

## The Null Space Is the Unknown

RNDVoC applies Range-Null Space Decomposition to the neural vocoder problem. The setup: a mel-spectrogram is a linear compression of a linear-scale spectrogram via a mel-filter matrix **A**. This means the target spectrogram can be decomposed into two _orthogonal_ subspaces:

- **Range space**: the information preserved by the mel compression. You can recover this exactly via the pseudo-inverse **A†Y** — no neural network needed.
- **Null space**: the information destroyed by the compression. This is orthogonal to everything the mel captured. You _must_ generate it.

The key result: with only 3.14 million parameters, RNDVoC-shared matches or outperforms BigVGAN's 112 million parameters. That's 2.8% of the model size for comparable quality. On LibriTTS, it achieves PESQ 4.226 vs BigVGAN's 4.027 (at equivalent training steps).

How? By not wasting capacity on what's already known.

When the range-space component is computed by a fixed matrix operation (no learning required), the neural network's entire capacity is focused on the null space — the spectral details that genuinely need to be generated. The ablation studies are unambiguous: making the projection matrices learnable _hurts_ performance. Making them learnable with explicit orthogonality constraints helps a little, but still can't match the fixed decomposition. The physics of the compression, honored rather than learned, provides a better prior than any amount of data.

The spectral visualizations tell the story visually. With fixed orthogonal decomposition, the null-space component is _sparse_ — fine-grained harmonic details, the subtle structure between mel bands. With learnable projections, the null-space estimate becomes dense and noisy, because the network has lost the guarantee of orthogonality and is partly re-learning what the range space already provides for free.

---

## The Crossover Is the Unknown

The Vocos BWE paper solves bandwidth extension: take audio sampled at 8–48 kHz and reconstruct full 48 kHz content. The architectural choice is simple but revealing. All inputs are resampled to 48 kHz via sinc interpolation (preserving the low-band information exactly), then a ConvNeXt generator fills in the missing high-frequency content.

But the critical innovation is the Linkwitz-Riley-inspired frequency refiner. Rather than letting the neural generator handle the entire spectrum, the system constructs an explicit crossover:

- Below the input's Nyquist frequency: keep the original signal (it's real data, not generated).
- Above the input's Nyquist: use the neural network's output (it's all the network can contribute).
- At the boundary: smooth polynomial blend (3t² − 2t³) ensuring flat magnitude response.

The ablation is telling. No refiner: LSD 0.897. Brickwall crossover: 0.865. Butterworth filter (but with its +3 dB crossover bump): 0.861. Linkwitz-Riley smooth crossover: 0.850. Each step toward a more mathematically correct boundary improves quality.

The model runs at 190× real-time on CPU and 12,500× real-time on GPU at batch-32. With only 15M parameters, it matches AP-BWE's perceptual quality (ViSQOL 3.51) while using a sixth of its parameter count and running 10× faster.

Again: make the boundary explicit, and the system gets both better and smaller.

The out-of-domain generalization result seals it. The model was trained on 8, 12, and 16 kHz inputs, but when tested on never-seen rates (10, 14, 24, 32 kHz), performance follows the exact same linear trend. Because the crossover dynamically adjusts to wherever the actual information boundary sits, the model doesn't need to learn rate-specific behavior. It learns _spectral completion_ — generating whatever's missing above an arbitrary boundary — and the explicit crossover handles the rest.

---

## The Distribution Is the Unknown

The ambiguous emotion paper seems like an outlier, but it encodes the same principle. Standard speech emotion recognition collapses a fundamentally ambiguous signal into a single label. A voice that three annotators hear as "happy" and two hear as "surprised" gets labeled whichever wins the majority vote — and all the information about the disagreement (which _is_ the emotional reality) is discarded.

The authors reformulate the problem: don't predict a label, predict a _distribution_. Use KL divergence to align the model's predicted emotion distribution with the actual annotator distribution. And provide structured chain-of-thought supervision so the model can reason about _why_ the emotion is ambiguous.

The results: DPO with ambiguity-aware objectives achieves JS divergence of 0.17 on CREMA-D (6-class emotion, up to 12 annotators per sample), vs. 0.25 for the base model. More importantly, models trained with CoT supervision generalize cross-domain (train on CREMA-D, test on IEMOCAP: JS 0.38 with CoT vs. 0.52 without). The chain of reasoning about ambiguity transfers; the brute-force distribution matching overfits.

Here, the "boundary" is between categorical certainty and distributional ambiguity. Making it explicit — "this utterance is 40% happy, 60% surprised, and that's the correct answer" — gives the model permission to express uncertainty rather than forcing it to collapse. The explicit uncertainty boundary _is_ the improvement.

---

## The Principle

Across these three papers, a pattern crystallizes:

**When the boundary between known and unknown information is made mathematically explicit, systems become simultaneously more efficient and more accurate.** They don't waste capacity re-deriving what's already available from first principles, and they don't corrupt known information by routing it through learned transformations that might distort it.

RNDVoC's range-space component passes through a fixed matrix — no gradients, no learning, no possibility of distortion. The mel-encoded information arrives at the output _provably intact_ (the orthogonality guarantee means **A**·**x̃** ≡ **y**). All network capacity goes to the genuinely unknown null space.

Vocos BWE's low band passes through untouched — the original sampled signal, not a neural approximation of it. All network capacity goes to the genuinely missing high frequencies.

The emotion model's soft labels carry the full annotator distribution — not a majority-vote compression. All model capacity goes to reasoning about the genuinely ambiguous cases.

Compare this to the "black box" alternatives each paper benchmarks against:

- Standard vocoders: neural network maps mel to waveform end-to-end, must implicitly learn to preserve mel-space information while also generating missing details. BigVGAN needs 112M parameters.
- Standard BWE: network generates the entire output spectrum, must implicitly learn not to corrupt the low band it already has. AP-BWE uses 3×30M parameters.
- Standard SER: model predicts a single label, must learn to handle ambiguity implicitly through its own uncertainty (which isn't supervised). Base model JS: 0.25.

In every case, the implicit approach forces the model to simultaneously learn the boundary _and_ the content on both sides — a harder problem that requires more capacity and achieves worse results.

---

## What This Means for Composition

The compositional analogy is powerful. Every arrangement, every orchestration, every mix involves a boundary between what the composer _controls_ and what the performer, the room, the listener _contributes_.

When that boundary is explicit — a precisely notated passage with clear dynamic markings, leaving only the performer's micro-timing and timbre inflections as "null space" — the result is efficient. The composer's intention passes through intact; the performer's contribution fills in exactly what's missing.

When the boundary is implicit — a vaguely sketched lead sheet that might mean anything — the performer must simultaneously guess the composer's intent _and_ add their own expression. More capacity is required (experience, rehearsal time, communication), and the result is less reliable.

The RND decomposition suggests a compositional framework: for any musical texture, identify what is _determined_ (the range space — the harmonic series, the rhythmic grid, the formal structure) and what is _undetermined_ (the null space — the timbral details, the micro-variations, the expressive nuances). Compose the determined part precisely. Leave the undetermined part explicitly open for generation — whether by performer, algorithm, or chance.

The crossover principle applies to mixing and production. When layering synthesized textures with recorded audio, the boundary between "real" and "generated" content matters enormously. A smooth crossover — where real audio anchors the low-band reality and synthesis extends into territories the recording doesn't reach — is more effective than trying to synthesize everything or awkwardly splicing real and generated content at a sharp boundary.

And the distributional emotion result maps onto the listening experience itself. Music that forces a single emotional interpretation (range-space-only, maximally determined) feels predictable. Music that is all ambiguity (null-space-only, maximally undetermined) feels chaotic. The richest music occupies a sweet spot: the structure is clear, the emotion is genuinely ambiguous, and the listener's perception fills the null space with their own experience.

---

## The Deep Connection

There's a satisfying mathematical resonance here. The RND framework says the reconstruction of any compressed signal is the superposition of what's preserved (range) and what's generated (null), and these two components are _orthogonal_ — they don't interfere with each other.

This is exactly what makes the approach work. Orthogonality means adding null-space content cannot corrupt the range-space information. The known stays known. The unknown gets filled in. There's no crosstalk.

Compare this to "The Reconstruction Limit" (essay #58): when recovery becomes invention, the quality depends on how well you can characterize the boundary. Shannon's theorem is the prototype — below Nyquist, perfect recovery; above, nothing. But the RND framework goes further. It doesn't just say "here's the boundary." It says "the boundary has algebraic structure, and that structure is orthogonal decomposition."

And to "The Compression Gradient" (essay #59): engine sounds have intrinsic dimensionality ~2, while high-bit-depth noise floors are near-random. The gradient from structure to surprise corresponds to the ratio of range-space to null-space. Highly compressible signals have large range spaces (most of the information survives compression). Incompressible signals are almost all null space (the compression destroys nearly everything).

The efficiency gains — 2.8% of parameters for comparable quality — suggest that much of what large models learn is redundant re-derivation of structure that could be computed analytically. The null space is where the real learning happens. And the null space, in most audio problems, is much smaller than the full signal space.

Which is another way of saying: sound has more structure than we usually assume, and the truly unknown part — the part that requires intelligence, whether artificial or human, to fill in — is a surprisingly small residual.

---

_Connected to: The Reconstruction Limit, The Compression Gradient, The Borrowed Structure, The Invariance Trap, The Expressive Residual_
