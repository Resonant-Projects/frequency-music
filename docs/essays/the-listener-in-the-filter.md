# The Listener in the Filter

**Essay #128** — May 1, 2026

*Every signal transformation implicitly chooses whose ears matter.*

---

## The Invisible Decision

When you apply a low-pass filter, you're not just removing high frequencies. You're making a claim: *nothing above this cutoff matters to whoever is listening next*. When you compress a signal to 1.5 kbps, you're asserting that the surviving bits carry what the listener needs and the discarded ones don't. When you enhance speech by suppressing noise, you're declaring that cleanliness is what matters most.

Each of these operations embeds an implicit listener — a model of who will receive the output and what they care about. And a cluster of recent research reveals that when this implicit listener doesn't match the actual downstream one, systems fail in systematic and revealing ways.

The failure mode is always the same: the filter's listener and the real listener disagree about what counts as signal.

## The Evidence

### The Semantic Crossover

SPG-Codec investigates ultra-low-bitrate speech coding and discovers a phase transition. At 1.5 kbps, acoustic fidelity has collapsed so thoroughly that words become unintelligible — the codec's implicit listener (a waveform reconstructor) can no longer serve the actual listener (a person trying to understand speech). But adding semantic priors — HuBERT or Whisper representations that encode linguistic meaning — reduces word error rate by ~10%. The semantic system becomes a second listener that compensates for what the acoustic listener lost.

Here's the twist: above 6 kbps, these semantic priors contribute nothing. The acoustic information is rich enough that the codec's implicit listener aligns with the real one again. The semantic listener *retires*.

And the two semantic priors don't retire at the same rate, because they embody different listeners. HuBERT, trained on acoustic self-prediction, preserves prosody and timbre — it listens like a musician. Whisper, trained on transcription, suppresses phonetic hallucinations by 26% in noise — it listens like a transcriptionist. Same signal, two different implicit ears, two different contributions.

### The Contaminated Embedding

The False Resonance paper exposes an even subtler version of this problem. Emotion embeddings — latent representations from models like emotion2vec — are widely used to evaluate whether synthesized speech "sounds emotional." Cosine similarity in embedding space is treated as a proxy for emotional expressiveness.

But these embeddings don't contain a pure emotion listener. They're contaminated by speaker identity and linguistic content. When the embedding says "these two utterances are emotionally similar," it may actually be saying "these two utterances have similar spectral envelopes" or "these contain similar phonemes." The metric rewards acoustic mimicry over genuine emotional transfer.

The representation itself doesn't know who it's listening for. It was trained to classify emotions, which requires discriminating between emotional categories — but discrimination and similarity are different listening modes. A classifier only needs to find *boundaries*; a similarity metric needs to understand the entire *topology* of the space. The implicit listener in the training objective (boundary-finder) doesn't match the implicit listener in the evaluation use case (distance-measurer).

### The Verifiable Reward Trap

Step-Audio-R1.5 identifies this pattern at the scale of entire training paradigms. Reinforcement Learning with Verified Rewards (RLVR) optimizes audio language models against objectively checkable criteria — did the model produce the correct text? Did it get the factual answer right? The implicit listener here is a fact-checker: discrete, binary, text-centric.

But speech is not discrete, binary, or text-centric. Prosody, emotional continuity, conversational timing — these live in the continuous domain. Optimizing for the fact-checker's ears systematically degrades everything the fact-checker can't hear. The authors call it a "verifiable reward trap," but it's really a listener mismatch: training chose one listener and deployment needs another.

Their proposed fix — switching to RLHF, reinforcement learning from human feedback — is precisely a swap of implicit listeners. Replace the fact-checker with a person. Replace discrete verification with continuous judgment. The listener in the filter changes, and so does what the filter preserves.

### The Enhancement That Erases

Sparse MERIT reveals the listener mismatch in its most musically relevant form. Standard speech enhancement suppresses noise to improve intelligibility. The implicit listener is someone trying to hear words. But emotional information in speech is encoded at the frame level — in micro-fluctuations of energy, pitch, and spectral shape that overlap spectrally with exactly the noise the enhancer removes.

At -5 dB SNR, emotion recognition F1-macro drops substantially. The enhancer has cleaned the signal for *its* listener (the word-hearer) at the expense of another listener (the emotion-reader). And the fix — a mixture-of-experts architecture that jointly optimizes enhancement and emotion recognition — works by embedding two listeners in the filter simultaneously, letting gradient interference between them find a compromise.

This is the key insight: **gradient interference between tasks is not a bug. It's two listeners negotiating over the same signal.**

### The Rhythm Beneath the Spectrum

The cross-linguistic rhythm analysis of Nyishi and Adi adds a temporal dimension. Speech rhythm — the low-frequency amplitude modulation of the speech envelope — turns out to carry language identity with ~85% classification accuracy. This rhythmic structure lives at a timescale (2-10 Hz modulation) that most spectral analysis pipelines ignore or smooth over.

When you compute MFCCs, you're installing an implicit listener who cares about spectral shape at the frame level. This listener doesn't hear the slow undulation of syllabic rhythm. Adding rhythm formant features — essentially adding a second listener who tracks temporal modulation — boosts classification to 94%.

The signal always contained both kinds of information. But each feature extraction pipeline could only hear what its implicit listener was tuned for.

### The Noise You Must Model

The Feedback Delay Network paper makes the listener-in-the-filter problem concrete and fixable. When estimating attenuation filters from recorded room impulse responses, background noise in the recording creates spurious minima in the optimization landscape. The optimizer — whose implicit listener assumes a clean signal — converges to filter settings that explain the noise rather than the room.

The fix is beautifully direct: add a noise model to the optimization objective. Give the optimizer a second listener — one that hears the noise as noise rather than as room characteristics. With this explicit noise-aware listener, the estimated filters accurately capture the room's decay properties.

This is the only paper in the cluster that fully solves its listener mismatch, and it does so by the simplest possible means: making the implicit listener explicit.

## The Musical Principle

Every stage in an audio production chain embeds a listener. The microphone's polar pattern is a listener. The preamp's saturation curve is a listener. EQ, compression, reverb, limiting — each one transforms the signal according to an implicit model of what matters.

When a mix engineer applies a high-pass filter at 80 Hz on a vocal track, they're saying: *the listener in this context doesn't need the room rumble.* When a mastering engineer applies multiband compression, they're saying: *the listener needs consistent spectral balance across playback systems.* When a streaming service applies loudness normalization, it's saying: *the listener needs consistent volume across tracks.*

These are all reasonable listeners. But they compound. Each transformation destroys something that some other listener might have needed. The room rumble contained spatial information. The uncompressed dynamics contained the performer's expressive intent. The original loudness carried the artist's intended impact.

The compositional lesson: **be deliberate about whose ears you're optimizing for.** Every processing decision is a statement about the listener, and contradictory listener assumptions produce contradictory results. The "loudness wars" were exactly this — a conflict between two implicit listeners (the radio-scan listener who needs impact vs. the album listener who needs dynamics), resolved by letting one listener dominate the other.

The deeper lesson from this research cluster: the most robust systems don't pick one listener. They model multiple listeners explicitly, let them negotiate through shared optimization, and accept that the result will be a compromise — but a *known* compromise rather than an accidental one.

---

*Sources: SPG-Codec (semantic priors in ultra-low-bitrate speech coding), The False Resonance (emotion embedding similarity critique), Step-Audio-R1.5 (verifiable reward trap in audio LLMs), Sparse MERIT (joint speech enhancement and emotion recognition), Cross-Linguistic Rhythmic Analysis of Nyishi and Adi (rhythm formant features), Learning Filters in Feedback Delay Networks from Noisy RIRs (noise-aware FDN optimization)*
