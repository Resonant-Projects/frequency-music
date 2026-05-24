# Multi-Source Synthesis Context

Generated at: 2026-05-20T16:26:49.940Z
Selected 6/6 from 32 eligible candidates.

## Selection Parameters

- Fetch limit: 250
- Target selections: 6
- Minimum claims: 1
- Minimum composition parameters: 1
- Cross-run novelty window: 6
- Max reused sources from novelty window: 1
- Require tuning/intonation signal: false

## Novelty History

- Prior runs scanned: 6
- Prior source IDs tracked: 32
- Prior topic tokens tracked: 366
- Prior variable phrases tracked: 22
- Prior title phrases tracked: 12

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
- speech synthesis: 1
- prosody modeling: 1
- audio tokenization: 1
- text-to-speech alignment: 1
- streaming audio generation: 1
- audio-visual synchronization: 1
- temporal grounding: 1
- multilingual speech: 1
- emotional speech synthesis: 1
- omnimodal ai: 1
- audio understanding at scale: 1
- speech tokenizers: 1
- acoustic-linguistic encoding: 1
- neural speech codecs: 1
- ultra-low bitrate audio compression: 1
- speech intelligibility: 1
- acoustic reconstruction loss: 1
- reinforcement learning for audio: 1
- perceptual quality vs. intelligibility tradeoff: 1
- quantization in audio coding: 1
- word error rate as an acoustic metric: 1
- bandwidth-constrained communication: 1
- auditory perception and encoding: 1
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
- periodicity: 1
- self-organization: 1
- metastability: 1
- phase transitions: 1
- ostwald's step rule: 1
- crystallography: 1
- emergence: 1
- path-dependence: 1
- structural complexity: 1
- mathematical vs. physical realizability: 1
- symmetry: 1
- repeating unit cells: 1
- thermodynamic optimization vs. accessibility: 1
- timescale sensitivity: 1
- tonnetz: 1
- combinatorial geometry: 1
- music theory formalization: 1
- diatonic harmony: 1
- voice leading: 1
- pentatonic scales: 1
- 12-tone system: 1
- fano configuration: 1
- desargues configuration: 1
- cremona-richmond configuration: 1
- levi graphs: 1
- bipartite graphs: 1
- major: 1
- minor duality: 1
- tristan chord: 1
- dominant seventh chords: 1
- half-diminished seventh chords: 1
- pitch class sets: 1
- hexacycles: 1
- graph theory in music: 1
- neo-riemannian theory: 1

### Parameter Type Frequency
- measurement: 17
- duration: 3
- scalesystem: 2
- interval: 2
- frequency: 1
- tuningsystem: 1

### Evidence Distribution
- preprint: 29
- peer_reviewed: 4

## Selected Sources

### S1 — Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi: Two Under-Resourced Languages of Arunachal Pradesh

- Source ID: jx78j7ze7qdtvv1jzwvrgwt1as85smq1
- Extraction ID: j97dmcxraattrt4e9gsc7dsp4185rj2e
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.25309
- Scores: base=24.00, normalized=0.415, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.749
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

### S2 — Qwen3.5-Omni Technical Report

- Source ID: jx7dc14cbm6v0cme1ymrv0mmzd8567ga
- Extraction ID: j976p8wbe356x1qy5xtvfsjvvs856gj1
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.15804
- Scores: base=22.00, normalized=0.366, intraNovelty=1.000, crossRunNovelty=0.908, topicalBalance=0.963, combined=0.727
- Domain relevance: 0.620
- Reuse penalties: source=0.00, topic=0.31
- Topics: speech synthesis, prosody modeling, audio tokenization, text-to-speech alignment, streaming audio generation, audio-visual synchronization, temporal grounding, multilingual speech, emotional speech synthesis, omnimodal ai, audio understanding at scale, speech tokenizers, acoustic-linguistic encoding

Summary:
Qwen3.5-Omni is a large-scale multimodal AI model trained on over 100 million hours of audio-visual content, capable of understanding and generating speech across 10 languages with emotional nuance. The paper introduces ARIA, a system that dynamically aligns text and speech tokenization units to improve prosody and stability in streaming speech synthesis. The model supports extended audio understanding (10+ hours) and audio-visual grounding with temporal synchronization. While primarily an AI systems paper, it touches on speech synthesis, prosody modeling, and the acoustic-linguistic boundary between text and speech tokenization — areas with potential relevance to computational music and sound design.

Claims:
- [1] [preprint] Streaming speech synthesis suffers from instability and unnaturalness caused by encoding efficiency discrepancies between text and speech tokenizers.
- [2] [preprint] Dynamic alignment of text and speech units can significantly enhance prosody and stability in conversational speech synthesis with minimal latency impact.
- [3] [preprint] Multilingual speech generation can be achieved with human-like emotional nuance across 10 languages within a single unified model.
- [4] [preprint] Audio-visual grounding capable of generating script-level structured captions with precise temporal synchronization suggests that temporal alignment between auditory and visual streams is computationally tractable at scale.
- [5] [preprint] Omnimodal models trained at scale appear to spontaneously develop the ability to perform coding tasks from audio-visual instructions, suggesting emergent cross-modal competencies not explicitly trained.

Composition Parameters:
- duration: 10+ hours of continuous audio understanding
- duration: 400 seconds of 720P video at 1 FPS
- measurement: 256k token context length
- measurement: 100 million hours of audio-visual training data

Open Questions:
- What specific acoustic features (pitch contour, timbre, rhythm) are most sensitive to text-speech tokenizer misalignment, and can these be mapped to musical parameters?
- Can the ARIA alignment mechanism be applied to music synthesis, where note duration and lyric syllable encoding face analogous efficiency discrepancies?
- How does the model represent emotional nuance in speech — is it encoded in prosodic features (F0, timing, energy) that have direct analogues in musical expression?
- Could audio-visual temporal synchronization techniques from this model be used to align generative music with visual scenes in compositional tools?
- What does 'human-like emotional nuance' mean quantitatively — are there measurable acoustic correlates used as training targets that could inform emotionally expressive music generation?
- Is there a musical analogue to 'Audio-Visual Vibe Coding' — i.e., generating musical notation or code from audio-visual performance input — and how might emergent capabilities enable this?
- At what scale of audio training data do emergent prosodic or musical structure capabilities appear, and is 100 million hours a meaningful threshold?

### S3 — ClariCodec: Optimising Neural Speech Codes for 200bps Communication using Reinforcement Learning

- Source ID: jx7ctrab09mtbkdbghq2qqhm75851vkc
- Extraction ID: j9793cmwt6f6t1s819xdqpay7x854g86
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.14654
- Scores: base=20.00, normalized=0.317, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.723
- Domain relevance: 0.520
- Reuse penalties: source=0.00, topic=0.00
- Topics: neural speech codecs, ultra-low bitrate audio compression, speech intelligibility, acoustic reconstruction loss, reinforcement learning for audio, perceptual quality vs. intelligibility tradeoff, quantization in audio coding, word error rate as an acoustic metric, bandwidth-constrained communication, auditory perception and encoding

Summary:
ClariCodec is a neural speech codec designed for ultra-low bitrate communication (200 bps) that uses reinforcement learning to optimize for speech intelligibility rather than acoustic reconstruction fidelity. The system reformulates quantization as a stochastic policy, allowing RL-based rewards driven by word error rate (WER) to fine-tune the encoder while keeping the acoustic reconstruction pipeline frozen. Without RL, it achieves 3.68% WER on LibriSpeech test-clean; with RL fine-tuning, WER drops to 3.20% (test-clean) and 8.93% (test-other), a 13% relative reduction. This work highlights a fundamental tension between perceptual detail and intelligibility at extreme compression ratios. The approach is relevant to acoustics and audio engineering communities interested in how speech information is prioritized under severe bandwidth constraints.

Claims:
- [1] [preprint] Codecs trained with acoustic reconstruction losses tend to allocate bits to perceptual detail rather than intelligibility at ultra-low bitrates, leading to substantial degradation in word error rate.
- [2] [preprint] At 200 bps, neural speech codecs can achieve intelligibility comparable to codecs operating at higher bitrates, suggesting that intelligibility and bitrate are not strictly coupled above a certain threshold.
- [3] [preprint] Reinforcement learning fine-tuning using WER-driven rewards can reduce word error rate by approximately 13% relative without degrading perceptual quality, even when applied only to the encoder with a frozen decoder.
- [4] [preprint] Intelligibility and perceptual quality (acoustic detail) are separable objectives in speech coding, and can be independently optimized to some degree through targeted training signals.

Composition Parameters:
- measurement: 200 bps (bits per second)
- measurement: 3.68% Word Error Rate (baseline, test-clean)
- measurement: 3.20% Word Error Rate (RL fine-tuned, test-clean)
- measurement: 8.93% Word Error Rate (RL fine-tuned, test-other)

Open Questions:
- Is there a minimum bitrate threshold below which no amount of intelligent bit allocation can preserve phonemic intelligibility in natural speech?
- Can the intelligibility-vs-perceptual-quality tradeoff identified here be mapped onto historical debates in musical tuning and timbre — e.g., does optimizing for 'intelligibility' in music (melodic contour, rhythm) similarly sacrifice timbral richness?
- Could RL-driven reward shaping based on perceptual metrics (e.g., roughness, brightness, consonance) be used to train audio codecs or synthesizers that optimize for specific musical aesthetic properties?
- What is the acoustic information-theoretic minimum for encoding a musical phrase at a given level of recognizability, and how does this compare to speech?
- How do underwater or satellite acoustic channel constraints compare to the constraints of rooms or concert halls in terms of their effect on musical intelligibility and timbre?
- Could the frozen-decoder / fine-tuned-encoder paradigm be applied to music generation models to steer output toward specific harmonic or rhythmic properties without retraining the full model?

### S4 — WST-X Series: Wavelet Scattering Transform for Interpretable Speech Deepfake Detection

- Source ID: jx78nvpygk3a3ehen35mwswkhd85w0pt
- Extraction ID: j971a4crv4z7nqcz7v24yfgvjh85x5zq
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2602.02980
- Scores: base=19.00, normalized=0.293, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.716
- Domain relevance: 0.520
- Reuse penalties: source=0.00, topic=0.00
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

### S5 — Physicists Discover the Most Complex Forms of Ice Yet

- Source ID: jx7402s3g0ndbjwmfh8qnpvd9n85ndzb
- Extraction ID: j97dwcq0crkhg0n8z2tmyqypfd86f0ny
- Type: rss
- Status: extracted
- URL: https://www.quantamagazine.org/physicists-discover-the-most-complex-forms-of-ice-yet-20260427/
- Scores: base=48.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=1.000, combined=0.708
- Domain relevance: 0.520
- Reuse penalties: source=1.00, topic=1.00
- Topics: periodicity, self-organization, metastability, phase transitions, ostwald's step rule, crystallography, emergence, path-dependence, structural complexity, mathematical vs. physical realizability, symmetry, repeating unit cells, thermodynamic optimization vs. accessibility, timescale sensitivity

Summary:
Physicists have recently discovered three new phases of ice (including ice XXI with 152 molecules per repeating unit and ice XXII with 304), revealing that water's phase transitions often proceed through metastable intermediate states rather than jumping directly to the most thermodynamically stable configuration. This behavior is described by Ostwald's step rule, which suggests systems transition to the nearest accessible state rather than the optimal one. The article focuses on extreme-pressure crystallography and has limited direct relevance to music or acoustics, though it contains structural and mathematical concepts — periodicity, complex repeating units, self-organization — that may carry metaphorical or compositional fertility.

Claims:
- [1] [peer_reviewed] Complex ordered structures can appear almost random at fine scale but reveal clear periodicity when viewed macroscopically — a property demonstrated by ice XXI's 152-molecule repeating unit.
- [2] [peer_reviewed] Ostwald's step rule proposes that transitioning systems move to the nearest and easiest-to-reach state rather than the most stable one, and may become stuck in metastable configurations — a principle that applies beyond ice to crystals generally.
- [3] [peer_reviewed] The rate and path of compression (speed, direction, timescale) determines which structural phase a system arrives at — small changes in process yield qualitatively different emergent forms.
- [4] [peer_reviewed] A 2018 computer simulation predicted over 75,000 possible molecular configurations of water, illustrating that the space of mathematically valid periodic structures vastly exceeds those that actually form in nature.
- [5] [preprint] Ice XXII has a repeating structural unit of 304 molecules, making it the most complex crystalline phase of water yet observed — discovered as a 'nearby' phase during re-creation of ice XXI.

Composition Parameters:
- measurement: 152 molecules per repeating structural unit (ice XXI)
- measurement: 304 molecules per repeating structural unit (ice XXII)
- measurement: ~15 distinct X-ray scattering directions from ice XXI
- duration: Tens of milliseconds (metastable phase window)
- measurement: 3.4 km electron acceleration tunnel (European XFEL)
- measurement: ~500 degrees Celsius (plastic ice VII formation temperature)

Open Questions:
- Can Ostwald's step rule be applied as a compositional algorithm — where harmonic or timbral progressions move to the 'nearest accessible' state rather than the most resolved one, creating chains of quasi-stable plateaus?
- The ratio 304:152 = 2:1 (ice XXII to ice XXI) mirrors the octave relationship in frequency. Are there other natural crystalline systems where structural complexity doubles in ways that parallel musical interval ratios?
- Ice XXI's 152-molecule unit (8 × 19) and ice XXII's 304-molecule unit (16 × 19) both contain the prime factor 19. Could prime-factored rhythmic cycles based on these numbers produce interesting polyrhythmic tension analogous to the structural tension between ice phases?
- The 'almost random at fine scale, periodic at macro scale' property of ice XXI mirrors certain stochastic music techniques (e.g., Xenakis). Is there a formal analogy between crystallographic complexity metrics and measures of musical texture density?
- X-ray diffraction 'scattering directions' are essentially a frequency-domain representation of spatial periodicity. Could crystallographic diffraction patterns be directly sonified — mapping scattering angle to pitch and intensity to amplitude?
- If rate and direction of compression determine which ice phase forms, what is the musical analog? Does the rate of harmonic change (voice leading velocity) determine which attractor state a piece 'crystallizes' into?
- The simulation predicted 75,000 phases but most are physically unrealizable. Is there a compositional parallel in generative systems — vast theoretical possibility spaces that collapse to a small set of perceptually stable forms under real constraints?
- Plastic ice VII forms at ~500°C under high pressure — stable only under extreme simultaneous conditions. Are there musical structures that are only coherent when multiple extreme parameters co-occur (e.g., very fast tempo + very high register + specific tuning)?
- The 'will-o'-the-wisp' ice IV phase is so elusive it has folkloric associations. Are there analogous musical structures — theoretically described but rarely achieved in practice — that could be targeted compositionally?

### S6 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=0.585, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=0.996, combined=0.655
- Domain relevance: 1.000
- Reuse penalties: source=1.00, topic=1.00
- Topics: tonnetz, combinatorial geometry, music theory formalization, diatonic harmony, voice leading, pentatonic scales, 12-tone system, fano configuration, desargues configuration, cremona-richmond configuration, levi graphs, bipartite graphs, major, minor duality, tristan chord, dominant seventh chords, half-diminished seventh chords, pitch class sets, hexacycles, graph theory in music, neo-riemannian theory

Summary:
This arXiv preprint develops a formal mathematical framework connecting musical harmony to combinatorial geometry through the concept of the Tonnetz (tone network). The authors demonstrate that various musical systems — including diatonic triads, diatonic seventh chords, pentatonic scales, and the 12-tone system — each correspond to specific combinatorial configurations (e.g., Fano, Desargues, Cremona-Richmond). A key result is that the Eulerian tonnetz maps to a Daublebsky von Sterneck D222 configuration, and that this same structure describes the relationship between chromatic pitch classes and major triads. The paper also addresses the major/minor triad duality, showing it can be 'broken' by identifying minor triads with hexacycles in the Levi graph of the D222 configuration. The work frames music theory as an instance of abstract combinatorial geometry, offering these structures as explicit resources for composition.

Claims:
- [1] [preprint] The Eulerian tonnetz can be represented by a {12_3} combinatorial configuration of Daublebsky von Sterneck type D222.
- [2] [preprint] The tonnetz for Tristan-genus chords (dominant sevenths and half-diminished sevenths) can be represented by a {12_3} combinatorial configuration of type D228.
- [3] [preprint] The seven diatonic degrees and their pitch classes are related by a bipartite graph of type {7_3} with girth four.
- [4] [preprint] The voice-leading relations between diatonic seventh chords are completely characterized by a Fano configuration {7_3}.
- [5] [preprint] A tonnetz for pentatonic music can be constructed based on the Desargues configuration {10_3}.
- [6] [preprint] A tonnetz for the 12-tone system can be constructed based on the Cremona-Richmond configuration {15_3}, and can serve as a compositional resource.
- [7] [preprint] The relationship between the chromatic pitch class set and the major triad set is represented by the same D222 configuration as the Eulerian tonnetz.
- [8] [preprint] Minor triads correspond one-to-one with a certain class of hexacycles in the Levi graph of the D222 configuration, allowing the major/minor duality of the traditional tonnetz to be broken.

Composition Parameters:
- scaleSystem: Diatonic (7-note) scale
- scaleSystem: Pentatonic (5-note) scale
- tuningSystem: 12-tone equal/chromatic system
- interval: Tristan-genus chords: dominant seventh and half-diminished seventh
- interval: Diatonic seventh chords

Open Questions:
- Can the Desargues {10_3} pentatonic tonnetz be used to generate novel voice-leading rules analogous to those derived from the Fano configuration for diatonic seventh chords?
- What are the perceptual or acoustic correlates of navigating paths through the Cremona-Richmond {15_3} 12-tone tonnetz — do certain paths correspond to recognizable harmonic progressions?
- Since minor triads are modeled as hexacycles rather than as dual objects to major triads in this framework, what new compositional symmetries or asymmetries does this asymmetric treatment enable?
- Are there analogous combinatorial configurations for microtonal or non-Western tuning systems (e.g., 19-TET, 31-TET, maqam scales)?
- How does the D228 configuration for Tristan-genus chords relate acoustically to the harmonic series — is the dominant seventh's proximity to just intonation ratios reflected in the geometry?
- Can these abstract graph structures be directly sonified or mapped to generative composition algorithms, and if so, what traversal strategies (e.g., Hamiltonian paths, shortest paths) yield musically coherent results?
- What is the relationship between the girth-four constraint of the diatonic triad bipartite graph and perceptual properties like harmonic ambiguity or voice-leading efficiency?

