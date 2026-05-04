# The Style Inside the Coordinates

_Essay #138 — May 4, 2026_

## The Hidden Choice

A musical system never begins with notes. It begins with a decision about what will count as a coordinate.

That sounds abstract, but three recent sources make the same point from different angles. Tonnetz theory says harmony can be treated as a combinatorial geometry: triads, seventh chords, pentatonic collections, and twelve-tone resources become configurations with explicit adjacency and incidence relations. A basso continuo study says performer identity can be recovered from a structured pitch-content representation called _griffs_. MSU-Bench says large multimodal models struggle with complete scores partly because the same music behaves differently when encoded as ABC text versus PDF notation.

Geometry, personal style, machine comprehension: three domains, one pattern. The representation is not a neutral container for music. It decides which differences are visible, which transformations are cheap, and which kinds of agency can leave a trace.

## Geometry Makes Harmony Traversable

The Tonnetz paper is the most explicit. It maps familiar harmonic materials onto named combinatorial configurations: the Eulerian tonnetz as a D222 configuration, diatonic seventh-chord voice leading as a Fano configuration, pentatonic music through Desargues, and twelve-tone resources through Cremona-Richmond. The point is not merely that these are elegant correspondences. The compositional promise is that a harmonic world becomes navigable once its objects are placed in a geometry.

A dominant seventh chord is no longer just a sonority. It is a point, line, or incidence relation inside a structure. A voice-leading move is no longer merely a stylistic habit. It becomes an edge, path, orbit, or traversal. The composer can ask questions that ordinary Roman-numeral analysis does not naturally ask: What does a Hamiltonian path through this harmonic space sound like? Which cycles return the ear home without returning the notes? What asymmetries appear if minor triads are modeled as hexacycles rather than as the duals of major triads?

This is the first coordinate lesson: when harmony is given a geometry, motion becomes a primary compositional parameter.

## Style Leaves Coordinates Too

The basso continuo paper appears, at first, to be about a different problem: performer identification. Given realizations by different players, can a model detect individual style? The reported answer is yes, using pitch-content features called griffs with Support Vector Machines.

What matters for us is not the classifier itself. It is the fact that personal style becomes measurable only after the performance is projected into the right feature space. Basso continuo is already a constrained practice: figured bass, voice-leading expectations, Baroque conventions, harmonic grammar. If everyone is drawing from the same rulebook, where does individuality live?

Apparently, it lives in the local realization choices: voicing units, spacing habits, pitch-content preferences, the small decisions that turn a shared harmonic skeleton into a particular hand at the keyboard. The griff is not just an analysis token. It is a coordinate for agency.

This complicates a common opposition between rules and expression. Rules do not erase style. They create a coordinate system in which style can become legible. A completely unconstrained improvisation may feel expressive, but its differences are harder to compare. A tightly constrained practice lets subtle deviations matter. In that sense, basso continuo resembles tuning: once the octave and scale degrees are fixed, the comma becomes meaningful.

The second coordinate lesson: style is not the absence of constraint; style is what remains detectable inside a shared constraint space.

## Notation Is an Interface, Not a Mirror

MSU-Bench adds the machine-listening version of the same argument. The benchmark evaluates whether language and vision-language models can understand complete musical scores across pitch, rhythm, harmony, texture, and form. One of its central findings is a modality gap: performance differs between ABC notation and visual PDF scores.

That should feel familiar to musicians. A score is not simply music written down. It is an interface to musical thought. ABC notation linearizes the score into text; PDF notation preserves visual layout, staff relationships, beams, measures, density, and page geography. Each representation foregrounds different invariants. ABC may make token sequence easier; PDF may make simultaneity and visual grouping more available. Neither is the music itself.

The benchmark's multilevel failures are especially revealing. Models may handle onset-level facts while losing form, or identify local symbols without integrating texture and hierarchy. That is not just a model weakness. It exposes a real representational challenge: complete musical understanding requires moving between coordinate systems. The same passage must be heard as events, intervals, voices, functions, gestures, textures, and formal roles.

The third coordinate lesson: musical intelligence is not one representation done well; it is the ability to preserve meaning while changing representations.

## The Connection

Put the three sources together and a useful principle appears:

**Music becomes composable, identifiable, and intelligible when a representation preserves the transformations that matter.**

For Tonnetz geometry, the important transformations are harmonic adjacency, duality, and voice-leading paths. For basso continuo, they are performer-specific realization habits inside a rule-governed practice. For score understanding, they are cross-level mappings between notation, rhythm, harmony, texture, and form.

A bad representation can still contain the data while hiding the music. A pitch-class set without adjacency hides motion. A raw MIDI roll may hide hand style. A visual score image may hide symbolic regularity; a text encoding may hide spatial simultaneity. The question is not "does this representation include the notes?" The better question is: "Which musical actions does this representation make natural?"

This gives composers a practical test for theory. If a theory cannot generate interesting moves, it may be a taxonomy rather than an instrument. If a feature representation cannot distinguish performers, it may be too coarse to hold style. If a notation cannot support cross-level reasoning, it may be useful for storage but weak as a musical interface.

## A Studio Recipe

Here is a compositional experiment that joins the three sources.

1. Choose a small harmonic universe: diatonic seventh chords, pentatonic collections, or a twelve-tone subset.
2. Represent it as a graph inspired by the relevant Tonnetz configuration. Nodes are sonorities; edges are allowed voice-leading moves.
3. Define three fictional continuo players as different traversal habits:
   - Player A prefers shortest paths and close voicings.
   - Player B prefers cycles and registral spread.
   - Player C prefers common-tone retention until a forced rupture.
4. Encode each realization in a compact feature vocabulary: voicing shape, bass interval, retained tones, registral span, chord-member omissions or doublings.
5. Generate several realizations of the same bass or progression, then ask: can you hear the player before you know the rules?

The goal is not historical authenticity. The goal is to make style audible as a geometry of choices. If listeners can identify the fictional player across different progressions, then the coordinate system is doing compositional work. It has made agency stable enough to recognize.

A second version would test notation directly: render the same generated passage as staff notation, ABC, piano roll, and graph traversal. Which representation makes the piece easiest to revise? Which reveals the harmonic plan? Which reveals the performer's hand? The answers will differ — and that difference is the point.

## The Aha

The beautiful thing here is that abstraction does not pull music away from performance. Done well, abstraction brings performance into focus.

Combinatorial geometry can seem remote from the keyboard. Machine-learning feature extraction can seem remote from musical touch. Benchmark design can seem remote from composition. But all three are asking the same musical question: what must be preserved for meaning to survive a change of form?

Maybe that is the deeper compositional use of mathematics. Not to replace the ear with diagrams, but to build coordinate systems where the ear can discover new paths, new constraints, and new signatures of human choice.

A chord is a sound. A chord in a geometry is a place you can move from.

A realization is a performance. A realization in griff-space is a trace of a musical mind.

A score is notation. A score across modalities is a test of what the notation truly knows.

The coordinates do not contain the music. But they decide where the music can leave fingerprints.

---

_Sources: Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources; Beyond Rules: Towards Basso Continuo Personal Style Identification; Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores_

_Connections: The Coordinate System Hears First (#122), Every Basis Has a Bias (#5), The Schema Is the Score (#83), The Frame Is the Signal (#105)_
