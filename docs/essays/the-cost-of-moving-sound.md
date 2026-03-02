# The Cost of Moving Sound: Optimal Transport from Chords to Timbres

*Voice leading has always been about efficiency — moving notes the shortest distance. Optimal transport theory reveals this intuition is a special case of a much deeper principle that connects harmony, timbre, and the geometry of musical transformation.*

---

## The Composer's Oldest Optimization Problem

Every harmony textbook teaches the same thing: when moving from one chord to another, minimize the motion of individual voices. Don't leap when you can step. Hold common tones. This isn't arbitrary aesthetics — it's an optimization principle that Bach followed, that Palestrina codified, and that your ear enforces whether you've studied counterpoint or not.

But what *exactly* is being optimized? And is the same principle at work when a synthesizer morphs between two timbres, or when a vocalist shifts between registers?

Optimal transport theory — a branch of mathematics born from Gaspard Monge's 1781 question about the cheapest way to move piles of dirt — provides a unifying answer. The principle is: **musical transformations that sound natural are those that minimize a transport cost.** The "cost" measures how much total work is required to rearrange one configuration of sound into another.

## Monge's Problem in Musical Dress

Monge's original question was concrete: given a distribution of soil at various locations and a set of holes to fill, what's the cheapest way to shovel dirt from sources to destinations, where cost is proportional to distance moved?

Leonid Kantorovich reformulated this in 1942, allowing mass to be *split* — a pile of dirt can be distributed across multiple holes. This relaxation turned an intractable combinatorial problem into a tractable linear program and earned him the Nobel Prize in Economics.

Now replace "piles of dirt" with "notes in a chord."

A four-voice chord is a distribution of pitch mass at four locations on the pitch axis. Voice leading from one chord to another is exactly a transport plan: each note in the source chord must be sent to a note in the target chord, and the cost is typically the total semitone distance traveled. The *optimal* voice leading is the one that minimizes this cost — Monge's problem, wearing a musical hat.

Dmitri Tymoczko formalized this connection in his geometric theory of voice leading. The space of n-note chords, quotiented by octave equivalence and voice permutation, forms an orbifold, and the geodesic distance in this space corresponds precisely to the minimal transport cost. But Tymoczko's framework is primarily topological — it classifies voice leadings by homotopy type and identifies which transformations are "the same." Optimal transport adds something different: a *metric* that quantifies exactly how expensive each transformation is.

## From Pitch to Probability: The Wasserstein Distance

The real power of optimal transport emerges when we move beyond discrete notes to continuous distributions. A musical tone isn't just a pitch — it's a spectrum, a distribution of energy across frequencies. A violin's A4 and an oboe's A4 share a fundamental but differ in their spectral envelopes: the relative strengths of their overtones.

The Wasserstein distance (also called the earth mover's distance) measures the cost of reshaping one spectral distribution into another. Imagine the spectrum as a landscape of hills, one hill per harmonic partial. Morphing a violin spectrum into an oboe spectrum requires moving spectral energy — shrinking some partials, boosting others. The Wasserstein distance is the minimum total energy-times-frequency-distance required for this reshaping.

This is why timbral morphs that follow optimal transport sound smooth: they're moving spectral mass along the cheapest possible paths. Morphs that violate this — teleporting energy across the spectrum rather than sliding it — sound jarring, with artifacts that betray the artificial manipulation.

A recent paper by Selitskiy (arXiv:2505.04382) demonstrates this principle in voice conversion: using discrete optimal transport to align audio embeddings across speakers. The approach works by computing the barycentric projection of the transport plan — essentially finding, for each point in the source speaker's embedding space, the weighted average of where its mass should go in the target speaker's space. The result is voice conversion that preserves the linguistic content while smoothly transforming the timbral signature.

## The Unifying Principle

Here's where it gets interesting. Voice leading (pitch transport) and timbral morphing (spectral transport) aren't just *analogous* — they're instances of the same mathematical framework applied at different scales:

| Domain | Source distribution | Target distribution | Cost metric |
|--------|-------------------|-------------------|-------------|
| Voice leading | Notes of chord A | Notes of chord B | Semitone distance |
| Timbral morphing | Spectrum of timbre A | Spectrum of timbre B | Frequency distance |
| Spatial audio | Source positions | Target positions | Physical distance |
| Rhythmic transformation | Onset pattern A | Onset pattern B | Temporal distance |

In each case, the optimal transport framework says: find the rearrangement that minimizes total displacement, weighted by the amount of "stuff" being moved.

This isn't just a pretty abstraction. It explains several phenomena that music theory treats as separate:

**Why parallel fifths sound bad in counterpoint.** Parallel motion means all voices move in the same direction by similar amounts. From a transport perspective, this is *degenerate* — the transport plan collapses to a single rigid translation. The ear prefers transport plans with richer structure: contrary motion, oblique motion, voice crossing. These correspond to transport plans where mass moves in different directions, creating a more complex and interesting perceptual event.

**Why smooth timbral transitions sound natural.** A gradual morph from clarinet to flute follows the optimal transport geodesic through spectral space. The odd harmonics that dominate the clarinet spectrum smoothly redistribute into the flute's more sinusoidal profile. Abrupt timbral jumps — teleporting spectral mass — violate the transport optimality and register as a discontinuity.

**Why certain modulations feel "close" and others feel "distant."** The perceived distance between keys is well-predicted by the Wasserstein distance between their characteristic scale distributions on the pitch circle. C major to G major is cheap (move one note by one semitone: F→F#). C major to F# major is expensive (every note moves). This matches the classical theory of key distance, but optimal transport *derives* it from a single principle rather than relying on ad hoc rules about shared notes or circle-of-fifths proximity.

## Compositional Applications

For composers, optimal transport thinking suggests several concrete tools:

**Cost-controlled voice leading.** Instead of following rigid counterpoint rules, a composer could set a "transport budget" for each progression and explore all voice leadings that stay within budget. Low-budget progressions create smooth, connected textures. High-budget progressions create dramatic gestures. The budget itself becomes a compositional parameter.

**Timbral interpolation paths.** Given two target timbres, compute the optimal transport geodesic between their spectra. Intermediate points along this path define a perceptually smooth morph. This is already implicit in spectral synthesis techniques, but OT provides a principled way to parameterize the morph and control its rate.

**Cross-domain analogies.** A rhythmic pattern is a distribution of onsets in time, just as a chord is a distribution of pitches in frequency. The optimal transport between two rhythmic patterns defines the "cheapest" way to morph one groove into another. This could generate rhythmic transitions that feel as natural as smooth harmonic progressions — each onset slides to its new position rather than appearing or disappearing abruptly.

## The Deeper Pattern

What optimal transport reveals is that music is fundamentally about the *movement of distributions*. A melody is a pitch distribution evolving in time. An orchestration is a spectral distribution evolving across instruments. A rhythmic pattern is a temporal distribution of energy. And the aesthetic principles we've codified over centuries — smooth voice leading, gradual timbral change, natural-sounding modulation — are all manifestations of a single mathematical principle: **minimize the cost of transformation.**

This doesn't reduce music to optimization. The art lies in choosing *when* to follow the geodesic and when to violate it — when to whisper and when to shout, when to step and when to leap. But knowing the geometry of the space you're navigating, and having a principled measure of the cost of each move, gives you a map. And maps don't constrain explorers — they empower them.

---

*Sources: Selitskiy, "Discrete Optimal Transport and Voice Conversion" (arXiv:2505.04382); Tymoczko, "A Geometry of Music" (2011); Villani, "Optimal Transport: Old and New" (2008). Connection to CSyMR benchmark (arXiv:2601.11556) for compositional symbolic music reasoning.*
