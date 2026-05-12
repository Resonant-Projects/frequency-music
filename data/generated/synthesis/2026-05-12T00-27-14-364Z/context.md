# Multi-Source Synthesis Context

Generated at: 2026-05-12T00:27:14.364Z
Selected 6/6 from 27 eligible candidates.

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
- Prior source IDs tracked: 26
- Prior topic tokens tracked: 342
- Prior variable phrases tracked: 18
- Prior title phrases tracked: 12

## Aggregate Signals

### Topic Frequency
- computational musicology: 2
- voice leading: 2
- audio watermarking: 1
- stft phase manipulation: 1
- frequency-domain encoding: 1
- perceptual audio quality: 1
- deepfake audio detection: 1
- cryptographic audio signing: 1
- reed-solomon error correction in audio: 1
- log-magnitude spectral differences: 1
- lossy audio compression artifacts: 1
- psychoacoustics of phase perception: 1
- provenance in generative audio: 1
- quantization-index modulation: 1
- basso continuo: 1
- historically informed performance practice: 1
- baroque music: 1
- performance style identification: 1
- machine learning in music: 1
- support vector machines: 1
- harmonic realization: 1
- improvisation: 1
- personal style in performance: 1
- pitch content representation: 1
- keyboard performance: 1
- acord dataset: 1
- griffs: 1
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
- musical score understanding: 1
- large language models: 1
- vision-language models: 1
- abc notation: 1
- music notation: 1
- pitch: 1
- rhythm: 1
- harmony: 1
- musical form: 1
- musical texture: 1
- multimodal reasoning: 1
- benchmark evaluation: 1
- fine-tuning: 1
- ai and music: 1
- score analysis: 1
- tonnetz: 1
- combinatorial geometry: 1
- music theory formalization: 1
- diatonic harmony: 1
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
- measurement: 12
- frequency: 4
- duration: 2
- tuningsystem: 2
- note: 2
- scalesystem: 2
- interval: 2

### Evidence Distribution
- preprint: 28
- peer_reviewed: 5
- personal: 1

## Selected Sources

### S1 — Asymmetric Phase Coding Audio Watermarking

- Source ID: jx72yj3ez4q7t2pqt9c0jmcbjx86hbek
- Extraction ID: j97f14ww3grvkgbgx82zppkj5x86hmsg
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2605.07241
- Scores: base=34.00, normalized=0.659, intraNovelty=1.000, crossRunNovelty=0.925, topicalBalance=1.000, combined=0.806
- Domain relevance: 0.500
- Reuse penalties: source=0.00, topic=0.25
- Topics: audio watermarking, stft phase manipulation, frequency-domain encoding, perceptual audio quality, deepfake audio detection, cryptographic audio signing, reed-solomon error correction in audio, log-magnitude spectral differences, lossy audio compression artifacts, psychoacoustics of phase perception, provenance in generative audio, quantization-index modulation

Summary:
This paper introduces Asymmetric Phase Coding (APC), a cryptographic audio watermarking system that embeds digital signatures into audio by manipulating STFT phase bins and log-magnitude differences of adjacent frequency bins. It is evaluated on 1,000 speech clips at 44.1 kHz and achieves 97.5–98.3% cryptographic verification rates across eight signal-processing attack conditions. The system is training-free and operates at near-real-time CPU latency. It is positioned as a provenance tool against deepfake audio, and is compared against neural watermarking baselines. While not a music theory paper, it has direct implications for how frequency-domain audio structure can carry hidden information without perceptible quality loss.

Claims:
- [1] [preprint] Pseudo-random selection of STFT phase bins can encode cryptographic information in audio while maintaining perceptual quality (mean PESQ=3.02), suggesting that phase structure in the frequency domain is largely perceptually transparent to listeners.
- [2] [preprint] Log-magnitude differences between adjacent frequency bins are a robust and perceptually subtle domain in which to embed hidden information, surviving lossy compression (MP3 at 128 kbps, OGG-Vorbis at 128 kbps) and resampling.
- [3] [preprint] Passive forensic detectors for deepfake audio are sensitive to evolving generative models and real-world channel distortions, making purely detection-based approaches fragile for audio authentication.
- [4] [personal] An 8 kHz low-pass filter applied to 44.1 kHz audio is among the most destructive common signal-processing attacks on frequency-domain watermarks, since it eliminates more than 80% of the representable frequency spectrum.
- [5] [preprint] STFT phase manipulation in audio watermarking can be made robust to end-cropping of up to 20% of audio duration, implying that phase-encoded information is distributed redundantly across the time-frequency representation rather than concentrated at temporal boundaries.

Composition Parameters:
- frequency: 44,100 Hz sample rate
- frequency: 8 kHz low-pass cutoff
- frequency: 16 kHz round-trip resampling
- duration: 10 seconds per clip
- measurement: 64 bytes (Ed25519 signature length)
- measurement: Mean PESQ = 3.02
- measurement: MP3 at 128 kbps
- measurement: OGG-Vorbis at 128 kbps

Open Questions:
- Since phase is perceptually transparent enough to hide 64-byte cryptographic signatures without audible degradation, what is the perceptual upper bound of phase-encoded information density in musical audio (as opposed to speech)?
- Could the log-magnitude difference encoding domain used here be exploited compositionally — for example, to embed microtonal or spectral voice-leading patterns that are audible but not immediately attributable to conventional harmony?
- How does an 8 kHz low-pass cutoff interact with harmonic content in musical instruments? What is lost perceptually versus what is preserved in terms of fundamental pitch and low-order partials?
- Reed-Solomon error correction is used here for temporal redundancy — could similar error-correcting codes be used to make musical motifs 'recognizable' under heavy transformation (transposition, inversion, rhythmic distortion)?
- PESQ is designed for speech; what equivalent perceptual metric would be appropriate for evaluating phase-modified musical audio, and how would classical or orchestral material score differently than speech?
- If watermark robustness survives 20% end-cropping, what does this imply about the minimum viable segment length for reliable frequency-domain encoding — and does this correspond to any musically meaningful time unit (e.g., a bar at common tempos)?
- Could the pseudo-random STFT bin selection strategy used here serve as a model for stochastic spectral composition — selecting frequency bins by a deterministic seed to create reproducible but apparently random timbral textures?

### S2 — Beyond Rules: Towards Basso Continuo Personal Style Identification

- Source ID: jx7afrabhjjj4aab4k0bk2s6gn85fycv
- Extraction ID: j97eag5wx2pp6czsd8rrs1b50x85n9ys
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21822
- Scores: base=21.00, normalized=0.341, intraNovelty=1.000, crossRunNovelty=0.980, topicalBalance=0.988, combined=0.760
- Domain relevance: 0.760
- Reuse penalties: source=0.00, topic=0.07
- Topics: basso continuo, historically informed performance practice, baroque music, computational musicology, performance style identification, machine learning in music, support vector machines, harmonic realization, voice leading, improvisation, personal style in performance, pitch content representation, keyboard performance, acord dataset, griffs

Summary:
This preprint investigates whether individual performers can be identified by their basso continuo realizations using machine learning. The study uses the Aligned Continuo Realization Dataset (ACoRD) and a structured pitch-content representation called 'griffs' combined with Support Vector Machines. Results show that player classification from performance data is achievable, suggesting measurable personal styles exist within the improvisatory tradition of basso continuo. The work highlights a gap in computational musicology: the theoretical rules of basso continuo have been studied, but the performance dimension has been neglected due to lack of suitable data.

Claims:
- [1] [preprint] Individual basso continuo players can be computationally identified from their performances using pitch-content features ('griffs') and Support Vector Machines, indicating the presence of measurable personal performance styles.
- [2] [peer_reviewed] Basso continuo is an improvised accompaniment genre rooted in the baroque era that is still actively practiced by keyboard players today.
- [3] [preprint] Basso continuo playing is shaped both by stylistic traditions from historical treatises and by individual performer choices, suggesting a tension between rule-following and personal expression.
- [4] [preprint] Computational musicology has historically focused on the rule-based theoretical foundations of basso continuo (harmonic and voice-leading constraints) rather than on empirical performance data.
- [5] [preprint] A structured pitch-content representation called 'griffs' can serve as a historically informed feature set for analyzing basso continuo realization style.

Composition Parameters:
- tuningSystem: Historically Informed Practice (baroque conventions)
- note: Griff (chord voicing unit in basso continuo realization)

Open Questions:
- What specific pitch-content features (griffs) most strongly differentiate individual players — and could these serve as generative constraints for compositional systems?
- Can the 'griff' representation be adapted to analyze improvisation styles in non-baroque genres (e.g., jazz piano comping, modal accompaniment)?
- Is personal style in basso continuo realization correlated with the player's training lineage or the treatises they studied — and if so, can treatise-sourced rules be mapped to compositional parameters?
- How does the improvisatory nature of basso continuo compare to other notated music in terms of measurable stylistic variance between performers?
- Could machine-learning-identified personal style clusters inform the design of algorithmic accompaniment systems tuned to baroque conventions?
- What is the minimum performance data needed to reliably identify a player — and does this threshold reveal anything about how quickly personal style asserts itself in improvisation?

### S3 — Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi: Two Under-Resourced Languages of Arunachal Pradesh

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

### S4 — Physicists Discover the Most Complex Forms of Ice Yet

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

### S5 — Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores

- Source ID: jx70dhsw26kwd55qeh0xgyw3xx85fp1n
- Extraction ID: j978mypywk23f3gtf3ykz84q4x85j102
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2511.20697
- Scores: base=13.00, normalized=0.146, intraNovelty=0.967, crossRunNovelty=1.000, topicalBalance=0.969, combined=0.679
- Domain relevance: 0.640
- Reuse penalties: source=0.00, topic=0.00
- Topics: musical score understanding, large language models, vision-language models, abc notation, music notation, pitch, rhythm, harmony, musical form, musical texture, multimodal reasoning, benchmark evaluation, fine-tuning, ai and music, computational musicology, score analysis

Summary:
MSU-Bench is a human-curated benchmark of 1,800 question-answer pairs designed to evaluate how well Large Language Models and Vision-Language Models understand complete musical scores. It covers works by Bach, Beethoven, Chopin, Debussy, and others, and tests comprehension across four difficulty levels—from basic onset information to texture and form—in both text (ABC notation) and visual (PDF) modalities. Evaluations of over fifteen state-of-the-art models reveal significant modality gaps, unstable performance across difficulty levels, and difficulty maintaining correctness across multiple levels simultaneously. Fine-tuning substantially improves model performance while preserving general knowledge, suggesting a path toward more robust multimodal music reasoning.

Claims:
- [1] [preprint] Current Large Language Models and Vision-Language Models have insufficiently examined ability to interpret full musical notation, including pitch, rhythm, harmony, and large-scale structure.
- [2] [preprint] Evaluations of more than fifteen state-of-the-art models reveal pronounced modality gaps between textual (ABC notation) and visual (PDF) score understanding.
- [3] [preprint] Fine-tuning on musical score data substantially improves LLM/VLM performance across modalities while preserving general knowledge.
- [4] [preprint] Musical score understanding can be decomposed into at least four hierarchical levels of difficulty, from onset information up to texture and form.
- [5] [preprint] Models exhibit unstable level-wise performance and struggle to maintain multilevel correctness simultaneously, suggesting that integrated musical reasoning is not a simple sum of component skills.

Composition Parameters:
- note: ABC notation (textual score representation)

Open Questions:
- What specific aspects of harmony and large-scale form are hardest for current models, and does this map onto known difficulties in human music theory pedagogy?
- Does the modality gap between ABC notation and PDF scores reflect a fundamental representational difference, or is it an artifact of training data distribution?
- Could a model that reliably understands musical scores be used generatively—e.g., to compose music that conforms to specific structural or harmonic constraints?
- How do model failures at 'multilevel correctness' compare to human expert performance, and what does this reveal about the nature of integrated musical reasoning?
- Would training on a broader corpus of non-Western scores reveal additional gaps, or would models transfer musical structural reasoning across traditions?
- Is ABC notation a sufficient representation for capturing microtonal, spectral, or extended-technique music relevant to contemporary composition?

### S6 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=0.585, intraNovelty=0.971, crossRunNovelty=0.000, topicalBalance=0.977, combined=0.647
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

