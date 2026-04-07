# The Observer's Instrument: Why Representation Shapes Musical Reality

_Every measurement apparatus determines what can be measured. Every representation of music determines what music can be._

## The Neutral Window Myth

We treat representations of music — scores, spectrograms, MIDI files, audio waveforms, even our own perception — as transparent windows onto a musical reality that exists independently of how we look at it. A spectrogram shows you what's "really there." A score captures the "actual" structure. A trained listener hears the "true" harmony.

This is wrong in a deep and productive way.

Recent work on network representations of music reveals a startling finding: when you encode musical events as transition networks, the choice of encoding — which features you include, how finely you quantize — doesn't just affect measurement precision. It _fundamentally reshapes the topology of the resulting network_, redistributing where uncertainty lives, how information flows, and what patterns become visible or invisible. Simpler encodings produce denser networks with higher entropy rates. Richer encodings sharpen transition profiles and lower entropy rates but expand the state space and increase model error.

The representation doesn't just describe the music. It creates a particular musical reality.

## The Observer Effect, Concretely

In signal processing, every measurement tool imposes constraints on what it can reveal. This isn't a metaphor borrowed from quantum mechanics — it's a direct consequence of Fourier analysis: you cannot simultaneously have perfect time and frequency resolution. The mathematical structure (conjugate variables, uncertainty relations) is shared, but the physics is classical.

**The basilar membrane is an instrument.** The cochlea performs a particular time-frequency decomposition, one with logarithmic frequency resolution, specific critical bandwidth constraints, and the Gabor uncertainty bound built into its physics. What we call "a note" is what this instrument resolves. A creature with different cochlear mechanics would hear different notes — not wrong notes, but notes from a different decomposition. As we explored in _The Codec Ear_, the auditory system isn't passively receiving music; it's actively constructing it according to its own transfer function.

**A spectrogram is an instrument.** Choose a short window and you see transients clearly but smear pitches. Choose a long window and you resolve harmonics but blur attacks. The uncertainty principle (Δt · Δf ≥ 1/4π) isn't a limitation of technology — it's a fundamental constraint on what can simultaneously exist in a time-frequency representation. The spectrogram doesn't show you "the music." It shows you one projection of the music, exactly analogous to how choosing a coordinate system determines what you can measure easily. (The Fourier uncertainty principle and the quantum uncertainty principle share the same mathematics — they're both consequences of conjugate variables — but one describes signal processing, the other describes subatomic particles. Don't confuse the shared math for shared physics.)

**A neural network tokenizer is an instrument.** Research on Audio Large Language Models reveals that non-semantic acoustic features — timbre, accent, background noise — profoundly affect model behavior in ways that text-based evaluation frameworks completely miss. The model isn't hearing "the same music" as a human listener who ignores background hiss. Its representation creates a different musical object, one where the hiss is constitutive rather than incidental.

**A score is an instrument.** Standard notation captures pitch and rhythm with high precision but barely represents timbre, articulation nuance, or microtonal inflection. A score of a Delta blues performance captures perhaps 40% of the musical information. This isn't a failure of notation — it's the score-instrument resolving what its design allows. Tablature resolves different information. Lead sheets resolve different information. Each creates a different musical object from the same sound.

## The Topology Theorem

The network topology research makes this concrete with mathematical precision. Given a corpus of piano music:

- **Encode by pitch class alone** → you get a dense 12-node network, high entropy rate, low model error. The musical "reality" in this representation is a world of pitch-class transitions where everything connects to everything else, uncertainty is uniformly spread, and the dominant structure is the statistical distribution of pitch classes. This is tonal music as seen through the lens of pitch-class set theory.

- **Encode by pitch + duration + dynamics** → the state space explodes, the network becomes sparse and structured, entropy rate drops, and model error increases. Now the musical "reality" has sharp, specific transitions with clear surprises. The dominant structure is motivic — particular combinations of pitch, rhythm, and intensity that recur and develop.

- **Add register, articulation, pedaling** → further expansion, further specificity. Each added dimension reveals structures invisible in simpler encodings while making other patterns disappear into the noise of an enormous state space.

The critical finding: _uncertainty concentrates in diffusion-central nodes_ — the network hubs through which information flows most readily. Predictable flow and localized surprise coexist. But which nodes are central, where surprise concentrates, what counts as "predictable" — all of this changes with the encoding.

There is no encoding that shows you "all of the music." There is no God's-eye view. Every representation is a projection, and the projection determines the geometry.

## Complementarity

This isn't just the uncertainty principle (though that's part of it). It's closer to Bohr's complementarity: certain properties of music are _jointly incompatible_ — you cannot simultaneously represent them with full precision, not because of technological limits but because of the mathematical structure of the representation space.

**Time and frequency are complementary.** You cannot simultaneously know exactly when a musical event occurs and exactly what pitch it is. This is the Gabor limit, and it's absolute.

**Local and global structure are complementary.** A representation that captures note-to-note transitions beautifully (Markov models, neural next-token prediction) is systematically blind to large-scale form. A representation that captures form (sonata diagrams, phrase structure trees) is systematically blind to surface detail. You can build multi-scale models, but at each scale you face the same complementarity.

**Semantic and acoustic properties are complementary.** The AudioTrust research demonstrates this vividly: models can either attend to "what is being said" (semantic content) or "how it sounds" (acoustic properties), but vulnerability in one domain creates blind spots in the other. Human listeners do this too — we can attend to the words of a song or its sound, but attending to one suppresses perception of the other (the "cocktail party effect" is a complementarity phenomenon).

**Structure and expression are complementary.** A score captures structure; a recording captures expression. Neither captures both. Even a heavily annotated score with audio-aligned metadata is still two complementary views stitched together, not a unified representation.

## The Instrument Determines the Physics

Here's where this gets compositionally powerful rather than merely philosophical.

If the representation determines the musical reality, then _choosing a representation is a compositional act_. This isn't just about analysis — it's about creation.

**Spectral composers** (Grisey, Murail, Haas) understood this intuitively. By analyzing instrumental sounds through spectrograms and building compositions from the resulting frequency data, they weren't "using spectral analysis" — they were composing through the spectrogram instrument, letting its particular resolution and blind spots shape the musical result. The spectrogram's inability to represent phase information is why spectral music often has a particular floating, timbrally rich but rhythmically vague quality.

**Set theorists** (Forte, Morris, Lewin) composed through pitch-class set analysis, and the music that emerged — or rather, the music that was recognized as significant — had the structural properties that pitch-class sets can represent. Music that is extraordinary in other dimensions (timbre, micro-rhythm, spatial distribution) was literally invisible to this instrument.

**Machine learning composers** compose through whatever representation the model uses. A model trained on MIDI will generate MIDI-shaped music. A model trained on spectrograms will generate spectrogram-shaped music. The representation is the composition tool, and its biases become the aesthetic.

## Implications for the Resonant Projects Pipeline

This analysis has practical implications for how we build tools:

1. **Multiple representations are not redundant — they're essential.** Analyzing a source through pitch-class networks AND spectral analysis AND rhythmic patterns doesn't give you "three views of the same thing." It gives you three different musical objects. The connections _between_ these objects are where the most interesting structure lives.

2. **The extraction pipeline's encoding choices are compositional decisions.** When we extract claims, topics, and composition parameters from a source, we're projecting through a particular analytical instrument. Different extraction prompts would produce different knowledge graphs — not better or worse, but different, revealing different connections.

3. **The knowledge graph topology is not "the structure of musical knowledge."** It's the structure that our particular encoding reveals. Different node types, different edge definitions, different granularity would produce a graph with different topology, different hubs, different clusters. The graph is an instrument.

4. **Complementary blind spots can be mapped.** For each representation we use, we can explicitly identify what it cannot represent and design complementary tools to cover those blind spots. Not a single perfect representation, but a constellation of imperfect ones whose blind spots don't fully overlap.

## The Deeper Point

Music is not a fixed object that representations approximate with varying accuracy. Music is what emerges in the interaction between sound and the instruments we use to perceive, analyze, and describe it. The basilar membrane, the spectrogram, the score, the neural network, the Markov chain, the pitch-class set — each is an instrument that, in the act of measurement, participates in creating the musical reality it observes.

This isn't relativism. Some representations are more useful than others for specific purposes. A spectrogram is better than a score for studying timbre. A score is better than a spectrogram for studying counterpoint. But "better for purpose X" is different from "closer to the truth."

The deepest musical understanding comes not from finding the One True Representation but from learning to play multiple representational instruments fluently, understanding what each reveals and conceals, and attending to the resonances and contradictions between them. The observer's instrument is part of the music.

---

_Bridges: [The Codec Ear](the-codec-ear.md) (perception as encoding), [The Tuning Codec](the-tuning-codec.md) (tuning systems as representational choices), [The Uncertainty of Sound](the-uncertainty-of-sound.md) (Gabor limit as fundamental complementarity), [The Entropy Arc](the-entropy-arc.md) (information structure depends on encoding), [The Symmetry Tax](the-symmetry-tax.md) (representations impose and break symmetries), [The Surface and the Source](the-surface-and-the-source.md) (multiple analytical layers)_

_Sources: Network representations of musical event sequences (encoding–topology–entropy tradeoff), AudioTrust benchmark (non-semantic acoustic cues in ALLMs), Audio-Language Models survey (representation choices in multimodal audio AI)_
