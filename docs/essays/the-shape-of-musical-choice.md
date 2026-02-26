# The Shape of Musical Choice

*How topology constrains harmony and statistics reveal melodic fingerprints*

---

Two papers landed in the same extraction batch and, at first glance, couldn't look more different. One is Dmitri Tymoczko building orbifolds out of chord spaces and classifying voice leadings by homotopy type. The other is a statistical study asking whether you can tell a Bach fugue subject from a Reger fugue subject by measuring six numerical features. One lives in algebraic topology; the other in multivariate statistics. But they're both asking the same question: **what constrains a composer's choices, and can we see those constraints geometrically?**

## Chords Live on Orbifolds

Tymoczko's central insight is disarmingly simple: if you represent a chord as a point in ℝⁿ (one coordinate per voice), then the symmetries we impose — octave equivalence, the interchangeability of voices — quotient that space down into something topologically interesting. Two-note chord space becomes ℝ²/(S₂ ⋉ ℤ²). Four-note transpositional set-class space is a cone over the real projective plane.

These aren't just abstract curiosities. A voice leading — the way one chord moves to another — is a *path* in this space. Two voice leadings are "the same" if one can be continuously deformed into the other (they're homotopic). The fundamental group of the space tells you how many essentially different types of voice leading exist between any two chords.

This is where it gets compositionally concrete. Neo-Riemannian transformations L, P, and R — the bread and butter of chromatic harmony analysis — turn out to be specific elements of this homotopy classification. They're contextual inversions: reflections within the orbifold. The Tonnetz, that hexagonal grid beloved of music theorists, is a partial picture of the orbifold's topology — but (Tymoczko argues) it doesn't fully capture the annular structure of the underlying space. The interscalar interval matrices do better, depicting the crossing-free subgroup of the homotopy group.

The punchline: **the "space" of available harmonic moves has a fixed shape, determined by the number of voices and the symmetries we accept.** Composers don't choose from an infinite palette — they navigate a manifold with a specific topology, and that topology channels their choices.

## Fugue Subjects Cluster in Feature Space

Now zoom in from the global shape of chord space to the local landscape of melodic invention. The fugue subjects study takes 238 organ fugues — 47 by Bach, 45 by Reger, 146 by others — and measures each subject along six dimensions: length, range, number of pitch classes, initial interval, number of unique intervals, and maximum interval.

The result? Bach's subjects occupy a *statistically distinct region* of this six-dimensional space. The first principal component captures 51% of the variance; three components get you to 80%. That's a strikingly low-dimensional structure for something as supposedly "free" as melodic invention.

The specific differences are telling. Bach's subjects have a significantly different *range* (compass) from later composers. All three composer groups differ in the number of unique pitch classes they employ — but most subjects, regardless of era, use 7 or 8 pitch classes, clustering tightly around diatonic writing. The initial interval doesn't distinguish anyone.

What's fascinating is *what doesn't vary*. The diatonic "attractor" at 7–8 pitch classes suggests a universal constraint — possibly rooted in the cognitive limits of tonal perception, possibly in the structure of keyboard instruments, possibly in something deeper about the geometry of pitch space itself. Meanwhile, the features that *do* vary (range, intervallic diversity) represent the dimensions where individual compositional personality can express itself.

## Constraints as Creative Scaffolding

Here's the connection that matters: **both papers reveal how mathematical structure constrains without determining.** 

Tymoczko shows that the topology of chord space limits the *types* of voice leading available. You can't escape the fundamental group — certain paths are topologically inequivalent, period. But within those constraints, there's enormous room for musical expression. A composer navigating the orbifold makes countless local choices that add up to a harmonic style.

The fugue study shows the same pattern at the melodic level. There's a low-dimensional skeleton (three principal components capture most of the action), a gravitational center (7–8 pitch classes, octave range), and then a cloud of individual variation around that center — variation that's coherent enough to constitute a recognizable compositional fingerprint.

This echoes something we've seen before in this research pipeline: the "symmetry as skeleton" idea from the gauge theory and scale theory extractions. Symmetry — whether it's the S₂ × ℤ² of voice permutation and octave equivalence, or the implicit ℤ₁₂ cyclic symmetry of the chromatic scale — creates the scaffolding. Composition is what happens within and against that scaffolding.

## What a Composer Navigates

Imagine a working picture: a composer sits down to write a fugue. They're operating, whether they know it or not, in a space with definite shape. The chord space is an orbifold whose topology determines which progressions are "nearby" and which require topological detours. The melodic space has a low-dimensional structure where 7–8 pitch classes is a gravitational center and range is the main axis of personality.

Bach's genius, in this picture, isn't that he somehow escaped the constraints — it's that he found a distinctive region of the constrained space and explored it with extraordinary thoroughness. His fugue subjects sit in a statistically identifiable cluster not because they're formulaic but because they represent a coherent *exploration strategy* within the available geometry.

This has a practical implication for composers: understanding the shape of the space you're navigating doesn't limit creativity — it clarifies what your actual degrees of freedom are. If you know that chord space is an orbifold with a specific fundamental group, you can make *intentional* choices about which homotopy class your voice leadings inhabit. If you know that fugue subjects cluster around 7–8 pitch classes with an octave range, you can decide to work within that attractor or deliberately push against it.

## Open Threads

Several questions ripple outward:

1. **Can the fugue subject features be re-derived from orbifold geometry?** The statistical study treats its six features as given. But range and pitch-class count might fall out naturally from a geometric model of melodic motion on the Tonnetz or in pitch-class space. If they do, the statistical clustering would have a topological explanation.

2. **What happens at the boundary?** Tymoczko notes that symmetrical chords (augmented triads, diminished sevenths) sit at singular points of the orbifold — places where the topology is especially constrained. Do fugue subjects that venture to the extremes of the feature space (11 pitch classes, like Bach's BWV 548) correspond to analogous singularities in melodic space?

3. **Cross-cultural universals.** The Kurdish maqam study from the same batch highlights how Western assumptions break down for non-Western music. Do the topological constraints of chord space hold universally, or are they artifacts of the 12-TET lattice? Maqam singing operates in microtonal space — what does the orbifold look like for continuous pitch?

4. **Dimensionality and complexity.** The fugue study finds 3 principal components suffice. The Tonnetz is 2D. Voice-leading orbifolds for n-note chords are n-dimensional. Is there a relationship between the number of effective dimensions at different levels of musical structure? Does complexity propagate or compress across scales?

---

*The deepest patterns in music aren't the notes — they're the shape of the space the notes move through.*
