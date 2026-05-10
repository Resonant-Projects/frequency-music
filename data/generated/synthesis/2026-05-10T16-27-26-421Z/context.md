# Multi-Source Synthesis Context

Generated at: 2026-05-10T16:27:26.421Z
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
- Prior topic tokens tracked: 343
- Prior variable phrases tracked: 24
- Prior title phrases tracked: 12

## Aggregate Signals

### Topic Frequency
- prosody: 2
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
- speech acoustics: 1
- temporal audio analysis: 1
- predictive audio processing: 1
- disfluency: 1
- stuttering: 1
- short-window audio features: 1
- cnn audio classification: 1
- on-device inference: 1
- streaming audio: 1
- precursor signals in speech: 1
- severity-selective acoustic features: 1
- audio generation: 1
- video-to-audio synthesis: 1
- text-to-audio synthesis: 1
- multimodal alignment: 1
- audio captioning: 1
- diffusion models: 1
- off-screen audio: 1
- audio-visual correspondence: 1
- dataset construction: 1
- machine learning for sound: 1
- semantic audio description: 1
- foley synthesis: 1
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
- timbre: 1
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

### Parameter Type Frequency
- measurement: 4
- timbralsource: 4
- duration: 3
- scalesystem: 2
- interval: 2
- tuningsystem: 1
- tempo: 1
- structuralpattern: 1
- note: 1

### Evidence Distribution
- preprint: 28
- anecdotal: 7
- speculative: 1

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

### S2 — Predicting Upcoming Stuttering Events from Three-Second Audio: Stratified Evaluation Reveals Severity-Selective Precursors, and the Model Deploys Fully On-Device

- Source ID: jx7e069afwawf8v8pgrxex5y2s85w80e
- Extraction ID: j97fk7qb2z23h2jm0yzmry6jsd860akk
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.27279
- Scores: base=17.00, normalized=0.417, intraNovelty=1.000, crossRunNovelty=0.925, topicalBalance=0.968, combined=0.714
- Domain relevance: 0.400
- Reuse penalties: source=0.00, topic=0.25
- Topics: prosody, speech acoustics, temporal audio analysis, predictive audio processing, disfluency, stuttering, short-window audio features, cnn audio classification, on-device inference, streaming audio, precursor signals in speech, severity-selective acoustic features

Summary:
This paper presents a CNN-based system for predicting stuttering events from 3-second audio clips, trained on the SEP-28k dataset. The model reveals that severe disfluency events (blocks and sound repetitions) carry detectable prosodic precursors in audio, while fillers and word repetitions do not. The system is compact (616K parameters) and deployable on-device with sub-millisecond latency. The finding that clinically severe events concentrate prosodic precursor signal is the most musically/acoustically relevant insight, as it implies that prosodic features in short audio windows carry predictive information about upcoming speech events.

Claims:
- [1] [preprint] Clinically severe stuttering events (blocks and sound repetitions) carry detectable prosodic precursors in a 3-second audio window, while fillers and word repetitions do not.
- [2] [preprint] A 3-second audio window is sufficient to extract prosodic features that predict upcoming speech disfluency events with above-chance accuracy.
- [3] [preprint] Prosodic precursor signals in speech audio are severity-selective: they encode information about upcoming disruptions in temporal and spectral structure, suggesting that prosody carries anticipatory information not uniformly distributed across event types.
- [4] [preprint] A streaming audio analysis system operating at 4 Hz (one analysis window every 250 ms) is feasible on consumer mobile hardware using less than 1% of real-time compute budget.

Composition Parameters:
- duration: 3 seconds
- tempo: 4 Hz analysis rate
- duration: 0.25–0.55 ms inference latency

Open Questions:
- What specific prosodic features (pitch trajectory, energy envelope, spectral flux, rhythmic regularity) in a 3-second window carry predictive information about upcoming events? Could these same features serve as compositional triggers or generative parameters?
- If severe stuttering events carry prosodic precursors, do analogous anticipatory prosodic structures exist before other acoustically significant speech events — such as expressive peaks, emotional shifts, or sung phrase endings?
- Could a 4 Hz streaming audio analysis system be repurposed to track real-time prosodic state in musical performance, enabling adaptive accompaniment or live processing that anticipates phrase boundaries?
- The 3-second window aligns with known short-term auditory memory and phrase-perception windows in music cognition. Is this duration coincidentally or causally optimal for prosodic feature extraction?
- What is the acoustic/spectral signature of a 'block' precursor vs. a 'sound repetition' precursor? Are these distinguishable in frequency domain, or primarily in temporal envelope and rhythm?
- Could severity-selective detection logic (ignoring filler-like events, responding only to structurally significant disruptions) inspire a compositional system that reacts only to 'severe' musical gestures — sudden silences, harmonic blocks — rather than all events equally?

### S3 — Omni2Sound: Towards Unified Video-Text-to-Audio Generation

- Source ID: jx7dvwyahyzy5qvrgf7y1gvtnd85vkbp
- Extraction ID: j970nv2kdv5dtv1d1dc6ns2s5n863fv6
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2601.02731
- Scores: base=15.00, normalized=0.333, intraNovelty=1.000, crossRunNovelty=0.975, topicalBalance=0.992, combined=0.703
- Domain relevance: 0.400
- Reuse penalties: source=0.00, topic=0.08
- Topics: audio generation, video-to-audio synthesis, text-to-audio synthesis, multimodal alignment, audio captioning, diffusion models, off-screen audio, audio-visual correspondence, dataset construction, machine learning for sound, semantic audio description, foley synthesis

Summary:
Omni2Sound is a unified diffusion model for generating audio from video, text, or both simultaneously. The paper introduces SoundAtlas, a 470k-pair dataset with high-quality audio captions and tight video-audio-text alignment, built using an agentic pipeline. The model addresses cross-task competition between video-to-audio and text-to-audio generation through a three-stage progressive training schedule. A new benchmark, VGGSound-Omni, is introduced to evaluate performance including off-screen audio generation. The work is primarily a machine learning systems paper with limited direct music theory or acoustics content.

Claims:
- [1] [preprint] High-quality audio captions with tight video-audio-text (V-A-T) alignment are scarce, and this scarcity causes semantic conflict when training multimodal audio generation models.
- [2] [preprint] Unified models integrating video-to-audio, text-to-audio, and joint video-text-to-audio generation exhibit an adverse performance trade-off between the video-to-audio and text-to-audio tasks, as well as modality bias in the joint task.
- [3] [preprint] A three-stage multi-task progressive training schedule can convert cross-task competition into joint optimization, improving both audio-visual alignment and off-screen audio generation faithfulness.
- [4] [preprint] Large language/vision models (MLLMs) exhibit visual bias when generating audio captions, which can be mitigated through Vision-to-Language Compression techniques.
- [5] [preprint] Automated audio captioning pipelines using a Junior-Senior Agent Handoff architecture can achieve approximately 5× cost reduction compared to baseline approaches, while maintaining caption quality.
- [6] [preprint] Off-screen audio generation — producing audio for sound sources not visually present in a video — is a meaningful and challenging task that existing audio generation benchmarks do not adequately address.

Composition Parameters:
- measurement: 470,000 video-audio-text pairs (SoundAtlas dataset)

Open Questions:
- Can the temporal detail captured in SoundAtlas audio captions be leveraged for musically meaningful audio generation — e.g., capturing rhythm, timbre evolution, or harmonic content over time?
- Does the modality bias observed in VT2A models reflect something deeper about how humans perceive the relationship between visual and auditory information — and could this inform multimodal music composition tools?
- How does 'off-screen audio generation' relate to the compositional concept of acousmatic music, where sound sources are deliberately hidden from the listener?
- Could the semantic richness of automatically generated audio captions (describing real-world sounds) be used to build structured ontologies of timbre and acoustic environment for composers?
- What acoustic features (frequency content, onset timing, spatial positioning) are most reliably captured or lost in video-to-audio diffusion pipelines, and how does this constrain musical applications?
- Is there a meaningful relationship between cross-task competition in multimodal models and the perceptual phenomenon of auditory-visual conflict (e.g., the McGurk effect)?

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

### S5 — ATRIE: Adaptive Tuning for Robust Inference and Emotion in Persona-Driven Speech Synthesis

- Source ID: jx762q5tm7md2f9znq4tykwkv985feka
- Extraction ID: j97eq5w6w3a39hr8hv4rhwmgf185j8b3
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19055
- Scores: base=14.00, normalized=0.292, intraNovelty=0.957, crossRunNovelty=0.925, topicalBalance=0.925, combined=0.695
- Domain relevance: 0.620
- Reuse penalties: source=0.00, topic=0.25
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

### S6 — HHL with a Coherent Fourier Oracle: A Proof-of-Concept Quantum Architecture for Joint Melody-Harmony Generation

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

