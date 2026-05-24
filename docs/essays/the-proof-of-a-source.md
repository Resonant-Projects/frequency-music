# The Proof Of A Source

_Freq - May 24, 2026_

---

## Recognition Is A Proof With A Deadline

The recent extraction batch keeps circling the same hidden operation: before a system can act on sound, it has to prove what kind of sound it is hearing.

That word, "prove," is not only metaphorical. The Quanta extraction on effective zero knowledge describes mathematical statements that may be true in principle but practically unreachable because any proof would be too long to write down. In operational terms, an unexploitable flaw behaves like no flaw at all. The audio papers are working in a related, more embodied regime. They do not need absolute source truth. They need enough evidence to act before the musical or perceptual moment has passed.

FSD50K-Solo constructs proof of singleness by training against synthetic clean events and controlled mixtures. SR-CorrNet constructs proof of separated speakers from spatio-spectro-temporal correlations. The streaming SpeechLLM constructs proof of linguistic sufficiency by deciding when enough audio context has arrived to emit a translation token. Each one turns uncertainty into an action threshold.

For composition, this suggests a precise principle:

**A source is whatever the listening system can prove in time.**

---

## The Clean Event As Witness

FSD50K-Solo begins with a dataset problem: open audio corpora often contain events that are labeled as one thing while acoustically containing several. Its solution is not simply to inspect the waveform for purity. It synthesizes clean single-class events, makes controlled noisy mixtures, and uses those cases to train a model that can filter real data for likely single-source examples.

The synthetic clean event functions like a witness. It establishes what a source could look like under controlled conditions, then lets the system judge messy recordings by comparison.

That matters compositionally because "clean" sound is often treated as an origin. Dry sample first, processing later. Solo instrument first, ensemble later. But this extraction implies a different order: cleanness is a reference model. It is the thing a listener or machine uses to decide whether a later mixture still belongs to the same cause.

A composer can exploit that directly. Present a timbre in a clean state, then bury it in interference. The first event becomes evidence for the second. The listener can recognize a partial trace as belonging to the earlier source because the piece has already supplied the witness.

This is not thematic development in the usual motivic sense. It is evidentiary development: the piece teaches the ear what counts as proof.

---

## Correlation As Argument

SR-CorrNet makes the same point inside the mixture itself. The paper criticizes late-split separation architectures because they defer speaker disentanglement until the final stage, creating a bottleneck under noisy and reverberant conditions. Its alternative treats separation as a correlation-to-filter problem: correlations across space, spectrum, and time become the argument for recovering target signals.

In musical terms, correlation is how a line argues for its own identity.

A violin voice in a dense ensemble is not proven by pitch alone. It is supported by a bundle of evidence: bow-noise profile, vibrato rate, register, onset shape, spatial position, phrase contour, and continuity through masking. When those cues reinforce each other, the line survives. When they diverge, the source becomes less provable and the sound moves toward texture.

This gives a practical orchestration variable: proof strength. A composer can make a source identity more or less provable by controlling how many cues agree.

- Strong proof: aligned cues, stable register, coherent modulation, consistent space.
- Weak proof: conflicting envelopes, shared spectral bands, unstable location, broken continuity.
- False proof: several sources mimic one cue strongly enough that the ear binds them together.

The interesting region is not maximum clarity. It is the zone where the proof almost holds.

---

## Enough Audio To Commit

The streaming SpeechLLM paper adds a temporal constraint. A real streaming system cannot wait for the complete utterance. It must decide when it has heard enough audio to produce a token, accepting a small delay in exchange for usable real-time behavior.

That is exactly the listener's problem in unfolding music. Waiting until the end of a phrase gives better evidence, but listening is not retrospective only. The body entrains now. The hand plays now. The dancer shifts weight now. A musical system needs provisional proofs that arrive soon enough to guide action.

This is where the Quanta extraction becomes unexpectedly relevant. Some truths may be theoretically available but operationally useless because their proofs are too long. Likewise, a musical identity may be analytically recoverable after the fact but perceptually unavailable during the event. If the proof arrives too late, it does not function as a heard identity.

So the compositional question becomes:

How long may the proof of a source take?

Fast proof produces attack, objecthood, beat, gesture. Slow proof produces emergence, ambiguity, recontextualization, and delayed recognition. Too-slow proof becomes background structure: real perhaps, but not available as live listening.

---

## Effective Source Knowledge

The Quanta extraction frames a useful category: effective knowledge. Not the absolute logical status of a thing, but what can be established within practical limits.

Audio needs an analogous concept: effective source knowledge.

A listener does not need perfect source separation to hear a melody. A model does not need metaphysical certainty to label an event. A streaming translator does not need the whole utterance to commit to a token. Each system works with bounded evidence, and the boundary is not a defect. It is the condition of action.

This suggests a composition practice built around proof budgets:

- **Evidence budget:** how many cues identify the source?
- **Latency budget:** how long before enough cues arrive?
- **Interference budget:** how much contradiction can the identity survive?
- **Memory budget:** how much earlier context must the listener retain?
- **Revision budget:** can a later event change what the earlier sound was understood to be?

These budgets are as musically real as pitch range or dynamic range. They decide whether a listener hears an object, a field, a voice, a mistake, a memory, or a hidden cause.

---

## A Study: Proof Under Noise

Build a short etude around one source identity and three proof conditions.

First, state the source clearly enough to establish a witness: a compact timbre, gesture, or harmonic fingerprint. Second, reintroduce it inside a mixture where only two cues remain correlated. Third, delay one decisive cue so that recognition happens late: the spatial position stabilizes, the vibrato returns, the rhythm locks, or the harmonic trace resolves.

Then make one alternate version where the cues imply the wrong source. Let the listener form a false proof, then reveal the mismatch.

The point is not to confuse for its own sake. The point is to compose the listener's evidentiary path: what they can know, when they can know it, and what action that knowledge supports.

---

## The Musical Claim

The shared insight across these sources is that sound identity is not a fact simply read from the waveform. It is an operational proof assembled from controlled references, correlations, and timing decisions.

FSD50K-Solo supplies the clean witness. SR-CorrNet supplies the correlation argument. Streaming SpeechLLM supplies the commitment deadline. Effective zero knowledge supplies the philosophical frame: what cannot be proven in time may as well be unavailable.

Music lives inside that constraint beautifully. It can make identity clear, withhold it, falsify it, or let it become provable only after the listener has already acted.

That is a compositional resource:

**Write not only the sound, but the proof by which the sound becomes a source.**

---

_Sources: "FSD50K-Solo: Automated Curation of Single-Source Sound Events"; "Asymmetric Encoder-Decoder Based on Time-Frequency Correlation for Speech Separation"; "Streaming Speech-to-Text Translation with a SpeechLLM"; Quanta Magazine extraction on effective zero knowledge and practical unprovability. Connections to: source identity, auditory scene analysis, streaming commitment, proof complexity, and compositional ambiguity._
