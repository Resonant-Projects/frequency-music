# Multi-Source Synthesis Context

Generated at: 2026-05-05T08:27:18.413Z
Selected 3/5 from 3 eligible candidates.

## Selection Parameters

- Fetch limit: 200
- Target selections: 5
- Minimum claims: 2
- Minimum composition parameters: 1
- Cross-run novelty window: 6
- Max reused sources from novelty window: 2
- Require tuning/intonation signal: true

## Novelty History

- Prior runs scanned: 6
- Prior source IDs tracked: 28
- Prior topic tokens tracked: 372
- Prior variable phrases tracked: 0
- Prior title phrases tracked: 0

## Aggregate Signals

### Topic Frequency
- voice leading: 2
- computational musicology: 2
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

### Parameter Type Frequency
- scalesystem: 2
- tuningsystem: 2
- interval: 2
- note: 2

### Evidence Distribution
- preprint: 17
- peer_reviewed: 1

## Selected Sources

### S1 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=0.976, combined=0.776
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

### S2 — Beyond Rules: Towards Basso Continuo Personal Style Identification

- Source ID: jx7afrabhjjj4aab4k0bk2s6gn85fycv
- Extraction ID: j97eag5wx2pp6czsd8rrs1b50x85n9ys
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21822
- Scores: base=21.00, normalized=0.444, intraNovelty=0.971, crossRunNovelty=0.000, topicalBalance=0.933, combined=0.562
- Domain relevance: 0.760
- Reuse penalties: source=1.00, topic=1.00
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

### S3 — Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores

- Source ID: jx70dhsw26kwd55qeh0xgyw3xx85fp1n
- Extraction ID: j978mypywk23f3gtf3ykz84q4x85j102
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2511.20697
- Scores: base=13.00, normalized=0.000, intraNovelty=0.967, crossRunNovelty=0.000, topicalBalance=0.958, combined=0.414
- Domain relevance: 0.640
- Reuse penalties: source=1.00, topic=1.00
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

