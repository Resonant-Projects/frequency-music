# The Codec Ear: What Neural Audio Compression Reveals About Musical Perception

*Freq · February 2026*

---

## 1. The Compression Problem: What Does "Essential" Mean in Audio?

Every audio codec faces the same philosophical question disguised as an engineering problem: *what can we throw away?*

A raw 48 kHz stereo audio stream runs at about 1,536 kbps. A Spotify "high quality" stream at 320 kbps has already discarded roughly 80% of the data, yet most listeners can't tell the difference. Go lower — 128 kbps, 64 kbps — and the losses start to bite. But the fascinating question isn't where things break. It's where they *don't*. What features of sound are so robust, so perceptually central, that they survive even catastrophic compression?

Classical perceptual codecs like MP3 and AAC answer this question with a hardcoded psychoacoustic model: frequency masking curves, temporal masking windows, critical band allocations. These models are elegant but frozen — they encode a fixed theory of human hearing baked in by engineers in the 1990s.

Neural audio codecs take a radically different approach. They *learn* what matters. Given a bottleneck — a quantized latent space with severely limited capacity — the network must discover for itself which features to preserve and which to sacrifice. The codec becomes, in effect, an empirical experiment in perception. Its architecture is a hypothesis about hearing; its output quality is the experimental result.

A new generation of papers from early 2026 pushes this experiment to extremes. Models like S-PRESSO (0.096 kbps), PhoenixCodec (1 kbps under 700 MFLOPs), and generative-first autoencoders (3360× temporal downsampling) are compressing audio by factors of hundreds to thousands. At these ratios, the codec isn't preserving the signal — it's preserving a *sketch* of the signal and regenerating everything else from learned priors. What survives that sketch tells us something profound about what the ear actually tracks.

## 2. Shape vs. Gain: The Equalizer's Separability Insight

One of the most elegant results in recent codec research comes from a deceptively simple idea. The Equalizer paper (arXiv:2602.15491) introduces **shape-gain decomposition** — borrowed from classical speech coding — into neural audio codecs (NACs).

The insight: audio can be factored into two components that are largely perceptually independent.

- **Gain**: the short-term energy envelope — how loud is this frame?
- **Shape**: the normalized spectral structure — what does this frame *sound like*, independent of level?

Standard neural codecs encode both in the same latent space. This turns out to be remarkably wasteful. The network burns codebook entries distinguishing "loud trumpet" from "quiet trumpet" when these are, perceptually, the *same timbre at different volumes*. The Equalizer shows that separating gain (quantized cheaply with scalar quantization) from shape (encoded by the NAC) yields substantial improvements in bitrate-distortion performance and massive complexity reductions.

But the deeper implication is perceptual. The Equalizer's success confirms that the auditory system processes spectral shape and energy through largely separate channels. This isn't new to psychoacousticians — loudness perception and timbre perception have long been studied as distinct processes — but seeing a neural network independently rediscover this separation is striking. The codec tells us: *the ear tracks the pattern of energy across frequencies (shape) and the overall level (gain) as fundamentally different kinds of information.*

For composers, this is immediately actionable. Shape-gain decomposition suggests that **timbre and dynamics are more orthogonal than we usually treat them**. You can think of a "shape library" — a palette of normalized spectral profiles — that can be deployed at any dynamic level. The timbral identity of a sound lives in its shape vector; the expressive arc lives in its gain trajectory. Swapping the gain envelope of a string section onto a synthesizer pad while preserving the pad's spectral shape would create a hybrid that inherits dynamics from one source and identity from another.

## 3. The 0.096 kbps Frontier: What Survives Extreme Compression?

S-PRESSO (arXiv:2602.15082) compresses 48 kHz audio to **0.096 kbps** — roughly 16,000× less data than the raw signal. To put this in perspective: at this bitrate, one second of audio is described by about 12 bytes. A single emoji in UTF-8 takes 4.

The trick is architectural. S-PRESSO uses a **diffusion autoencoder** with offline quantization. A latent encoder maps audio into a compressed representation at frame rates as low as **1 Hz** — one frame per second, a 750× temporal compression ratio. A pretrained latent diffusion model then *generates* plausible audio conditioned on these sparse latent frames.

This is fundamentally different from traditional codecs. S-PRESSO doesn't reconstruct the signal; it **reimagines** it. The diffusion decoder fills in everything between those 1 Hz landmarks using learned priors about what sounds sound like. The output is perceptually convincing but not bit-faithful — it's an audio hallucination steered by a skeleton of latent codes.

What does the skeleton preserve? At 1 frame per second, only the **slowest-evolving timbral features** survive: macro-level spectral envelopes, broad event boundaries, overall acoustic character. Everything faster — individual transients, fine harmonic detail, noise texture, micro-rhythmic fluctuation — is regenerated by the diffusion model's prior, not by the signal itself.

S-PRESSO outperforms both continuous and discrete baselines in audio quality, acoustic similarity, and reconstruction metrics. This tells us something the ear already knows: **the identity of a sound event is carried by slow, coarse features.** The fast details matter for quality and realism, but they're statistically predictable given the coarse structure. The ear recognizes "that's a dog bark" from the macro envelope; the diffusion model fills in the rest because, given "dog bark," the fine structure is heavily constrained.

PhoenixCodec (LRAC 2025 Challenge) pushes a complementary frontier: **extreme efficiency**. Operating under 700 MFLOPs computation and 30 ms latency, PhoenixCodec targets real-time speech coding at 1 kbps and 6 kbps. Its asymmetric frequency-time architecture and cyclical calibration training achieve best-in-class intelligibility at 1 kbps under noisy and reverberant conditions. The design confirms that speech intelligibility — the perceptual core of vocal communication — requires remarkably little bandwidth when the codec is architecturally aligned with how the ear processes speech: prioritizing formant trajectories and voicing decisions over fine spectral detail.

## 4. Semantic Tokens vs. Acoustic Tokens: The Two-Tier Hierarchy

Modern codec architectures increasingly reveal a two-tier structure in how audio information is organized:

**Semantic tokens** capture *what* is being said or played — phoneme identity, instrument class, event category. These are high-level, slowly varying, and carry the information needed for understanding.

**Acoustic tokens** capture *how* it sounds — timbre detail, room character, recording quality, speaker identity at fine grain. These are lower-level, faster-varying, and carry the information needed for perceptual realism.

SemanticVocoder makes this hierarchy explicit. The authors replace VAE acoustic latents with **semantic encoder latents** for audio synthesis, arguing that VAE latents "encode low-level acoustic details rather than semantically discriminative information, leading to entangled event semantics and complicating the training of generative models." Their semantic latents exhibit "superior discriminability compared to acoustic VAE latents," and their text-to-audio system achieves a Fréchet Audio Distance of 1.709 on AudioCaps — competitive quality while operating in a more structured latent space.

The generative-first autoencoder (arXiv:2602.15749) pushes this further with **3360× temporal downsampling**, compressing 60 seconds of mono audio into just **788 tokens** — about 13 tokens per second. A single unified architecture handles both continuous latents (for smooth interpolation) and discrete latents (for symbolic manipulation), as well as mono and stereo formats. The practical result: 10× faster encoding and 1.6× lower rates than reconstruction-first approaches, while maintaining competitive quality.

788 tokens for a minute of audio. Think about that. A minute of audio contains roughly 2.88 million samples at 48 kHz. The autoencoder has compressed the signal by a factor of 3,654 and the result is still musically coherent. Those 788 tokens must encode something very close to what the auditory system actually *represents* — the high-level structural skeleton of the sound.

The dual-role problem studied in deepfake detection research illuminates this hierarchy from another angle. Codec-resynthesized audio sits in a "gray zone" between authentic and synthetic because the codec's acoustic tokens faithfully reproduce low-level signal characteristics while the process of tokenization and detokenization subtly alters the statistical fingerprint. The semantic content is perfectly preserved; the acoustic "patina" is transformed. Detection systems struggle precisely because the perceptually relevant content is intact while the forensically relevant content has changed — a clean demonstration that these are genuinely different information layers.

## 5. What Codecs Teach Composers

If we take these codec experiments seriously as perceptual probes, several compositional principles emerge:

**Harmonic ratios are preserved before noise texture.** Every extreme-compression codec tested preserves pitched content — fundamental frequencies, harmonic series structure, formant trajectories — far better than it preserves noise-floor character, room ambience, or stochastic texture. This aligns with the auditory system's known bias toward periodic signals (the "harmonic template" theory of pitch perception) but quantifies it: when bandwidth is scarce, periodicity wins. For composers, this suggests that **the harmonic skeleton of a piece is its most compression-resistant feature** — the thing listeners will always hear, even through the worst playback chain.

**Temporal envelope trumps fine timing.** At 1 Hz frame rates, all micro-rhythmic information is lost, yet S-PRESSO's outputs are recognizable. The macro envelope — attack, sustain, decay at the event level — carries more identification information than fine temporal detail. This doesn't mean micro-timing doesn't matter expressively (it does, enormously), but it means micro-timing operates within a framework of *expectation* set by the macro envelope. Get the big shape right and the ear will forgive — or not even notice — considerable jitter in the details.

**Timbre is separable from dynamics, and both are separable from semantics.** The Equalizer's shape-gain decomposition and SemanticVocoder's semantic-acoustic split suggest a three-layer model:
1. **Semantic layer**: what event category is this? (voice, drum, violin...)
2. **Timbral layer**: what is its spectral shape? (bright, dark, hollow, nasal...)
3. **Dynamic layer**: what is its energy trajectory? (swelling, decaying, steady...)

Codecs suggest these layers are more independent than composers typically assume. A composition that deliberately exploits this independence — maintaining semantic continuity while radically transforming timbre, or preserving timbral identity while shifting dynamic contour — is working *with* the grain of perception.

**Generative priors fill gaps.** The success of diffusion-based decoders tells us that the auditory system is itself a generative model — it doesn't passively receive sound but actively predicts and fills in. A codec that sends 12 bytes per second and lets a diffusion model hallucinate the rest is exploiting the same principle: given enough structural cues, the brain (or the model) generates the expected texture. Composers have always known this intuitively — a string tremolo suggests a texture that the ear "continues" mentally even through gaps — but codec research gives us a quantitative framework for how much cueing is enough.

## 6. Studio Experiments

Three concrete experiments a producer could try, informed by these codec findings:

### Experiment 1: Diffusion-Compressed Sound Design

**Goal:** Use extreme codec compression as a deliberate sound design tool.

**Method:** Run source material through S-PRESSO or a similar ultra-low-bitrate codec at ≤0.5 kbps. The diffusion decoder will "reimagine" the input, preserving macro-level acoustic character while hallucinating new fine detail.

**Parameters:**
- Source: any complex, textured sound (field recordings, layered synths, acoustic instruments in reverberant spaces)
- Target bitrate: 0.096–0.5 kbps
- Frame rate: 1–4 Hz
- Compare: original vs. reconstructed. Note what's preserved (event identity, pitch, broad spectral shape) vs. what's transformed (noise character, room tone, transient detail)

**Compositional use:** Layer the original and compressed versions. The compressed version provides a "ghost" or "memory" of the sound — recognizably the same event but stripped to its perceptual skeleton and re-fleshed by the model's imagination. Pan them to create a split between "actual" and "perceived."

### Experiment 2: Shape-Gain Crossfeed

**Goal:** Exploit the perceptual independence of spectral shape and energy envelope.

**Method:** Decompose two different sources into their shape and gain components (using the Equalizer's approach or a simplified version: compute frame-wise RMS for gain, divide the magnitude spectrum by RMS for shape). Cross-assign: apply Source A's gain trajectory to Source B's shape, and vice versa.

**Parameters:**
- Source A: rhythmic material with strong dynamic contour (e.g., a drum loop, a spoken-word phrase)
- Source B: sustained timbral material with distinctive spectral character (e.g., a bowed cymbal, a choir pad)
- Frame size: 20–50 ms (roughly aligned with the ear's temporal integration window)
- Overlap: 50% with crossfade

**Compositional use:** The result inherits rhythmic energy from one source and timbral identity from another. Use this to make a pad "breathe" with the rhythm of a drum pattern without any actual amplitude modulation artifacts — the dynamics feel organic because they *are* organic, just transplanted.

### Experiment 3: Token-Rate Composition

**Goal:** Compose directly at the token level using a generative-first autoencoder's latent space.

**Method:** Encode several minutes of heterogeneous source material into discrete tokens (~13 tokens/second with a 3360× downsampling autoencoder). Manipulate the token sequences directly: splice, reverse, interpolate between token embeddings, apply simple transformations (substitution, permutation within segments).

**Parameters:**
- Source material: varied — orchestral, electronic, field recordings, voice
- Token vocabulary: as provided by the autoencoder's codebook (typically 1024–16384 entries)
- Manipulation granularity: individual tokens (~75 ms each) or token n-grams
- Interpolation: linear interpolation between continuous latent vectors for smooth morphs; discrete token substitution for abrupt timbral shifts

**Compositional use:** Working at 13 tokens per second means you're composing at the temporal resolution the ear uses for event-level processing — each token roughly corresponds to one perceptual "moment." This is coarse-grained composition in the purest sense: you're arranging perception-sized chunks, and the decoder generates all the sub-perceptual detail. Splice a token sequence from a cello into a sequence from rainfall: the decoder will generate a physically impossible but perceptually coherent transition, because it's optimized to make any token sequence sound plausible.

---

## Coda

Neural audio codecs didn't set out to be theories of perception. They set out to compress audio. But the logic of compression — especially extreme compression — forces a confrontation with what matters in sound. Every architectural decision (shape vs. gain separation, semantic vs. acoustic tokens, 1 Hz frame rates) is an implicit claim about auditory processing. And the fact that these systems *work* — that listeners accept their outputs as music, as speech, as recognizable sound events — validates those claims experimentally.

The codec ear isn't the human ear. But it's the closest thing we have to a machine that's been *forced* to answer the question: **if you could only keep one thing about this sound, what would it be?**

The answer, consistently, across architectures and papers: keep the harmonic skeleton, the spectral shape, the slow envelope, the semantic identity. Everything else — the noise, the room, the micro-texture, the fine timing — can be regenerated. Is *expected* to be regenerated. By the model, by the ear, by the musical imagination.

Composers have always known this, in a way. A melody scrawled on a napkin — 13 symbols per second of music, roughly one per note — is an ultra-low-bitrate codec. The decoder is the performer, the instrument, the room. The napkin preserves what matters. The codecs are just learning what napkins have always known.

---

### References

- **S-PRESSO**: Ultra-low bitrate diffusion-based audio compression, 48kHz, 0.096 kbps. arXiv:2602.15082, 2026.
- **The Equalizer**: Shape-gain decomposition for neural audio codecs. arXiv:2602.15491, 2026.
- **Generative-First Neural Audio Autoencoder**: 3360× downsampling, 788 tokens/60s. arXiv:2602.15749, 2026.
- **PhoenixCodec**: Extreme low-resource neural speech codec, <700 MFLOPs, 1–6 kbps. LRAC 2025 Challenge.
- **SemanticVocoder**: Bridging audio understanding and generation via semantic latents. FD 12.823, FAD 1.709 on AudioCaps.
- **How to Label Resynthesized Audio**: Dual role of codecs in deepfake detection. ASVspoof 5 extension study.
