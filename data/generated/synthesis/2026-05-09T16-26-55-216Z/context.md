# Multi-Source Synthesis Context

Generated at: 2026-05-09T16:26:55.216Z
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
- Prior source IDs tracked: 26
- Prior topic tokens tracked: 347
- Prior variable phrases tracked: 27
- Prior title phrases tracked: 12

## Aggregate Signals

### Topic Frequency
- computational musicology: 2
- voice leading: 2
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
- quantum computing: 1
- hhl algorithm: 1
- algorithmic composition: 1
- music cognition: 1
- narmour implication-realisation: 1
- krumhansl-kessler tonal hierarchy: 1
- tonal stability: 1
- harmony generation: 1
- melody generation: 1
- chord progressions: 1
- fourier analysis in music: 1
- unitary operators: 1
- sparse linear systems: 1
- quantum speedup: 1
- coherent measurement: 1
- fault-tolerant quantum hardware: 1
- note-pair distributions: 1
- state space complexity: 1
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

### Parameter Type Frequency
- timbralsource: 4
- measurement: 4
- note: 3
- tuningsystem: 2
- scalesystem: 2
- interval: 2
- structuralpattern: 1
- duration: 1
- frequency: 1

### Evidence Distribution
- preprint: 29
- anecdotal: 7
- peer_reviewed: 1
- speculative: 1

## Selected Sources

### S1 — Beyond Rules: Towards Basso Continuo Personal Style Identification

- Source ID: jx7afrabhjjj4aab4k0bk2s6gn85fycv
- Extraction ID: j97eag5wx2pp6czsd8rrs1b50x85n9ys
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21822
- Scores: base=21.00, normalized=0.583, intraNovelty=1.000, crossRunNovelty=0.980, topicalBalance=0.972, combined=0.830
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

### S2 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=1.000, intraNovelty=0.971, crossRunNovelty=0.000, topicalBalance=0.969, combined=0.770
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

### S3 — Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores

- Source ID: jx70dhsw26kwd55qeh0xgyw3xx85fp1n
- Extraction ID: j978mypywk23f3gtf3ykz84q4x85j102
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2511.20697
- Scores: base=13.00, normalized=0.250, intraNovelty=0.967, crossRunNovelty=1.000, topicalBalance=0.966, combined=0.710
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

### S4 — Building dialogue in electronic music with Kontakt, Monark, and David Mayer

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

### S5 — HHL with a Coherent Fourier Oracle: A Proof-of-Concept Quantum Architecture for Joint Melody-Harmony Generation

- Source ID: jx7cpq9xmaekwyq7jj7ajsae5h85eycc
- Extraction ID: j97386jb54vcs64m90p3f621zs85nz45
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.20882
- Scores: base=23.00, normalized=0.667, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=1.000, combined=0.659
- Domain relevance: 0.860
- Reuse penalties: source=1.00, topic=1.00
- Topics: quantum computing, hhl algorithm, algorithmic composition, music cognition, narmour implication-realisation, krumhansl-kessler tonal hierarchy, tonal stability, harmony generation, melody generation, chord progressions, fourier analysis in music, unitary operators, sparse linear systems, quantum speedup, coherent measurement, fault-tolerant quantum hardware, note-pair distributions, state space complexity

Summary:
This preprint proposes a quantum computing architecture for joint melody and harmony generation using the HHL algorithm, encoding music-cognition models (Narmour implication-realisation and Krumhansl-Kessler tonal stability) into a sparse linear system whose solution vector represents a weighted note-pair distribution. A coherent Fourier harmonic oracle is introduced as a unitary operator that applies chord-transition weights to the HHL amplitude vector, enabling a single quantum measurement to jointly select melody notes and a two-chord progression. To manage state-space complexity, generation is limited to 2-note/2-chord blocks chained classically. A four-block chain demonstration yields 8 notes over 8 chords, with 97% of generated chord progressions rated grammatically strong or acceptable by an independent rule-based validator. The primary theoretical motivation is preserving HHL's exponential speedup over classical linear solvers by consuming the output coherently rather than reading it classically.

Claims:
- [1] [preprint] The HHL algorithm carries a proven exponential speedup over classical linear solvers for sparse systems, which this architecture attempts to extend to musical generation.
- [2] [preprint] Reading HHL output classically cancels the quantum speedup; the solution must be consumed coherently for the speedup to be realised.
- [3] [preprint] Narmour implication-realisation theory and Krumhansl-Kessler tonal stability can be encoded as a sparse system matrix, whose solution vector represents a music-cognition-weighted note-pair distribution.
- [4] [preprint] A coherent Fourier harmonic oracle — a unitary that applies chord-transition weights to the HHL amplitude vector — allows a single quantum measurement to jointly select both melody notes and a two-chord progression.
- [5] [preprint] 97% of chord progressions generated by a four-block chain were rated strong or acceptable by an independent rule-based harmony validator.
- [6] [preprint] Classical simulation of larger joint melody-harmony blocks becomes infeasible due to exponential growth of the joint state space, motivating a 2-note/2-chord block constraint.
- [7] [speculative] Classically chaining collapsed block outputs as conditioning inputs for subsequent blocks is a viable but temporary workaround until fault-tolerant quantum hardware permits larger monolithic circuits.

Composition Parameters:
- note: 2 notes per quantum block
- duration: 8 notes over 8 chords (4-block chain)
- measurement: 97% chord progressions rated strong or acceptable

Open Questions:
- Can the Narmour and Krumhansl-Kessler encodings in the system matrix be validated against perceptual experiments — do listeners actually prefer the outputs over baseline algorithmic generation?
- What musical and perceptual properties are lost or introduced by collapsing quantum state at each block boundary during classical chaining?
- How does the rule-based harmony validator define 'strong or acceptable' — and does this align with human listener judgments or established music theory?
- Is the Fourier basis a principled choice for representing chord-transition weights, or could other orthonormal bases (e.g., wavelet, cosine) yield musically different or perceptually superior results?
- When fault-tolerant hardware permits larger monolithic circuits, how many notes/chords could theoretically be generated in a single coherent measurement, and what new musical structures might emerge?
- Could this architecture be extended beyond two-voice (melody + harmony) to polyphonic or contrapuntal generation without exponential overhead?
- Does the joint probability distribution produced by the HHL+oracle pipeline produce statistically different melodic contours than classical Markov chain or neural generative approaches?
- What is the relationship between the quantum amplitude vector geometry and perceived consonance or tension in the resulting progressions?

### S6 — Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi: Two Under-Resourced Languages of Arunachal Pradesh

- Source ID: jx78j7ze7qdtvv1jzwvrgwt1as85smq1
- Extraction ID: j97dmcxraattrt4e9gsc7dsp4185rj2e
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.25309
- Scores: base=24.00, normalized=0.708, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=1.000, combined=0.617
- Domain relevance: 0.500
- Reuse penalties: source=1.00, topic=1.00
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

