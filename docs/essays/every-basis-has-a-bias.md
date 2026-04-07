# Every Basis Has a Bias

**Essay #99** — April 7, 2026

Three recent papers, from completely different corners of audio research, converge on the same uncomfortable truth: the coordinate system you choose determines what's easy and what's impossible.

## The Evidence

**MusicRFM** applies Recursive Feature Machines to frozen music generation models and discovers that musical attributes — notes, chords — exist as *separable linear directions* in activation space. Once you find the right axes, controlling pitch becomes almost trivial: target note accuracy jumps from 0.23 to 0.82 with minimal quality loss. The insight isn't about the model. It's about the basis. In the native hidden state space, "play a C" is a tangled, distributed request. In the RFM-derived coordinate system, it's a single direction.

**RIFT** (Reconstructive Ideal Fractional Transform) tackles the oldest problem in spectral analysis: how to represent a complex signal in time-frequency space without cross-term artifacts. Its answer is to abandon the idea of a single correct basis entirely. Instead, it deploys a *constellation* of fractional wavelet transforms, each aligned to a different local curvature of the signal, then uses entropy-based sparsity to select the right perspective at each point. The ideal representation isn't a fixed frame — it's a locally adaptive mosaic of frames.

**The prosody pretraining paper** delivers the sharpest version of the lesson. It builds a dual-stream encoder for TTS prosody and discovers that a training stage which improves prosodic *retrieval* metrics actually *degrades* synthesis quality. The best coordinate system for analyzing prosody is not the best coordinate system for generating it. The map optimized for classification actively hurts the generative process.

## The Pattern

These three results are saying the same thing in different vocabularies:

1. **The right basis makes the hard problem easy.** (MusicRFM)
2. **The right basis is local, not global.** (RIFT)
3. **The right basis depends on what you're doing with it.** (Prosody)

This is not a new idea. It's one of the oldest ideas in mathematics — the entire theory of linear algebra is built on the recognition that a change of basis doesn't change the object, only the difficulty of working with it. Eigendecomposition, Fourier transforms, principal component analysis: they're all tools for finding the coordinate system where the problem becomes diagonal.

But the prosody paper adds a twist that pure mathematics doesn't warn you about: **bases optimized for understanding can sabotage creation.** Analysis and synthesis may require incompatible frames.

## The Musical Resonance

This is exactly the lesson of temperament, and composers have been living it for centuries.

**Equal temperament** is a global coordinate system. It makes transposition trivial — every key is identical — but it makes pure intervals impossible. Every fifth is slightly narrow, every third is noticeably wide. The basis is uniform, and that uniformity has a cost.

**Just intonation** is the locally perfect basis. Within a single chord, every interval rings with crystalline purity. But move to a neighboring key and the ratios shatter. The basis is optimal locally and fragile globally — exactly like RIFT's constellation of curvature-adapted transforms.

**Meantone temperament** is the prosody paper's lesson made audible: a basis optimized for one purpose (pure thirds) that actively damages another (usable remote keys). The wolf fifth isn't a bug — it's the necessary price of the chosen coordinate system.

**Well temperament** is perhaps the most sophisticated response: a non-uniform basis where each key has a *different* character, making the choice of key a compositional parameter rather than a convenience. Bach's *Well-Tempered Clavier* isn't a demonstration that all keys are equal — it's a demonstration that they're *usefully unequal*.

## The Compositional Implication

If every basis has a bias, then choosing a representation is a creative act, not a neutral technical decision.

When a composer chooses equal temperament, they're choosing to make transposition easy and pure intervals hard. When they choose a spectral approach to orchestration, they're choosing a basis where timbral fusion is easy and harmonic root motion is hard. When they write for a sequencer grid, they're choosing a coordinate system where regular subdivision is trivial and rubato is nearly impossible.

The MusicRFM result suggests something provocative: somewhere in the space of all possible musical representations, there exist bases where *any* compositional parameter becomes a simple direction. The problem is finding them — and accepting that the basis that makes pitch control easy may be the one that makes timbral nuance hard.

The RIFT result suggests the resolution: don't commit to one basis. Build a constellation. Let the representation be locally adaptive — spectrally precise where the music demands frequency resolution, temporally precise where rhythm matters, and timbral where texture is the point.

This is, in fact, what skilled orchestrators already do intuitively. They think in pitch when writing counterpoint, in spectrum when blending instruments, in rhythm when constructing grooves, and in gesture when shaping phrases — switching coordinate systems fluidly as the compositional problem shifts.

The tools are just catching up.

---

*Sources: MusicRFM (arXiv, steering autoregressive music generation with RFMs); RIFT (arXiv, reconstructive ideal fractional transform); Multi-stage prosody pretraining for diffusion TTS (arXiv)*
