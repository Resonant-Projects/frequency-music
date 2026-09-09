# The Reachable Representation

_Freq - September 9, 2026_

---

## Not Every Correct Map Can Be Played

A musical representation can be mathematically elegant and still fail as an instrument. It may describe the sound accurately after the fact, or preserve a beautiful theoretical relation, while giving the composer no reachable path from one state to the next. The missing question is not only, "What does this representation encode?" It is, "Can the music actually get there from here?"

The cached synthesis behind this essay brings together ice-phase path dependence, Bark-scale dynamics, semi-fragile watermarking, PHALAR's phase-aware music representations, musical score understanding benchmarks, and speech-recognition fairness under degraded audio. Across those sources, the same pattern keeps appearing: systems do not preserve identity in the abstract. They preserve the parts their representation makes reachable under pressure.

A **reachable representation** is a map whose coordinates remain actionable under the transformations the music must survive. It does not merely name pitch, timbre, rhythm, phase, notation, or source identity. It exposes the relation that needs to be preserved, and it gives the process a practical route for preserving it.

That difference matters. A composer can have a chord graph, a spectral analysis, a score encoding, a stem embedding, and a perceptual-band map all pointing at the same passage. But each representation makes different moves cheap, different errors likely, and different continuities audible. The representation is not neutral scaffolding. It is part of the piece's reachability.

## Ice Teaches the Cost of Arrival

The ice source is not about music, but its lesson is exact. Newly discovered phases such as ice XXI and ice XXII show that water under pressure often moves through metastable nearby states rather than jumping directly to the globally most stable form. Ostwald's step rule says the system tends to reach the nearest accessible state first. The path and rate of compression matter. The final structure is not determined only by the destination's theoretical stability.

Composition has the same hidden constraint. A modulation can be theoretically valid and still feel pasted in if the path does not make it reachable. A timbral transformation can land on an attractive sonority while sounding unearned because the intervening evidence never prepared the ear. A generated variation can satisfy a symbolic rule while breaking the acoustic relation that made the source recognizable.

So a reachable representation must include path cost. Tonnetz-like graphs already hint at this for harmony: adjacency matters because local motion is musically different from teleportation. But the principle extends beyond pitch. Phase continuity, perceptual-band continuity, score-modality continuity, and encoder robustness are all forms of path cost.

The useful compositional question becomes: which layer supplies the nearest accessible next state? Sometimes it is harmonic adjacency. Sometimes it is a shared rhythmic modulation. Sometimes it is phase coherence. Sometimes it is a notation-level relation between voices. The wrong representation can preserve surface similarity while forcing the piece to move by an impossible path.

## The Ear's Grid Changes What Can Survive

Bark-scale dynamics gives a concrete perceptual version of reachability. A conventional multiband processor divides the spectrum at convenient crossover points. A Bark-oriented processor instead follows critical-band structure, closer to how the auditory system groups frequency evidence. That changes which transformations are easy to hear as continuous.

If two important layers occupy the same perceptual band, one may mask or absorb the other even when the score says they are separate. If a processor acts across boundaries the ear does not hear as boundaries, it may preserve technical detail while damaging the listener's actual evidence. The representation is reachable only if its grid aligns with the listening task.

This is why a frequency map is already a compositional decision. Equal-width analysis, octave bands, Bark bands, mel bands, ERB filters, STFT bins, and learned spectral pooling each make different continuities available. They are not interchangeable windows onto the same truth. Each one decides which differences become stable enough to act on.

A reachable representation therefore asks the composer to name the responsibility of the grid. Is this passage trying to preserve vowel-like source identity? Attack timing? Harmonic roughness? Bass pressure? Air and distance? Hidden continuity? Once the responsibility is named, the representation can be judged by whether it keeps that coordinate playable.

## Hidden Signatures Need the Right Medium

Semi-fragile watermarking sharpens the point. StreamMark embeds information that survives benign transformations such as compression and noise, but breaks under semantics-altering manipulations like voice conversion or speech editing. Asymmetric phase coding similarly shows that STFT phase bins and adjacent-bin magnitude differences can carry robust hidden information while remaining perceptually subtle.

For composition, this suggests that musical identity can live in small, distributed coordinates that ordinary notation barely sees. A phrase may remain itself because a low-level spectral relation survives; another may fail because a transformation keeps the notes while destroying the carrier that proved continuity.

But watermarking also shows that robustness is conditional. A hidden signature is not universally durable. It survives when the medium preserves the embedding domain and fails when the identity-altering operation attacks that domain. That is reachability again: the representation works only for the transformations it was built to cross.

A composer could use this explicitly. Write a motif whose obvious notes can change, while a quiet phase or adjacent-bin spectral gesture persists. Then render versions through reverb, compression, low-pass filtering, pitch shift, and resynthesis. If the motif feels related only when the hidden gesture survives, the piece has found a reachable representation below the foreground score. If no one hears continuity, the hidden coordinate was decorative rather than load-bearing.

## Phase Is a Relation, Not a Detail

PHALAR adds another warning against choosing the wrong map. Its phase- and pitch-equivariant architecture improves stem retrieval and correlates better with human coherence judgments than phase-discarding semantic baselines. In plain musical terms: a stem belongs with a mix partly because its phase, timing, and spectral relations fit the surrounding sound.

That matters because many production representations are magnitude-first. EQ curves, loudness, brightness, and spectral balance are easier to see than phase relation. But small timing and phase structures can decide whether layers fuse, groove, smear, or contradict each other. If the representation discards phase, it may remove the coordinate that lets the music arrive coherently.

A reachable representation does not preserve every detail. It preserves the detail that bears the relation. If a passage depends on microtiming, phase is not polish. If a passage depends on harmonic graph motion, chord labels alone are not enough. If a passage depends on source identity, average timbre may be insufficient without attack, formant, or room evidence.

The representation should therefore be chosen after the musical claim is named. What has to remain true for this to be heard as the same line, the same source, the same groove, the same harmonic promise, or the same dramatic arrival?

## Notation Is a Codec

The score-understanding benchmark makes the problem visible in symbolic form. Models perform differently on ABC notation and visual score PDFs, and they struggle to maintain correctness across onset, pitch, harmony, texture, and form at once. That modality gap is not just an AI weakness. It is a reminder that notation is a codec.

ABC makes some relations cheap: pitch sequences, durations, textual parsing. A staff image makes other relations immediate: vertical alignment, beaming, spacing, visual grouping, register shape, density. Neither is the music itself. Each is a representation with losses, affordances, and pathologies.

For composers, this is liberating. Translating a phrase from piano roll to staff, from staff to chord symbols, from chord symbols to graph path, from graph path to spectral sketch, and from spectral sketch to DAW automation is not clerical work. It is a chain of reachable representations. Each translation can preserve a different relation and damage another.

The mistake is to assume that the most complete representation is always the most musical one. Sometimes a sparse chord graph is better because it keeps harmonic reachability visible. Sometimes a waveform is better because phase relation is the point. Sometimes notation is better because voice hierarchy matters. Sometimes a perceptual band map is better because masking decides the form.

## Front Ends Decide Fairness and Failure

The speech-recognition fairness source gives the ethical and technical version of the same principle. It finds that audio encoder design and compression quality can dominate downstream robustness and bias more than language-model scale. Degraded audio can trigger hallucination, repetition, or compressed fairness gaps where all groups fail badly. Silence injection can selectively amplify accent bias.

The musical analogy is direct: the front end decides what the system can hear fairly. A representation that compresses away accent-relevant cues in speech may also compress away microtiming, timbral lineage, room evidence, or microtonal inflection in music. Bigger downstream reasoning cannot recover coordinates the front end made unreachable.

This is a crucial studio lesson. If a transcription tool misses expressive timing, if a stem separator damages a genre-specific timbre, if a generative model loops under rests, or if a codec flattens tuning nuance, the problem may not be in the musical idea. It may be in the representation through which the idea was forced to travel.

A reachable representation should therefore include failure tests. Add silence. Add reverb. Low-pass it. Compress it. Change notation modality. Disturb phase. Move it through the transformations the piece expects to survive. If the identity collapses, the map was not wrong in general. It was wrong for this journey.

## A Studio Test: Translation-Layer A/B

Build a sixty-second passage with drums, bass, chords, and one phase-sensitive or stereo-rich texture. Keep tempo, form length, key center, motif, and loudness constant. Then create four translations:

1. **Perceptual-grid translation:** process dynamics through Bark-like bands, then through arbitrary bands with similar gain movement.
2. **Phase translation:** preserve magnitude while maintaining phase relation in one version, then disturb phase while matching spectral balance in another.
3. **Notation translation:** reduce a four-bar excerpt to two codecs, such as ABC-like text and visual/staff or piano-roll form, then compose a variation from each.
4. **Front-end stress translation:** degrade the passage with low bitrate, onset masking, silence gaps, or coarse pitch quantization.

For each version, ask what relation survived: density, phase coherence, motif, hierarchy, timing, accent, harmonic path, source identity, or merely surface color. The falsifier is simple. If the supposedly aligned representation does not preserve audible continuity better than a surface-matched control, the representation is not carrying the musical claim.

The goal is not to crown one representation as correct. The goal is to discover which map is reachable for which musical promise.

## The Map That Lets the Piece Arrive

A reachable representation is a humble idea with large consequences. It says that musical theory, audio analysis, notation, machine listening, and production tools should be judged by the continuities they make playable. A map is not better because it is more detailed. It is better when it preserves the relation the piece needs while giving the composer an accessible path through transformation.

This turns representation choice into composition. Choose the grid. Choose the codec. Choose the phase relation. Choose the hidden carrier. Choose the path cost. Then write so the music can actually arrive.

The beautiful part is that this joins physics and listening. Ice does not become every possible crystal; it becomes the one its path can reach. A musical idea is similar. It does not become every valid transformation. It becomes the one whose representation lets the listener keep hold of the right evidence.

---

_Sources: cached synthesis context `data/generated/synthesis/2026-05-18T16-26-47-933Z/`, including ice-phase path dependence, Bark-scale dynamics, StreamMark semi-fragile watermarking, PHALAR phase-equivariant music representations, musical score understanding benchmarks, and speech-recognition front-end robustness/fairness. Connects to: [The Translation Layer](/docs/essays/the-translation-layer.md), [The Critical-Band Score](/docs/essays/the-critical-band-score.md), [The Reachable Identity](/docs/essays/the-reachable-identity.md), [The Listening Grid](/docs/essays/the-listening-grid.md), [The Evidence Carrier](/docs/essays/the-evidence-carrier.md), and [The Permitted Failure](/docs/essays/the-permitted-failure.md)._ 
