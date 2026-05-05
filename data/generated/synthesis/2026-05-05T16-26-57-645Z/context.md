# Multi-Source Synthesis Context

Generated at: 2026-05-05T16:26:57.645Z
Selected 4/4 from 12 eligible candidates.

## Selection Parameters

- Fetch limit: 80
- Target selections: 4
- Minimum claims: 2
- Minimum composition parameters: 1
- Cross-run novelty window: 6
- Max reused sources from novelty window: 1
- Require tuning/intonation signal: false

## Novelty History

- Prior runs scanned: 6
- Prior source IDs tracked: 18
- Prior topic tokens tracked: 240
- Prior variable phrases tracked: 3
- Prior title phrases tracked: 2

## Aggregate Signals

### Topic Frequency
- rhythm formant analysis: 1
- amplitude modulation spectrum: 1
- low-frequency modulation: 1
- speech rhythm: 1
- mel frequency cepstral coefficients (mfcc): 1
- discrete cosine transform (dct): 1
- spectral modulation: 1
- acoustic phonetics: 1
- under-resourced languages: 1
- tani language group: 1
- cross-linguistic acoustic differentiation: 1
- hierarchical feature encoding: 1
- temporal structure of sound: 1
- macro-temporal rhythm: 1
- support vector machines for audio classification: 1
- multilayer perceptron audio classification: 1
- wavelet scattering transform: 1
- speech deepfake detection: 1
- acoustic feature extraction: 1
- filterbank design: 1
- multi-scale signal analysis: 1
- spectral anomaly detection: 1
- translation invariance: 1
- deformation stability: 1
- self-supervised learning for audio: 1
- signal processing: 1
- modulus nonlinearity: 1
- synthetic speech artifacts: 1
- audio encoding: 1
- acoustic degradation: 1
- speech perception: 1
- signal compression: 1
- hallucination in generative audio models: 1
- silence as acoustic input: 1
- reverberation: 1
- noise robustness: 1
- accent and acoustic variation: 1
- audio fidelity and representation: 1
- psychoacoustics: 1
- critical band theory: 1
- bark scale: 1
- multiband dynamics processing: 1
- auditory perception: 1
- frequency band decomposition: 1
- audio plugin design: 1
- cochlear frequency resolution: 1
- masking effects: 1
- dynamics compression: 1

### Parameter Type Frequency
- measurement: 10
- frequency: 1

### Evidence Distribution
- preprint: 16
- anecdotal: 2
- peer_reviewed: 1

## Selected Sources

### S1 — Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi: Two Under-Resourced Languages of Arunachal Pradesh

- Source ID: jx78j7ze7qdtvv1jzwvrgwt1as85smq1
- Extraction ID: j97dmcxraattrt4e9gsc7dsp4185rj2e
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.25309
- Scores: base=24.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.925
- Domain relevance: 0.500
- Reuse penalties: source=0.00, topic=0.00
- Topics: rhythm formant analysis, amplitude modulation spectrum, low-frequency modulation, speech rhythm, mel frequency cepstral coefficients (mfcc), discrete cosine transform (dct), spectral modulation, acoustic phonetics, under-resourced languages, tani language group, cross-linguistic acoustic differentiation, hierarchical feature encoding, temporal structure of sound, macro-temporal rhythm, support vector machines for audio classification, multilayer perceptron audio classification

Summary:
This preprint investigates acoustic differentiation between two under-resourced Tani languages (Nyishi and Adi) spoken in Arunachal Pradesh using rhythm formant analysis (RFA) in the frequency domain. The study extracts low-frequency amplitude modulation features from speech signals to characterize speech rhythm, finding that Nyishi exhibits higher dominant modulation frequencies and greater dispersion than Adi. Combining rhythmic features with spectral features (MFCC) yields classification accuracies up to 93.96%, demonstrating that low-frequency modulation and spectral structure encode complementary and hierarchical levels of linguistic variation. The approach treats speech rhythm as a spectral phenomenon analyzable via amplitude modulation in the low-frequency range, which has direct relevance to acoustic and musical analysis frameworks.

Claims:
- [1] [preprint] Speech rhythm can be quantified using low-frequency amplitude modulation (AM) spectrum analysis, where dominant spectral peaks in the LF modulation spectrum ('rhythm formants') encode language-specific rhythmic structure.
- [2] [preprint] Low-frequency amplitude modulation of speech signals captures macro-temporal rhythmic structure, while spectral features (MFCC) reflect finer phonological differentiation — these two domains encode complementary, hierarchical levels of variation.
- [3] [preprint] Rhythm-only low-frequency modulation features can classify two related languages with approximately 84–85% accuracy, suggesting that macro-temporal rhythmic structure alone is substantially language-discriminating.
- [4] [preprint] Fusing low-frequency rhythm formant features with MFCC representations achieves classification accuracy of up to 93.96% (MLP) and 90.9% (SVM), indicating that spectral envelope information substantially augments rhythmic features for acoustic language modeling.
- [5] [preprint] Discrete Cosine Transform (DCT) coefficients can be used to characterize the spectral modulation structure of speech signals, complementing cepstral (MFCC) representations of broad spectral organization.
- [6] [preprint] Nyishi speech exhibits higher dominant modulation frequencies and greater frequency dispersion in the LF amplitude modulation spectrum compared to Adi, indicating a measurably faster or more varied rhythmic pulsation rate.

Composition Parameters:
- frequency: Low-frequency amplitude modulation band (speech rhythm range, typically ~1–10 Hz)
- measurement: Number of Dominant Peaks (NDP) in LF modulation spectrum
- measurement: Mean Frequency of Dominant Peaks (MFDP)
- measurement: Variance of Dominant Frequencies (VFDP)

Open Questions:
- Can rhythm formant analysis (RFA) — developed for speech — be meaningfully applied to musical signals to identify culturally distinct rhythmic 'signatures' or metric tendencies in folk music traditions?
- What is the precise low-frequency range (in Hz) of the dominant AM modulation peaks found in Nyishi vs. Adi, and how do these compare to known musical tempo/meter ranges (e.g., ~0.5–4 Hz for beat perception)?
- Could MFDP and VFDP serve as composition parameters — e.g., mapping mean modulation frequency to tempo or metric density, and VFDP to rhythmic variability / humanization amount?
- How does the DCT-based spectral modulation characterization relate to timbre descriptors used in music information retrieval, and could it serve as a bridge between linguistic and musical acoustic analysis?
- Are there analogous 'rhythm formants' detectable in instrumental music that would encode genre- or style-specific temporal structure the way speech rhythm formants encode language-specific rhythm?
- Could the hierarchical separation of macro-temporal (rhythmic) vs. fine-grained (spectral/timbral) information inspire a layered compositional approach where rhythm and timbre are designed to vary independently across structural levels?
- How might the languages of Arunachal Pradesh, including Nyishi and Adi, influence or be reflected in regional folk music rhythm patterns — is there a correlation between speech rhythm formants and musical rhythm in these communities?

### S2 — WST-X Series: Wavelet Scattering Transform for Interpretable Speech Deepfake Detection

- Source ID: jx78nvpygk3a3ehen35mwswkhd85w0pt
- Extraction ID: j971a4crv4z7nqcz7v24yfgvjh85x5zq
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2602.02980
- Scores: base=19.00, normalized=0.706, intraNovelty=1.000, crossRunNovelty=0.975, topicalBalance=1.000, combined=0.834
- Domain relevance: 0.520
- Reuse penalties: source=0.00, topic=0.08
- Topics: wavelet scattering transform, speech deepfake detection, acoustic feature extraction, filterbank design, multi-scale signal analysis, spectral anomaly detection, translation invariance, deformation stability, self-supervised learning for audio, signal processing, modulus nonlinearity, synthetic speech artifacts

Summary:
This paper proposes WST-X, a feature extraction system for detecting AI-generated (deepfake) speech using the Wavelet Scattering Transform (WST). The WST cascades wavelet convolutions with modulus nonlinearities to produce deformation-stable, multi-scale acoustic representations. The authors find that small temporal averaging scales combined with high frequency and directional resolution are critical for capturing subtle spectral artifacts in synthetic speech. WST-X outperforms both hand-crafted filterbank features and self-supervised learning (SSL) features on multiple benchmarks. The work sits at the intersection of signal processing, acoustics, and machine learning.

Claims:
- [1] [preprint] Hand-crafted filterbank features are transparent but limited in capturing higher-level acoustic information.
- [2] [preprint] Self-supervised learning (SSL) audio features lack interpretability and may overlook fine-grained spectral anomalies.
- [3] [preprint] The Wavelet Scattering Transform produces deformation-stable, multi-scale acoustic features by cascading wavelet convolutions with modulus nonlinearities.
- [4] [preprint] A small temporal averaging scale (J), combined with high frequency resolution (Q) and directional resolution (L), is critical for capturing subtle spectral artifacts in synthetic speech.
- [5] [preprint] Translation-invariant and deformation-stable acoustic representations are valuable for distinguishing real from synthetic speech.

Composition Parameters:
- measurement: J — temporal averaging scale (small values preferred)
- measurement: Q — frequency resolution of wavelet filterbank
- measurement: L — directional resolution in scattering transform

Open Questions:
- Could the Wavelet Scattering Transform's multi-scale, deformation-stable features be useful for analyzing timbral or microtonal nuances in acoustic music performance?
- How does the choice of wavelet basis (e.g., Morlet, Gabor) affect musical feature discrimination compared to its effect on speech deepfake detection?
- What is the perceptual correlate of the 'fine-grained spectral anomalies' that WST captures — could these correspond to audible timbral artifacts in synthesis or digital audio processing?
- Could translation-invariant scattering features offer a more robust representation of musical timbre across transpositions and tempo variations than standard spectrograms?
- Is there a relationship between the WST parameters (J, Q, L) and perceptual dimensions of sound like roughness, sharpness, or brightness?
- Could WST-based features detect subtle artifacts introduced by audio compression codecs or synthesis algorithms in musical production contexts?

### S3 — Do LLM Decoders Listen Fairly? Benchmarking How Language Model Priors Shape Bias in Speech Recognition

- Source ID: jx74r61g2tqd5bcy6aam4aqwes85f9kt
- Extraction ID: j97795a7x76skzbg4d8pcdhpqh85k5zb
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21276
- Scores: base=19.00, normalized=0.706, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=0.964, combined=0.819
- Domain relevance: 0.420
- Reuse penalties: source=0.00, topic=0.00
- Topics: audio encoding, acoustic degradation, speech perception, signal compression, hallucination in generative audio models, silence as acoustic input, reverberation, noise robustness, accent and acoustic variation, audio fidelity and representation

Summary:
This paper benchmarks speech recognition fairness across demographic groups using nine models and ~43,000 utterances. It finds that LLM-based decoders do not amplify racial bias and may outperform older architectures on ethnicity fairness. Critically, audio encoder design — not language model scale — is identified as the primary driver of both bias and robustness. Acoustic degradation conditions reveal pathological hallucination and repetition behaviors in certain architectures, particularly Whisper on accented or silence-injected speech.

Claims:
- [1] [preprint] Audio encoder design is a more significant lever for equitable and robust speech recognition than LLM scaling.
- [2] [preprint] Audio compression quality predicts accent fairness in speech recognition more than language model scale does.
- [3] [preprint] Acoustic degradation (noise, reverberation, silence injection, chunk masking) can paradoxically compress fairness gaps by driving all demographic groups toward uniformly high error rates.
- [4] [preprint] Silence injection as an acoustic manipulation can selectively amplify demographic bias — specifically accent bias — in speech recognition systems by triggering hallucination.
- [5] [preprint] High-compression audio encoding (Q-former architecture) reintroduces pathological repetition behavior even in otherwise robust LLM-based decoders.

Composition Parameters:
- measurement: Insertion rate spike of 9.62% on Indian-accented speech (Whisper large-v3)
- measurement: Silence injection amplifies accent bias up to 4.64x
- measurement: 86% of 51,797 insertions under masking are catastrophic repetitions (Whisper)

Open Questions:
- Does the 'silence injection triggers hallucination' finding have analogs in music generation models — could silence or rest tokens cause generative loops or unexpected outputs?
- How does audio compression codec choice (lossy vs. lossless) affect the downstream perceptual fidelity of AI-assisted music transcription or generation?
- Could the 'convergence under severe degradation' effect be exploited compositionally — using noise or reverberation to flatten timbral or pitch distinctions intentionally?
- What is the acoustic threshold at which a Q-former-style high-compression encoder begins to lose musically significant information (e.g., microtonal distinctions, vibrato, timbre)?
- Are there parallels between demographic-selective hallucination in speech models and genre- or style-selective errors in music transcription AI?
- Could 'catastrophic repetition loops' under masking inform or inspire algorithmic composition techniques involving looping and degraded input signals?

### S4 — New Music Gear Monday: FSK Audio Bark24 &#124; Dyn Psychoacoustic Dynamics Plugin

- Source ID: jx7awge62ymkd5ywnpz9ddyymx85ntkj
- Extraction ID: j977tjh3ka74caprsf86d4e3y185maah
- Type: rss
- Status: extracted
- URL: https://bobbyowsinskiblog.com/new-music-gear-monday-fsk-audio-bark24-dyn-psychoacoustic-dynamics-plugin/
- Scores: base=14.00, normalized=0.412, intraNovelty=1.000, crossRunNovelty=0.940, topicalBalance=0.976, combined=0.780
- Domain relevance: 0.820
- Reuse penalties: source=0.00, topic=0.20
- Topics: psychoacoustics, critical band theory, bark scale, multiband dynamics processing, auditory perception, frequency band decomposition, audio plugin design, cochlear frequency resolution, masking effects, dynamics compression

Summary:
The FSK Audio Bark24 | Dyn is a dynamics plugin that structures its frequency band processing around the Bark scale, a psychoacoustic model of how the human auditory system divides sound into critical bands. The article contrasts this approach with conventional multiband dynamics processors, which use arbitrary crossover points that only approximate human hearing. The implication is that aligning processing bands to perceptually meaningful boundaries produces more natural or musically appropriate results. The content is brief and promotional in nature, with limited technical depth provided in the excerpt.

Claims:
- [1] [anecdotal] Most dynamics processors split audio into frequency bands using arbitrary crossover points that are mathematical approximations of how human hearing actually works.
- [2] [peer_reviewed] Human auditory frequency processing is more nuanced than the band divisions used in conventional multiband dynamics processors.
- [3] [anecdotal] The Bark24 | Dyn plugin bases its band structure on the Bark scale, a psychoacoustic model of auditory critical bands.

Composition Parameters:
- measurement: 24 Bark-scale critical bands

Open Questions:
- How do the 24 Bark-scale critical band boundaries map to specific Hz crossover frequencies, and how do they differ from typical 3- or 5-band dynamic processor crossovers?
- Does processing dynamics within perceptually meaningful critical bands produce measurably different (or listener-preferred) results compared to arbitrary crossover multiband processing?
- Could the Bark scale band structure be used compositionally — e.g., to design spectral dynamics in music that mirror or counteract auditory masking effects?
- How does the Bark scale relate to other psychoacoustic frequency scales (ERB, mel scale) and which is most relevant for musical timbre perception?
- Are there compositional implications to structuring orchestration or synthesis layers along Bark-scale boundaries to maximize perceptual separation of simultaneous sounds?

