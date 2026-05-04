# The Handoff Between Maps

_Essay #139 — May 4, 2026_

## The Musical Problem Is Translation

A score, a graph, and a performance feature vector are all maps. None of them is the territory. The interesting question is what survives when music is handed from one map to another.

Three recent sources make that question unusually concrete. A Tonnetz paper maps harmonic materials onto combinatorial configurations: Fano for diatonic seventh-chord voice leading, Desargues for pentatonic resources, Cremona-Richmond for twelve-tone structure, and D222 for the classical triadic Tonnetz. A basso continuo study shows that individual performers can be identified from _griffs_, structured pitch-content units inside a historically constrained improvisatory practice. MSU-Bench evaluates whether large language and vision-language models can understand complete musical scores across ABC text and PDF notation, exposing modality gaps and failures of multilevel reasoning.

The shared lesson is not merely that representation matters. That is true but too easy. The sharper lesson is this:

**Musical understanding lives in the handoff between representations.**

A representation becomes powerful when it can carry the right invariants into another representation: from graph to sound, from realized chord to performer identity, from notation image to harmonic and formal reasoning. When the handoff fails, the notes may remain present while the music disappears.

## A Geometry Must Become a Gesture

The Tonnetz is compelling because it turns harmonic relation into spatial relation. Once chords become nodes and voice-leading relations become edges, a composer can treat harmony as traversal. A progression is no longer only a sequence of chord symbols; it is a path through a configured world.

But a graph is not yet music. The graph becomes musically useful only when its structure survives the handoff into gesture. If a shortest path through the Fano configuration produces voice leading that the hand can play and the ear can follow, then the geometry has become an instrument. If a Cremona-Richmond traversal creates a twelve-tone progression with audible return, contrast, or pressure, then the abstract configuration has crossed into composition.

This is the practical test of mathematical music theory: not whether the correspondence is elegant, but whether its transformations remain audible after rendering.

A composer working with these geometries might ask:

- Which graph paths produce smooth hand motion?
- Which cycles sound like harmonic return without literal repetition?
- Which symmetries become perceptible, and which remain diagram-only?
- What changes when minor triads are treated as hexacycles rather than major-triad duals?

That last question is especially rich. Breaking major/minor duality is not just a theoretical move. It changes the handoff. The composer no longer translates both modes through the same mirror. Major triads and minor triads enter the musical surface through different geometric roles. That asymmetry could become audible as different kinds of stability: one sonority as object, the other as cycle.

## A Style Must Become a Coordinate

The basso continuo study begins from a different kind of handoff: performance to feature space. Basso continuo is constrained by rules, conventions, and historical practice, but the player still chooses voicings, doublings, spacing, and local realizations. The study's use of griffs suggests that individual style can be detected when those choices are encoded at the right grain.

That is a beautiful result for composition because it reframes style as a residue of decisions inside a constraint system. Personal expression is not floating above the rules. It is written into the rule-governed surface as a pattern of preferences.

The handoff here runs like this:

performance → griff representation → classifier → inferred player identity.

Each arrow can fail. Raw performance data may be too detailed to compare. A feature space may be too coarse to retain identity. A classifier may find statistical shortcuts rather than musical agency. But when the chain works, it reveals something important: style has coordinates.

For a composer, this suggests a generative technique. Define several artificial continuo personalities over the same harmonic graph:

- one prefers common-tone retention,
- one prefers registral expansion,
- one prefers stepwise inner voices,
- one prefers delayed resolution,
- one prefers compact griffs near the hand,
- one prefers open sonorities that expose the bass.

Now the graph does not merely generate harmonic motion. It generates interpretable agents moving through harmonic motion. The same underlying path can produce different surfaces because different style coordinates govern the handoff from structure to realization.

This is where the Tonnetz and basso continuo sources snap together. A harmonic graph tells us where motion can go. A griff-like feature vocabulary tells us how a player tends to realize that motion. One maps possible routes; the other maps signatures of choice.

## A Score Must Become Many Scores

MSU-Bench adds a third handoff: notation to machine reasoning. Its modality gap between ABC notation and PDF scores should not surprise musicians. ABC and PDF preserve different invariants.

ABC is linear, symbolic, and token-friendly. It makes pitch and rhythm available as text, but can obscure simultaneity, page geography, staff grouping, and visual density. PDF notation preserves the visual score surface, including spatial relationships and layout cues, but requires symbol recognition before musical reasoning can even begin.

The benchmark's multilevel failures matter because complete score understanding is not one skill. It requires local onset recognition, pitch and rhythm parsing, harmonic integration, texture tracking, and formal abstraction. The model must repeatedly translate: symbol to event, event to voice, voice to harmony, harmony to phrase, phrase to form.

That chain resembles human musicianship more than it first appears. A player reading a score is constantly changing maps. The eye sees notation; the hand prepares gestures; the ear predicts sound; theory tracks function; memory tracks form. Musical fluency is not possession of one perfect representation. It is the ability to keep meaning stable while switching representations.

So MSU-Bench is not only an AI benchmark. It is a mirror for a compositional problem: how do we design musical artifacts that survive many readings?

A piece might be clear as a graph but awkward as notation. It might be elegant as ABC but visually opaque. It might be playable but analytically illegible. It might be theoretically coherent but impossible for a listener to parse. Every handoff is a stress test.

## The Handoff Principle

The connection across the three sources can be stated as a working principle:

**A musical representation is compositional when it preserves action across a handoff.**

The key word is action. A representation does not need to preserve everything. It needs to preserve what the musician or system must do next.

- A Tonnetz preserves adjacency so the composer can move.
- A griff representation preserves realization habits so style can be recognized or generated.
- ABC preserves symbolic sequence so text models can reason over notes.
- PDF notation preserves visual organization so performers can read dense simultaneity.
- A performance preserves timing, touch, and energy so listeners can infer intention.

Problems arise when we confuse storage with action. A representation may store the notes but fail to support the next meaningful musical operation. That is why a MIDI piano roll, Roman numeral analysis, staff notation, waveform, spectrogram, and graph can all be accurate and still disagree about what is important.

The composer's job is to choose the map whose actions match the piece's question.

## A Studio Recipe: The Same Path, Three Handoffs

Here is a practical experiment that joins the sources.

1. Build a small chord graph inspired by a Tonnetz configuration: diatonic sevenths are a good starting point.
2. Choose one path through the graph: eight to sixteen chords, with at least one return and one rupture.
3. Realize the path three times using different griff-like style profiles:
   - _Compact_: close voicings, common-tone retention, minimal registral motion.
   - _Rhetorical_: delayed resolutions, accented dissonances, wider cadential spacing.
   - _Transparent_: sparse doublings, clear bass-motion exposure, light inner voices.
4. Export each realization in three representations: staff/PDF, ABC or symbolic text, and audio.
5. Ask three questions:
   - Can listeners identify the style profile from audio alone?
   - Can a musician identify the graph path from notation?
   - Which representation makes revision easiest?

The experiment is small, but the result could be revealing. If the path is visible in the graph but not audible, the geometry failed its handoff into gesture. If the style profile is audible but not notatable, the feature vocabulary may be missing something. If ABC clarifies sequence but hides texture, the notation handoff has exposed its bias.

That is useful failure. It tells the composer which map is doing real work and which map is only decorative.

## The Aha

The exciting thing is that these sources give us a way to make abstraction accountable. Mathematical structure, performance identity, and machine score understanding can all be tested by the same question: what survives translation?

A graph earns its keep when it becomes a playable route.

A performance feature earns its keep when it carries the player's fingerprint.

A notation earns its keep when it supports reasoning across levels.

Maybe this is one reason music is so resistant to a single theory. Music is not one object waiting for one perfect representation. It is a chain of transformations: imagined, notated, fingered, sounded, heard, remembered, analyzed, revised. Each stage needs a map, and every map loses something.

Composition begins when we decide what must not be lost.

---

_Sources: Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources; Beyond Rules: Towards Basso Continuo Personal Style Identification; Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores_

_Connections: The Style Inside the Coordinates (#138), The Coordinate System Hears First (#122), Every Basis Has a Bias (#5), The Schema Is the Score (#83)_
