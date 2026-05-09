# Multi-Source Synthesis Context

Generated at: 2026-05-09T08:27:03.174Z
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
- Prior source IDs tracked: 25
- Prior topic tokens tracked: 345
- Prior variable phrases tracked: 23
- Prior title phrases tracked: 10

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
- chirp spread spectrum: 1
- digital audio compression: 1
- audio signal transmission: 1
- low-power wireless communication: 1
- voice-activated acquisition: 1
- lora protocol: 1
- embedded audio processing: 1
- acoustic signal encoding: 1
- spread spectrum modulation: 1
- infrasound: 1
- psychoacoustics: 1
- sub-audible frequency: 1
- anomalous perception: 1
- physiological effects of sound: 1
- hauntings and environmental acoustics: 1
- pseudoscience and acoustic research: 1
- low-frequency standing waves: 1
- full-duplex audio processing: 1
- speech perception: 1
- voice activity detection: 1
- turn-taking in conversation: 1
- speaker recognition: 1
- streaming audio: 1
- audio chunking and segmentation: 1
- latency in audio systems: 1
- discrete audio tokenization: 1
- human-machine audio interaction: 1
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
- timbralsource: 4
- scalesystem: 2
- interval: 2
- measurement: 2
- duration: 2
- tuningsystem: 1
- structuralpattern: 1
- frequency: 1
- note: 1

### Evidence Distribution
- preprint: 18
- anecdotal: 7
- speculative: 3
- personal: 1

## Selected Sources

### S1 — Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources

- Source ID: jx75ff9jca456jv63hh8tngqhn85dh7x
- Extraction ID: j978wc8spg7xjg8v7d09pzw79985df6w
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19960
- Scores: base=31.00, normalized=1.000, intraNovelty=1.000, crossRunNovelty=0.000, topicalBalance=0.990, combined=0.779
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

### S2 — Building dialogue in electronic music with Kontakt, Monark, and David Mayer

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

### S3 — Modeling and Link Budget Feasibility Analysis of Secure LoRa-Based Peer-to-Peer Communication for Short-Range Tactical Networks

- Source ID: jx731xk7jnvfy3k2caqszwn83n86a21d
- Extraction ID: j97a98yt7kjr1ve2fgrb7d59qs86b02g
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2602.23924
- Scores: base=9.00, normalized=0.083, intraNovelty=1.000, crossRunNovelty=1.000, topicalBalance=1.000, combined=0.620
- Domain relevance: 0.300
- Reuse penalties: source=0.00, topic=0.00
- Topics: chirp spread spectrum, digital audio compression, audio signal transmission, low-power wireless communication, voice-activated acquisition, lora protocol, embedded audio processing, acoustic signal encoding, spread spectrum modulation

Summary:
This paper presents a LoRa-based miniature encrypted communication device for short-range tactical use, covering a range of 1–1.5 km. It uses chirp spread spectrum (CSS) modulation, AES-128 encryption, and digital audio compression to transmit voice data wirelessly at low power. The system is designed for wearable, infrastructure-independent deployment. While primarily an engineering paper, it touches on digital audio acquisition, compression, and wireless acoustic signal transmission. Its relevance to music/acoustics is peripheral but exists in the domains of audio compression, signal transmission, and chirp modulation.

Claims:
- [1] [preprint] Chirp spread spectrum modulation enables long-range, low-energy wireless transmission of audio signals.
- [2] [preprint] Digital audio compression is a viable pipeline stage between voice acquisition and wireless transmission in low-bandwidth embedded systems.
- [3] [preprint] LoRa technology, originally developed for IoT telemetry, can be repurposed for secure real-time voice communication.

Composition Parameters:
- measurement: 1–1.5 km communication range

Open Questions:
- Could chirp spread spectrum modulation, with its frequency-sweeping nature, be used as a generative compositional technique — mapping CSS chirp profiles to melodic or timbral contours?
- What audio compression codecs are used in this pipeline, and how do they affect perceptual audio quality at the lowest viable bitrates for musical material?
- Is there a perceptual analog between CSS chirp bandwidth and musical glissando or portamento — and could CSS parameters map meaningfully to musical interval space?
- How does the electromagnetic footprint of audio transmission relate to the acoustic footprint of sound propagation — are there useful metaphorical or mathematical parallels for composition?
- What is the minimum intelligible audio bitrate achievable through LoRa-based compression, and does it correspond to any known psychoacoustic threshold?

### S4 — The Science of Spooky Sounds

- Source ID: jx7bsecd6xz13wetqb0aeaxenn85nj95
- Extraction ID: j977jy2m88pp1b118hc0wgyt9s85n04g
- Type: rss
- Status: extracted
- URL: https://nautil.us/the-science-of-spooky-sounds-1280228/
- Scores: base=7.00, normalized=0.000, intraNovelty=1.000, crossRunNovelty=0.963, topicalBalance=0.988, combined=0.615
- Domain relevance: 0.500
- Reuse penalties: source=0.00, topic=0.13
- Topics: infrasound, psychoacoustics, sub-audible frequency, anomalous perception, physiological effects of sound, hauntings and environmental acoustics, pseudoscience and acoustic research, low-frequency standing waves

Summary:
This source is a Nautilus article framed as a conversation with a researcher who studies pseudoscience, exploring the hypothesis that infrasound — low-frequency sound below the threshold of human hearing — may contribute to experiences commonly attributed to ghosts or hauntings. The content preview is truncated, so only limited detail is available. The core claim appears to be that infrasound can produce perceptual and physiological effects in humans that might be misattributed to supernatural causes. This sits at an interesting intersection of acoustics, psychoacoustics, and the phenomenology of anomalous experience.

Claims:
- [1] [speculative] Infrasound (low-frequency sound below the threshold of normal hearing) may be linked to experiences people describe as ghostly or haunting phenomena.
- [2] [personal] Infrasound is implicitly characterized as a real acoustic phenomenon with measurable physiological or perceptual effects, distinct from pseudoscience, even if its link to ghost experiences is speculative.

Composition Parameters:
- frequency: below ~20 Hz (infrasound range)

Open Questions:
- What specific frequencies within the infrasound range are most associated with reported perceptual anomalies (e.g., unease, visual disturbance, presence detection)?
- Is there peer-reviewed evidence (e.g., Vic Tandy's work at 18.98 Hz) for infrasound causing measurable psychological effects?
- Could infrasound frequencies be deliberately incorporated into musical compositions to create emotional or somatic responses — and at what amplitude/duration thresholds?
- Do standing waves in rooms and architectural spaces generate infrasound as a byproduct, and how does this interact with musical performance spaces?
- What is the relationship between infrasound and the sense of 'presence' studied in neuroscience and sleep paralysis research?
- How does the vestibular system (balance and spatial perception) respond to infrasound, and could this be exploited compositionally?

### S5 — UAF: A Unified Audio Front-end LLM for Full-Duplex Speech Interaction

- Source ID: jx743vna2yd4hyvvhf93yc1v1h85xvj4
- Extraction ID: j9713cn14r4r3xtz74ad0pzp0d85ytkv
- Type: rss
- Status: extracted
- URL: https://arxiv.org/abs/2604.19221
- Scores: base=7.00, normalized=0.000, intraNovelty=1.000, crossRunNovelty=0.940, topicalBalance=0.981, combined=0.594
- Domain relevance: 0.400
- Reuse penalties: source=0.00, topic=0.20
- Topics: full-duplex audio processing, speech perception, voice activity detection, turn-taking in conversation, speaker recognition, streaming audio, audio chunking and segmentation, latency in audio systems, discrete audio tokenization, human-machine audio interaction

Summary:
This paper presents UAF, a unified audio front-end large language model designed for full-duplex speech interaction. It consolidates multiple traditionally separate audio processing tasks (VAD, turn-taking detection, speaker recognition, ASR, QA) into a single autoregressive sequence prediction model. The system processes streaming audio in fixed-duration chunks and generates discrete tokens encoding both semantic content and system-level control signals. The paper is primarily an AI/NLP engineering contribution and has minimal direct relevance to music theory, acoustics, or psychoacoustics.

Claims:
- [1] [speculative] Full-duplex speech interaction is described as the most natural and intuitive mode of human communication, implying that simultaneous bidirectional audio processing more closely mirrors human perceptual and communicative behavior than half-duplex systems.
- [2] [preprint] Cascaded (modular) audio processing pipelines suffer from accumulated latency, information loss, and error propagation — suggesting that sequential decomposition of audio signals into discrete processing stages introduces compounding degradation of audio information.

Composition Parameters:
- duration: 600 ms audio chunk

Open Questions:
- Could the 600ms audio chunk size used here relate meaningfully to psychoacoustic windows of auditory scene analysis or perceptual stream segregation?
- Does the discrete token representation of audio in autoregressive LLMs preserve musically relevant features such as timbre, pitch contour, or rhythmic structure?
- What are the perceptual consequences of the 'accumulated information loss' in cascaded audio pipelines when applied to music rather than speech — e.g., in music transcription or harmonic analysis systems?
- Could unified end-to-end audio models like UAF be repurposed to detect musical events (onset, beat, chord change) with lower latency than traditional cascaded music information retrieval pipelines?
- Is there a meaningful parallel between full-duplex conversational audio and musical improvisation, where simultaneous listening and sound production are required?

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

