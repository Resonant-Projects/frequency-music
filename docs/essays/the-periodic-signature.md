# The Periodic Signature: How Repetition Becomes Identity

*Essay #62 — March 22, 2026*

## The Observation

Three seemingly unrelated research directions converge on the same insight: the thing that makes a sound *recognizable* — to a neural network, to a dolphin, to a human listener — is its periodic structure. Not the raw waveform, not the instantaneous spectrum, but the pattern of repetition across time.

## The Snake That Learned to Oscillate

BemaGANv2 introduces the Snake activation function into its vocoder generator — a function defined as:

$$f_\alpha(x) = x + \frac{1}{\alpha} \sin^2(\alpha x)$$

where α is a *learnable* frequency parameter. This is a remarkable design choice. Standard activation functions (ReLU, tanh, sigmoid) can't extrapolate periodic behavior — they either go linear or saturate. Snake preserves monotonicity (so gradient descent still works) while introducing oscillation that the network can tune.

The key finding from BigVGAN's analysis: Snake satisfies a "universal extrapolation property" — neural networks using Snake can approximate any piecewise-smooth periodic function *over the entire real line*, not just within the training interval. In other words, once the network learns a periodic pattern, it can generate it indefinitely. This is exactly what you need for long-form audio generation, and exactly what standard activations can't do.

But here's what's compositionally interesting: the α parameter is learned *per channel*. Each channel in the generator discovers its own characteristic frequency. The network doesn't just learn "audio is periodic" — it learns a *vocabulary of periodicities* that, combined, reconstruct the full signal. This mirrors the harmonic series: a set of periodic components at different frequencies, whose combination defines timbre.

## The Envelope That Reveals Intent

BemaGANv2's other innovation is the Multi-Envelope Discriminator (MED), which doesn't listen to the raw waveform at all. Instead, it extracts five different temporal envelopes:

1. **Upper envelope** — the instantaneous amplitude ceiling (Hilbert transform)
2. **Lower envelope** — the amplitude floor
3. **Original signal** — baseline reference
4. **300 Hz low-pass envelope** — syllabic-scale amplitude variations
5. **500 Hz low-pass envelope** — phonemic-scale amplitude variations

Each envelope captures periodicity at a different temporal scale. The 300 Hz filter reveals the rhythm of syllables. The 500 Hz filter captures individual phoneme boundaries. The Hilbert envelopes track the global energy contour.

The result: the discriminator evaluates whether generated audio has the *right pattern of energy fluctuation at multiple timescales*. This is profoundly similar to how human perception works. We don't evaluate audio sample-by-sample — we perceive it as nested patterns of repetition. A word is a pattern of phonemes. A phrase is a pattern of words. A song section is a pattern of phrases. The MED essentially asks: "Does the generated audio repeat correctly at every level?"

## The Whale That Signs Its Name

Meanwhile, the MD-Audio benchmark reveals something striking about biological sound production. Marine mammal vocalizations are *species-specific* — different species produce sounds at characteristically different frequency ranges, durations, and temporal patterns. The Watkins Marine Mammal Sound Database spans recordings from 600 Hz to 160 kHz, covering 31 species.

Audio-language models struggle badly with this — achieving only 30–50% accuracy on bioacoustic QA despite having billions of parameters. They can recognize broad categories ("this is a whale") but fail at the fine-grained periodic analysis needed to distinguish between closely related species. The models that perform best (Gemini 2.0 Flash at 42% on bioacoustics, AudioFlamingo 2 at 53.9%) likely succeed through better spectral resolution — the ability to detect subtle differences in periodic structure.

The biological parallel to the Snake activation is striking: each species has evolved its own α, its own characteristic frequency of vocalization. A humpback whale's song is a periodic structure at one timescale; a dolphin's clicks are periodic at another. Species identity *is* periodic signature.

## The Compositional Implication

Here's where these threads braid together into something useful for musicians:

**Identity in sound is periodic structure at multiple scales simultaneously.** A violin's identity isn't just its fundamental frequency — it's the specific pattern of harmonics (periodic at the micro-level), the characteristic bow attack and release (periodic at the note level), and the vibrato pattern (periodic at the phrase level). Remove any one of these periodic layers and the violin becomes less itself.

The MED's five-envelope architecture suggests a practical framework for thinking about musical arrangement:

- **Envelope level (Hilbert):** The energy contour — does the piece breathe?
- **Phonemic level (500 Hz):** Individual articulations — do notes have clear onsets?
- **Syllabic level (300 Hz):** Groupings — do notes cluster into meaningful phrases?
- **Signal level:** The raw content — are the pitches and timbres right?

Good arrangement works at all four levels simultaneously. Bad arrangement often gets the signal level right (correct notes, correct instruments) but fails at the envelope level (flat dynamics, no phrasing).

The Snake activation's per-channel learned frequency offers another insight: **effective orchestration means choosing instruments whose characteristic periodicities occupy different α values.** A bass guitar and a kick drum don't clash — their periodicities are complementary. Two instruments with similar α values compete. This is the mathematical shadow of the old orchestration rule: "don't double in the same register unless you want unison."

## The Deeper Pattern

What connects the Snake function, the MED, and the whale's song is that periodicity is not merely a *property* of sound — it's the *mechanism* of recognition. The Snake function can extrapolate because periodicity is inherently predictable. The MED can discriminate because periodicity violations are perceptually salient. The whale can be identified because its species evolved a unique periodic signature under evolutionary pressure.

This suggests that when we compose music, we're not just arranging sounds — we're designing periodic signatures at multiple timescales, and the listener's brain is running something very much like a multi-envelope discriminator, constantly checking whether the patterns of repetition at each level cohere into a recognizable identity.

The RNDVoC paper from earlier this week adds one more piece: the range space of a vocoder (the part that can be computed deterministically from mel-spectrograms) is precisely the periodic structure. The null space — the part that requires neural network creativity — is the aperiodic residual: noise, transients, the breathy component of a voice. Periodicity is what's *known*; aperiodicity is what must be *invented*.

A composer's job, then, is to balance the known (periodic patterns that give a piece identity and recognizability) with the unknown (aperiodic surprises that give it life). Too much periodicity and the music is mechanical. Too little and it's noise. The sweet spot — the place where great music lives — is where periodic structure is strong enough to be recognized but varied enough to be interesting.

The Snake function found this balance mathematically: $x + \frac{1}{\alpha}\sin^2(\alpha x)$. The linear term provides stability and forward progress. The sinusoidal term provides oscillation and memory. Together, they create something that moves forward while looking back — which is, perhaps, the best one-sentence description of how music works.

---

*Sources: BemaGANv2 (Park et al., 2026), MD-Audio benchmark (DCASE 2025), RNDVoC (range-null space decomposition), BigVGAN (Lee et al.), Watkins Marine Mammal Sound Database*
