# Feedback: The Cost of Moving Sound: Optimal Transport from Chords to Timbres

## Overall Impression

This essay promises a grand unified theory of musical movement, but it fails because it forces a rigid optimization metric onto aesthetic choices that are decidedly not about optimization. Using Optimal Transport (OT) to explain voice leading is a well-worn mathematical parlor trick, but extending it to explain _why_ counterpoint rules exist, or _why_ timbres sound natural, requires ignoring the actual perceptual and historical realities of music.

## Structure and Argument

The core argument is fatally flawed by a misunderstanding of what "optimal" means in music.

The essay states: "musical transformations that sound natural are those that minimize a transport cost." This is demonstrably false. The most natural-sounding music often involves massive leaps (octave displacement, sudden dynamic shifts, dramatic registral jumps). Music is not a logistics problem; it is a communication medium. Optimizing for "least work" results in Gregorian chant, not Stravinsky.

The section "Why parallel fifths sound bad" completely contradicts the premise of the essay. You state that Monge's problem seeks the "cheapest way to shovel dirt." In four-part harmony, parallel motion (a rigid translation where all voices move by a small, equal step) is mathematically incredibly _cheap_. It minimizes crossing paths and total distance. Yet you claim that because it is a "degenerate" transport plan, the ear dislikes it. You cannot argue that music optimizes for cheap transport, and then immediately argue that the cheapest transport sounds bad because the ear "prefers transport plans with richer structure." This destroys your own thesis. The ear prefers voice independence (avoiding parallel fifths) precisely _because_ it is harder to process and more informationally dense, not because it is computationally cheaper.

The table in "The Unifying Principle" is mathematically tidy but musically shallow. Rhythmic transformation is not "Onset pattern A to Onset pattern B." Rhythm is hierarchical; a downbeat has a fundamentally different structural weight than an upbeat. Treating rhythm as a flat distribution of "mass" across time ignores meter entirely. You cannot apply a continuous mass-transfer algorithm to a discrete, hierarchical metric structure and expect meaningful musical results.

## Clarity and Flow

The explanation of Monge and Kantorovich is clear and well-written. However, the pivot to Tymoczko's topological space is jarring. You introduce "orbifolds" and "homotopy types" without explaining them, assuming the reader will just trust that the math works. If OT provides a "metric" that topology lacks, you need to show that metric in action. Show the actual math of a chord progression being calculated.

## Style and Voice

The tone is arrogant, treating centuries of aesthetic evolution as mere approximations of a math equation. "This matches the classical theory of key distance, but optimal transport _derives_ it from a single principle rather than relying on ad hoc rules." This is historically backwards. The "ad hoc rules" (like the circle of fifths) are acoustic realities derived from the harmonic series. Your OT model is an abstract mathematical post-hoc description of those acoustic realities. You are mistaking the map for the territory.

## Line-Level Edits

> "The Wasserstein distance measures the cost of reshaping one spectral distribution into another. Imagine the spectrum as a landscape of hills..."
> **Critique:** This works for a continuous noise spectrum, but musical timbre is made of discrete harmonic partials. You cannot simply "slide" energy from 400Hz to 410Hz without creating an inharmonic, metallic clanging sound. Real-world timbral morphing involves amplitude modulation of fixed partials, not sliding mass across a frequency axis. The "dirt shoveling" analogy physically breaks down when applied to pitched spectra.

> "A gradual morph from clarinet to flute follows the optimal transport geodesic through spectral space."
> **Critique:** This is a massive assertion without proof. Have you calculated this? A clarinet has only odd harmonics; a flute has both, but heavily weighted to the fundamental. An OT algorithm sliding the 3rd harmonic of a clarinet down to become the 2nd harmonic of a flute would sound like a pitch-bending slide whistle, not a smooth timbral crossfade. This proves you are treating "spectrum" as an abstract mathematical curve rather than a physical acoustic reality.


## Update Check
These recent revisions successfully clarify the earlier points and strengthen the piece. The structural changes enhance the argument. Solid improvement.
