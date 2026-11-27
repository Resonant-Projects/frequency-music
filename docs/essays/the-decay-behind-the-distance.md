# The Decay Behind the Distance

*November 27, 2026 — a compositional hypothesis, not a listener-study result.*

A rhythm can stay exactly where it is on the grid while the sound between its onsets changes completely. The score specifies when to strike. The instrument decides how much of the previous strike remains when the next one arrives.

Two recent extractions make that distinction worth testing: a critique of mathematical rhythm distances and a textbook account of damping. Their connection is not an established explanation of rhythmic perception. It is a concrete experimental question: **does the perceptual usefulness of an onset-only distance depend on the decay of the instrument used to render the rhythm?**

## What the sources actually say

In his review of Godfried Toussaint's *The Geometry of Musical Rhythm*, Francisco Gómez-Martín writes: “I argued that the swap-distance does not reflect perceptual rhythmic similarity in all cases.” [1] His discussion of Chapter 33 contrasts clave son and clave bossa-nova: he describes a minimal directed swap but a substantial change in grouping. That is the reviewer's argument, not a new experiment independently verified here. He also discloses his personal and academic relationship with Toussaint.

The retained excerpt of Fletcher and Rossing's *The Physics of Musical Instruments* offers a different foundation: “There are many different mechanisms that can contribute to the damping of an oscillating system.” [2] Section 1.5 names sliding friction and viscous drag. This is reference physics, not evidence about listeners comparing claves. The capture is truncated and its extracted equations are damaged; no numerical decay prescription is being borrowed from it.

The review questions a mapping from symbolic transformation to perception. The textbook reminds us that an excitation is realized by a physical system with its own persistence. Neither source establishes that damping causes the reviewer's grouping example. That proposed bridge belongs to this essay.

## A small mathematical separation

Consider an intentionally simplified envelope, not a complete percussion sound:

`h_tau(t) = exp(-t / tau)` for `t >= 0`, and zero otherwise.

Here `tau` is an amplitude-envelope time constant. It is not reverberation time, a measured instrument parameter, or a perceptual threshold. Each unscaled envelope has squared-integral energy `tau/2`; multiplication by `sqrt(2/tau)` makes it unit energy. Normalize two copies and shift one by `delta`. Their uncentered normalized inner product over the entire real line, at that specified relative shift rather than maximized over alignment, is

`C(delta, tau) = exp(-abs(delta) / tau)`.

For nonnegative `delta`, this follows directly by dividing

`integral_delta^infinity exp(-t/tau) exp(-(t-delta)/tau) dt`

by `integral_0^infinity exp(-2t/tau) dt = tau/2`.

Keep the shift fixed at an illustrative 50 milliseconds:

| Envelope time constant | Normalized envelope overlap |
| --- | ---: |
| 20 ms | 0.082085 |
| 80 ms | 0.535261 |
| 320 ms | 0.855345 |

These are calculated examples, not source measurements. Midpoint numerical integration with a 10-microsecond step and a five-second window agreed with each analytic value to within `1e-7`.

The same temporal displacement produces very different envelope overlap when persistence changes. An onset-only representation cannot encode that variation unless the rendering parameters enter somewhere else.

This calculation does **not** validate a rhythm metric. It compares isolated, nonoscillatory envelopes, not repeated claves, pitched carriers, masking, perceived loudness, or human similarity ratings. It neither computes Toussaint's directed swap distance nor predicts that longer decay makes rhythms sound more similar. A real waveform's phase and spectrum introduce additional dependencies. The useful result is narrower: a fixed symbolic displacement leaves important signal-level quantities undetermined.

## An experiment a musician could run

Render the same pair of onset patterns with three envelope time constants, using one controlled synthesis source. Keep tempo, onset positions, carrier or noise spectrum, attack shape, and spatial treatment fixed. Change decay deliberately rather than comparing unrelated percussion samples, which would change several things at once.

Start with two short patterns differing by one onset displacement. Add further pairs with different locations and sizes of displacement; a single example cannot establish a metric's general usefulness. If testing the reviewer's clave comparison, first verify the intended cyclic patterns and distance convention from the underlying work. Do not treat the review's example as a fully specified implementation contract.

For repeated patterns, include a lead-in and control loop boundaries so tails are not accidentally truncated. Normalize rendered examples consistently, document the choice, and inspect peak levels. Equal energy is not equal perceived loudness; it also changes the peak of a normalized exponential as `sqrt(2/tau)`. Assess level and attack-amplitude confounds with an explicit control condition rather than claiming that peak, energy, and loudness were all held constant. Real instruments may have frequency-dependent decay; the one-constant envelope is a deliberately restricted first test.

Randomize listening order. Ask about at least two distinct things:

1. How similar are the two rhythms?
2. Where do the perceived groups begin and end?

A difference between those answers would itself be useful. Group boundaries and overall resemblance need not be interchangeable judgments. Record musical experience and familiarity with the patterns rather than treating one listener's grouping as universal.

**Hypothesis:** a symbolic distance's relationship to listener judgments changes across decay conditions. A controlled interaction would motivate a rendering-aware model. No meaningful interaction would constrain this hypothesis; the envelope calculation alone could not rescue it. No listening experiment has been conducted for this essay.

## Compose the persistence, not only the displacement

For composition, the immediate exercise is simpler than the study. Keep an onset pattern fixed and automate decay. Then keep decay fixed and move one onset. Compare which change most clearly alters the phrase's identity, separation, and grouping for you.

Do not begin with the rule that long tails blur rhythm or short tails reveal it. A tail can connect events, conceal an attack, or supply a new accent through interference with later sounds. Those outcomes depend on the actual sound and context. Listen for them rather than inferring them from a grid distance.

The grid remains useful. It describes one layer of a performance precisely. The mistake would be asking that layer to guarantee similarity after the instrument has changed what survives between the marks.

## Sources and provenance

1. Francisco Gómez-Martín, “A review of Godfried Toussaint's *The Geometry of Musical Rhythm*,” *Journal of Mathematics and Music* (2022), [doi:10.1080/17459737.2022.2025625](https://www.tandfonline.com/doi/full/10.1080/17459737.2022.2025625). Retained review prose inspected, especially its Chapter 33 discussion and concluding critique. Its cited perceptual studies, figures, formulas, and Toussaint's book were not independently checked. Live extraction: `j970pkpz7vjb995m71yf21afj58jym6q`; source: `jx78vfkaj98n0vsrmv0nfnnwys8jweef`.
2. Neville H. Fletcher and Thomas D. Rossing, *The Physics of Musical Instruments* (1991), [retained PDF source](https://csclub.uwaterloo.ca/~pbarfuss/The_Physics_of_Musical_Instruments.pdf), §1.5, “Damped Oscillations.” Inspected the retained prose capture, not the complete book or original mathematical typesetting. The current extraction describes a truncated capture through part of Chapter 2 and deliberately retains no numerical composition parameters. Live extraction: `j97a40c51w4cddsny3ac207m7d8jy1dk`; source: `jx7c7jewmet40t0t4449kwff218jx5w3`.

The exponential-envelope model, numerical examples, cross-source hypothesis, and experiment design above are this essay's deductions and proposals, not findings attributed to either source.
