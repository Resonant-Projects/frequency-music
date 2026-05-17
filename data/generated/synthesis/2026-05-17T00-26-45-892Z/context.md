# Multi-Source Synthesis Context

Generated at: 2026-05-17T00:26:45.892Z
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
- Prior source IDs tracked: 17
- Prior topic tokens tracked: 240
- Prior variable phrases tracked: 13
- Prior title phrases tracked: 6

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
- timbre: 1
- prosody: 1
- voice synthesis: 1
- speech synthesis: 1
- emotional expression in audio: 1
- identity preservation in voice: 1
- quantization of acoustic features: 1
- flow-matching generative models: 1
- disentanglement of acoustic properties: 1
- hierarchical temporal structure in audio: 1
- text-to-speech: 1
- speaker verification: 1
- speech enhancement: 1
- reverberation: 1
- signal-to-noise ratio: 1
- acoustic degradation: 1
- c50 clarity index: 1
- perceptual audio quality (pesq): 1
- encoder-decoder neural architectures: 1
- representational similarity analysis: 1
- centered kernel alignment (cka): 1
- noise invariance: 1
- skip connections: 1
- audio deep learning: 1
- room acoustics modeling: 1
- auditory perception: 1
- sound source localization: 1
- microphone array processing: 1
- direction-of-arrival estimation: 1
- time-difference of arrival (tdoa): 1
- steered-response power beamforming: 1
- euclidean distance matrices: 1
- gram matrices: 1
- eigenvalue decomposition: 1
- procrustes problem: 1
- room acoustics and reverberation: 1
- spatial audio: 1
- multi-source separation: 1
- bioacoustics: 1
- ultrasonic frequency: 1
- spectral decomposition: 1
- multi-band audio encoding: 1
- frequency bandwidth: 1
- animal vocalizations: 1
- audio classification: 1
- non-human hearing ranges: 1
- nyquist limit: 1
- machine listening: 1
- representation learning: 1
- band fusion strategies: 1

### Parameter Type Frequency
- measurement: 12
- scalesystem: 2
- interval: 2
- frequency: 2
- tuningsystem: 1
- duration: 1

### Evidence Distribution
- preprint: 26
- peer_reviewed: 4

## Selected Sources

### S1 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=0.585, intraNovelty=1.000, crossRunNovelty=0.986, topicalBalance=0.991, combined=0.871
- Domain relevance: 1.000
- Reuse penalties: source=0.00, topic=0.05
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

### S2 — Physicists Discover the Most Complex Forms of Ice Yet

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

### S3 — ATRIE: Adaptive Tuning for Robust Inference and Emotion in Persona-Driven Speech Synthesis

- Source ID: jx762q5tm7md2f9znq4tykwkv985feka
- Extraction ID: j97eq5w6w3a39hr8hv4rhwmgf185j8b3
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19055
- Scores: base=14.00, normalized=0.171, intraNovelty=1.000, crossRunNovelty=0.950, topicalBalance=0.946, combined=0.675
- Domain relevance: 0.620
- Reuse penalties: source=0.00, topic=0.17
- Topics: timbre, prosody, voice synthesis, speech synthesis, emotional expression in audio, identity preservation in voice, quantization of acoustic features, flow-matching generative models, disentanglement of acoustic properties, hierarchical temporal structure in audio, text-to-speech, speaker verification

Summary:
ATRIE is a text-to-speech synthesis framework designed for anime and digital human avatars that separates voice generation into a static timbre component and a dynamic prosody component. It uses a dual-track architecture distilled from a large language model to maintain consistent character identity across varying emotional contexts. The system is evaluated on a benchmark of 50 anime characters and achieves strong performance on speaker verification and cross-modal retrieval tasks. While primarily an engineering paper, it touches on the computational decomposition of voice into timbre and prosody — constructs with deep roots in music theory and acoustics.

Claims:
- [1] [preprint] Voice can be computationally disentangled into a static 'timbre' component and a dynamic 'prosody' component, and these can be modeled and generated independently.
- [2] [preprint] Prosody is a dynamic, time-varying property of speech that can be modeled with hierarchical generative methods (here, flow-matching), suggesting prosody operates across multiple temporal scales simultaneously.
- [3] [preprint] Timbre — the quality that distinguishes voices (or instruments) with the same pitch and loudness — is treatable as a discrete, quantizable, static feature space, implying it has low intrinsic dimensionality.
- [4] [preprint] Emotional expressiveness in synthesized voice is partly a function of prosody rather than timbre, and the two can be varied independently without losing perceived identity.

Composition Parameters:
- measurement: Equal Error Rate (EER) of 0.04 on Zero-Shot Speaker Verification
- measurement: Mean Average Precision (mAP) of 0.75 on cross-modal retrieval

Open Questions:
- If timbre is quantizable (discrete) and prosody is continuous, what does this imply about the perceptual topology of instrumental timbre in acoustic music — can orchestral timbres similarly be discretized into a low-dimensional codebook?
- The paper models prosody hierarchically — what are the relevant temporal scales, and do they map onto musical structures like phoneme → word → phrase → sentence in the same way music maps note → motive → phrase → section?
- Can the timbre/prosody disentanglement principle be applied to musical instrument sound synthesis — separating 'what instrument' (timbre) from 'how it is played' (articulation/dynamics/phrasing)?
- If emotional content is primarily encoded in prosody, what specific prosodic features (pitch contour, rhythm, tempo, loudness envelope) are most responsible — and do these overlap with the parameters composers use to communicate affect?
- Could a similar dual-track architecture be used compositionally to morph between instrument timbres while preserving a melodic prosodic contour, or vice versa?

### S4 — Where Does Speech Enhancement Adapt? Probing Study Under Controlled Degradation

- Source ID: jx764ke9nz50zaqrr0cjsbk149864vyj
- Extraction ID: j975dd9v10rhc7w92v593rqn0986469p
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2512.00482
- Scores: base=19.00, normalized=0.293, intraNovelty=1.000, crossRunNovelty=0.914, topicalBalance=0.975, combined=0.660
- Domain relevance: 0.300
- Reuse penalties: source=0.00, topic=0.29
- Topics: speech enhancement, reverberation, signal-to-noise ratio, acoustic degradation, c50 clarity index, perceptual audio quality (pesq), encoder-decoder neural architectures, representational similarity analysis, centered kernel alignment (cka), noise invariance, skip connections, audio deep learning, room acoustics modeling, auditory perception

Summary:
This paper introduces a probing methodology to study how speech enhancement (SE) models internally represent degraded audio signals under controlled noise and reverberation conditions. Using Centered Kernel Alignment (CKA), the authors measure layer-wise representational similarity across encoder and decoder layers of the MUSE model, finding that encoder layers maintain stable, noise-invariant representations while decoder layers adapt strongly to degradation. The pattern is consistent across reverberation conditions and reproduced by two structurally distinct architectures (MP-SENet and Demucs), suggesting the behavior is driven by the enhancement objective itself rather than model architecture. The study also links internal representations to output perceptual quality metrics such as PESQ.

Claims:
- [1] [preprint] Encoder layers in speech enhancement models maintain noise-invariant representations regardless of input degradation level, while decoder layers adapt strongly to degradation.
- [2] [preprint] The encoder-decoder adaptation asymmetry is architecture-independent, emerging from the enhancement objective itself rather than specific model design choices.
- [3] [preprint] Skip-connection boundaries within neural speech enhancement models mark the sharpest transitions in representational sensitivity to acoustic degradation.
- [4] [preprint] Reverberation (measured via C50) and additive noise (measured via SNR) produce structurally similar patterns of internal adaptation in speech enhancement models.
- [5] [preprint] Internal representational similarity (CKA) in speech enhancement models correlates with output-level perceptual quality metrics such as PESQ.

Composition Parameters:
- measurement: SNR (Signal-to-Noise Ratio) — controlled degradation axis
- measurement: C50 — reverberation clarity index
- measurement: PESQ — Perceptual Evaluation of Speech Quality

Open Questions:
- Could the encoder-decoder adaptation asymmetry found in speech enhancement models inform the design of musical audio restoration or denoising tools — e.g., for archival recordings?
- Does C50 (the reverberation clarity metric) have direct compositional utility as a parameter for designing reverb in musical spaces or algorithmic composition systems?
- If skip-connection boundaries are the sharpest sites of acoustic adaptation, could architecturally analogous structures in music generation models mark similar perceptual phase transitions?
- How do SNR thresholds used in SE research compare to perceptual noise-floor thresholds relevant to live performance or recording contexts?
- Could the CKA-based probing methodology be applied to music source separation models (e.g., Demucs in its musical use case) to understand how they internally represent pitch, timbre, or harmony under degraded conditions?
- Is there a compositional analog to 'noise-invariant encoding' — e.g., harmonic invariants that persist across timbral or dynamic degradation?

### S5 — Multi-Source Position and Direction-of-Arrival Estimation Based on Euclidean Distance Matrices

- Source ID: jx7d318zzcx7e8cd6yrmvrgn7h859g7f
- Extraction ID: j97a8k67pm7ysxbzxb4nt62g85858646
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2510.02556
- Scores: base=14.00, normalized=0.171, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.646
- Domain relevance: 0.300
- Reuse penalties: source=0.00, topic=0.00
- Topics: sound source localization, microphone array processing, direction-of-arrival estimation, time-difference of arrival (tdoa), steered-response power beamforming, euclidean distance matrices, gram matrices, eigenvalue decomposition, procrustes problem, room acoustics and reverberation, spatial audio, multi-source separation

Summary:
This arXiv preprint proposes new algorithms for estimating the positions and directions-of-arrival (DOAs) of multiple sound sources using microphone arrays, based on Euclidean Distance Matrices (EDMs) and their Gram matrices. The core insight is that exploiting EDM properties reduces the dimensionality of the optimization problem compared to steered-response power (SRP) beamforming — from three continuous variables to one per source for position estimation, and to zero for DOA estimation. The methods rely on estimated time-differences of arrival (TDOAs) between microphones and minimize cost functions defined over eigenvalues of Gram matrices. Experimental results with six microphones in noisy and reverberant environments show the EDM-based approach outperforms SRP-based methods in both accuracy and computational speed.

Claims:
- [1] [preprint] Steered-response power (SRP) beamforming for 3D sound source localization requires joint optimization of three continuous variables for position estimation, making it computationally expensive at high accuracy.
- [2] [preprint] Exploiting Euclidean Distance Matrix properties reduces multi-source position estimation to optimizing only one continuous variable per source (distance to a reference microphone), rather than three.
- [3] [preprint] The proposed EDM-based DOA estimation method eliminates continuous variable optimization entirely, determining the optimal TDOA candidate set through eigenvalue-based cost minimization on a rank-reduced Gram matrix.
- [4] [preprint] In noisy and reverberant acoustic environments, the EDM-based method consistently outperforms SRP-based methods for both position and direction-of-arrival estimation accuracy, as well as run time, across different two-source and six-microphone configurations.

Composition Parameters:
- measurement: 6 microphones (array size)
- measurement: 2 simultaneous sound sources

Open Questions:
- Could EDM-based localization methods be applied in real-time compositional systems where microphone arrays track performer positions in a concert space?
- How does TDOA-based spatial analysis relate to psychoacoustic models of spatial hearing, such as interaural time differences (ITD)?
- Could rank-reduced Gram matrix eigenvalue analysis reveal perceptually meaningful structure in reverberant acoustic spaces — e.g., room modes or resonant nodes?
- Can this framework be extended to distinguish timbral or spectral sources, not just spatial ones, enabling frequency-based source separation useful for composition tools?
- Is there a mathematical relationship between the Euclidean Distance Matrix formalism here and the geometry of harmonic interval space (e.g., Tonnetz or pitch-class lattices)?

### S6 — Beyond the Baseband: Adaptive Multi-Band Encoding for Full-Spectrum Bioacoustics Classification

- Source ID: jx78jqe2mp7zwykmbywha3mzrs85xyys
- Extraction ID: j97f936205f9pg3twz7926pw7h85xz2e
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.27936
- Scores: base=14.00, normalized=0.171, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=0.985, combined=0.644
- Domain relevance: 0.300
- Reuse penalties: source=0.00, topic=0.00
- Topics: bioacoustics, ultrasonic frequency, spectral decomposition, multi-band audio encoding, frequency bandwidth, animal vocalizations, audio classification, non-human hearing ranges, nyquist limit, machine listening, representation learning, band fusion strategies

Summary:
This preprint investigates a multi-band encoding framework for classifying animal vocalizations across their full frequency spectrum, including ultrasonic ranges. Most existing computational bioacoustics systems are limited to 0–8 kHz because they use audio models pre-trained at 16 kHz, discarding higher-frequency information. The authors decompose animal calls into band-specific features and fuse them into a unified representation. Experiments across three datasets and eight pre-trained models show that fused multi-band representations consistently outperform single-band baselines, suggesting that spectral decomposition and fusion is a productive strategy for full-spectrum audio encoding.

Claims:
- [1] [preprint] Most computational bioacoustics systems rely on audio models pre-trained at 16 kHz, restricting usable bandwidth to the 0–8 kHz baseband and discarding higher-frequency information present in many bioacoustic recordings.
- [2] [preprint] Animals hear and vocalize across frequency ranges that extend substantially beyond the human range, often into the ultrasonic domain.
- [3] [preprint] Certain encoder architectures produce decorrelated band embeddings — representations of different frequency bands that are statistically independent — and this decorrelation improves class separation after multi-band fusion.
- [4] [preprint] Fused multi-band representations consistently outperform both the 0–8 kHz baseband baseline and time-expansion baselines on two of three tested bioacoustic datasets.

Composition Parameters:
- frequency: 16 kHz sample rate (Nyquist limit: 8 kHz)
- frequency: 0–8 kHz baseband

Open Questions:
- What is the upper frequency limit of the multi-band framework, and does it extend fully into the ultrasonic range (>20 kHz)? What implications does this have for composition with ultrasonic material?
- Could decorrelated multi-band embedding strategies (as used here for classification) inform spectral composition techniques — e.g., designing musical textures where frequency bands are perceptually or mathematically independent?
- Human hearing nominally extends to ~20 kHz; are there musical or psychoacoustic effects from sound energy just above or below this threshold that are routinely discarded by 16 kHz audio pipelines?
- Time-expansion is a common technique for analyzing ultrasonic bat calls by slowing them down to audible ranges — could this technique be aesthetically productive as a compositional tool for transposing non-human vocalizations into human perceptual space?
- What fusion strategies were tested, and do any of them correspond to known psychoacoustic models of how the human auditory system integrates across critical bands?

