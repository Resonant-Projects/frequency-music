# Multi-Source Synthesis Context

Generated at: 2026-05-10T08:26:53.066Z
Selected 6/6 from 26 eligible candidates.

## Selection Parameters

- Fetch limit: 200
- Target selections: 6
- Minimum claims: 1
- Minimum composition parameters: 1
- Cross-run novelty window: 6
- Max reused sources from novelty window: 2
- Require tuning/intonation signal: false

## Novelty History

- Prior runs scanned: 6
- Prior source IDs tracked: 25
- Prior topic tokens tracked: 345
- Prior variable phrases tracked: 25
- Prior title phrases tracked: 12

## Aggregate Signals

### Topic Frequency
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
- stem retrieval: 1
- audio representation learning: 1
- pitch equivariance: 1
- phase equivariance: 1
- spectral pooling: 1
- complex-valued neural networks: 1
- contrastive learning: 1
- beat tracking: 1
- chord recognition: 1
- musical coherence perception: 1
- source separation: 1
- temporal audio structure: 1
- music information retrieval: 1
- call and response: 1
- timbral layering: 1
- eastern scales and non-western tonality in electronic music: 1
- tension and release in melodic phrasing: 1
- analog synthesis (monark: 1
- minimoog modeling): 1
- sample manipulation: 1
- hybrid synthesis workflows: 1
- club music vs. symphonic complexity: 1
- contrast as compositional principle: 1
- silence as compositional element: 1
- expressive identity vs. technical perfection: 1
- daw session versioning and archiving: 1
- world percussion libraries: 1
- melodic dialogue between instrument layers: 1

### Parameter Type Frequency
- measurement: 9
- timbralsource: 4
- scalesystem: 2
- interval: 2
- tuningsystem: 1
- structuralpattern: 1

### Evidence Distribution
- preprint: 23
- anecdotal: 9
- peer_reviewed: 1

## Selected Sources

### S1 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=0.990, combined=0.778
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

### S2 — WST-X Series: Wavelet Scattering Transform for Interpretable Speech Deepfake Detection

- Source ID: jx78nvpygk3a3ehen35mwswkhd85w0pt
- Extraction ID: j971a4crv4z7nqcz7v24yfgvjh85x5zq
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2602.02980
- Scores: base=19.00, normalized=0.500, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.778
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

### S3 — New Music Gear Monday: FSK Audio Bark24 &#124; Dyn Psychoacoustic Dynamics Plugin

- Source ID: jx7awge62ymkd5ywnpz9ddyymx85ntkj
- Extraction ID: j977tjh3ka74caprsf86d4e3y185maah
- Type: rss
- Status: extracted
- URL: https://bobbyowsinskiblog.com/new-music-gear-monday-fsk-audio-bark24-dyn-psychoacoustic-dynamics-plugin/
- Scores: base=14.00, normalized=0.292, intraNovelty=1.000, crossRunNovelty=0.940, topicalBalance=0.981, combined=0.744
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

### S4 — Do LLM Decoders Listen Fairly? Benchmarking How Language Model Priors Shape Bias in Speech Recognition

- Source ID: jx74r61g2tqd5bcy6aam4aqwes85f9kt
- Extraction ID: j97795a7x76skzbg4d8pcdhpqh85k5zb
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21276
- Scores: base=19.00, normalized=0.500, intraNovelty=1.000, crossRunNovelty=0.910, topicalBalance=0.972, combined=0.739
- Domain relevance: 0.420
- Reuse penalties: source=0.00, topic=0.30
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

### S5 — PHALAR: Phasors for Learned Musical Audio Representations

- Source ID: jx7fk4jg1jw1mbsnkfk8fckn01869sfn
- Extraction ID: j978zvv39t3wqdw578e6g057b18683jf
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2605.03929
- Scores: base=16.00, normalized=0.375, intraNovelty=1.000, crossRunNovelty=0.977, topicalBalance=0.993, combined=0.734
- Domain relevance: 0.520
- Reuse penalties: source=0.00, topic=0.08
- Topics: stem retrieval, audio representation learning, pitch equivariance, phase equivariance, spectral pooling, complex-valued neural networks, contrastive learning, beat tracking, chord recognition, musical coherence perception, source separation, temporal audio structure, music information retrieval

Summary:
PHALAR is a contrastive machine learning framework for stem retrieval — matching missing audio stems to a given submix — that achieves up to ~70% relative accuracy improvement over prior state-of-the-art while using fewer than half the parameters and training 7× faster. Its key innovation is enforcing pitch-equivariance and phase-equivariance through a Learned Spectral Pooling layer and a complex-valued head, meaning the model is explicitly sensitive to frequency shifts and phase relationships in audio. The system is evaluated on three datasets (MoisesDB, Slakh, ChocoChorales) and correlates more strongly with human coherence judgments than semantic baseline models. Zero-shot beat tracking and chord probing experiments suggest the learned representations capture generalizable musical structure beyond the retrieval task.

Claims:
- [1] [preprint] Temporal information is a key limiting factor in current stem retrieval models, and discarding it degrades performance.
- [2] [preprint] Enforcing pitch-equivariance and phase-equivariance as inductive biases in audio representations significantly improves stem retrieval accuracy.
- [3] [preprint] Phase information in audio representations correlates with human judgments of musical coherence more strongly than semantic (phase-discarding) baselines.
- [4] [preprint] A single trained audio representation model can capture beat-level temporal structure and harmonic/chord structure simultaneously, without task-specific fine-tuning.
- [5] [preprint] Model efficiency (parameter count, training speed) and representational quality are not in tension for audio tasks — PHALAR achieves both simultaneously.

Composition Parameters:
- measurement: ~70% relative accuracy improvement over state-of-the-art
- measurement: 7× training speedup

Open Questions:
- What specific role does phase information play in human perception of musical coherence, and can this be studied psychoacoustically independent of ML models?
- Could pitch-equivariant representations be used compositionally — e.g., to find stems that 'belong together' harmonically across different keys?
- Does phase-equivariance in learned representations correspond to any classical acoustical or psychoacoustic principle (e.g., phase deafness at low frequencies)?
- Can zero-shot beat tracking quality serve as a proxy metric for how 'musically meaningful' a general audio embedding is?
- How does the Learned Spectral Pooling layer relate to classical filterbank designs (mel, Bark, ERB) — does it converge to similar frequency resolutions?
- Would phase-preserving representations improve tasks like microtiming analysis or groove detection, where small temporal deviations carry musical meaning?

### S6 — Building dialogue in electronic music with Kontakt, Monark, and David Mayer

- Source ID: jx7a6svn6bw13mgz33j5pjf73h85dp8c
- Extraction ID: j9792ckdpne6ycbt2nwccy5b7185d3rp
- Type: rss
- Status: extracted
- URL: https://blog.native-instruments.com/david-mayer/
- Scores: base=29.00, normalized=0.917, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=1.000, combined=0.701
- Domain relevance: 0.640
- Reuse penalties: source=1.00, topic=1.00
- Topics: call and response, timbral layering, eastern scales and non-western tonality in electronic music, tension and release in melodic phrasing, analog synthesis (monark, minimoog modeling), sample manipulation, hybrid synthesis workflows, club music vs. symphonic complexity, contrast as compositional principle, silence as compositional element, expressive identity vs. technical perfection, daw session versioning and archiving, world percussion libraries, melodic dialogue between instrument layers

Summary:
David Mayer discusses his production process for 'News Flash,' a track built around an Eastern-leaning lead sampled and manipulated in Kontakt. He describes a hybrid workflow combining Kontakt for textural, expressive realism and Monark for analog bass grit. Central to his compositional philosophy is the principle of 'call and response,' which he applies at the level of beats, melodic phrases, and arrangement sections. He also explores the tension between club functionality and symphonic layering, seeking to embed emotional complexity within dance music structures. The article is a promotional interview with Native Instruments and carries no academic or scientific rigor.

Claims:
- [1] [anecdotal] The 'call and response' structural principle — alternating tension between a calling phrase and an answering phrase — can be applied at multiple levels: individual beats, melodic intervals, bassline/arpeggio pairings, and macro arrangement sections.
- [2] [anecdotal] Contrast between uplifting rhythmic elements and moody harmonic/melodic elements (e.g., uplifting beats vs. moody synth lines) is a functional compositional strategy for maintaining tension and emotional movement in electronic dance music.
- [3] [anecdotal] Layering multiple differently-timbred presets or patches simultaneously can produce a composite sound perceived as more unique and expressive than any single source patch.
- [4] [anecdotal] Eastern-leaning melodic phrasing (scales, ornaments, or timbres associated with non-Western musical traditions) can create a distinctive atmospheric tension-and-release quality within a Western electronic club music context.
- [5] [anecdotal] Preserving and referencing an early 'demo' version of a track throughout the production process can help a producer maintain the original emotional quality and avoid over-refinement that erodes expressive distinctiveness.
- [6] [anecdotal] Silence and dynamic negative space ('the loud parts answered by the silent parts') function as compositional elements equivalent in weight to sounding material within an arrangement.
- [7] [anecdotal] It is possible to embed symphonic harmonic complexity (dense layering, emotionally contoured progressions) within a club-functional track structure without sacrificing dancefloor impact.

Composition Parameters:
- timbralSource: Kontakt sampler — manipulated world/ethnic sample (Eastern-leaning lead)
- timbralSource: Monark analog-modeled synthesizer — bass parts
- timbralSource: Abbey Road Modern Drummer (Kontakt library) — cymbal layering
- timbralSource: West Africa / Cuba Kontakt libraries — percussion fills
- structuralPattern: Call and response — alternating tension/release at beat, phrase, and section levels

Open Questions:
- What specific scales, modes, or ornamental techniques characterize 'Eastern-leaning' leads in electronic club music, and how do they map onto Western equal temperament or require microtonal deviation?
- Is there measurable perceptual evidence that call-and-response phrasing at multiple structural levels (beat, phrase, section) increases listener engagement or emotional arousal compared to non-dialogic structures?
- At what point does timbral layering of multiple patches begin to produce perceptual fusion (a single new timbre) vs. auditory stream segregation (multiple distinct sources)? What determines that threshold?
- Can the tension between 'Eastern-leaning' melodic material and Western four-on-the-floor rhythm be analyzed in terms of polymodality or rhythmic/melodic cultural counterpoint?
- What is the relationship between dynamic contrast (loud/silent alternation) and perceived groove or dancefloor functionality in electronic music?
- How do Monark's analog-modeled filter and oscillator characteristics differ acoustically from Kontakt-sampled bass tones, and what compositional roles does each serve best?
- Is there a compositional framework for quantifying 'symphonic density' (harmonic layers, voice count, timbral complexity) within club tracks without exceeding a functional loudness or frequency-masking threshold?

