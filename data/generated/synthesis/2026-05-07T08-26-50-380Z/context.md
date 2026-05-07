# Multi-Source Synthesis Context

Generated at: 2026-05-07T08:26:50.380Z
Selected 2/6 from 2 eligible candidates.

## Selection Parameters

- Fetch limit: 120
- Target selections: 6
- Minimum claims: 2
- Minimum composition parameters: 1
- Cross-run novelty window: 6
- Max reused sources from novelty window: 2
- Require tuning/intonation signal: true

## Novelty History

- Prior runs scanned: 6
- Prior source IDs tracked: 12
- Prior topic tokens tracked: 121
- Prior variable phrases tracked: 16
- Prior title phrases tracked: 8

## Aggregate Signals

### Topic Frequency
- computational musicology: 2
- basso continuo: 1
- historically informed performance practice: 1
- baroque music: 1
- performance style identification: 1
- machine learning in music: 1
- support vector machines: 1
- harmonic realization: 1
- voice leading: 1
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
- note: 2
- tuningsystem: 1

### Evidence Distribution
- preprint: 9
- peer_reviewed: 1

## Selected Sources

### S1 — Beyond Rules: Towards Basso Continuo Personal Style Identification

- Source ID: jx7afrabhjjj4aab4k0bk2s6gn85fycv
- Extraction ID: j97eag5wx2pp6czsd8rrs1b50x85n9ys
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.21822
- Scores: base=21.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=0.958, combined=0.738
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

### S2 — Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores

- Source ID: jx70dhsw26kwd55qeh0xgyw3xx85fp1n
- Extraction ID: j978mypywk23f3gtf3ykz84q4x85j102
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2511.20697
- Scores: base=13.00, normalized=0.000, intraNovelty=0.967, crossRunNovelty=0.000, topicalBalance=0.948, combined=0.412
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

