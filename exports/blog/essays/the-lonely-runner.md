---
title: "The Lonely Runner: What Number Theory Knows About Musical Independence"
publishDate: 2026-03-07
excerpt: "The Lonely Runner Conjecture from number theory reveals a hidden mathematical guarantee in music: every voice in a polyphonic texture will eventually achieve maximum independence from all others, connecting contrapuntal practice to Diophantine approximation."
category: "mathematics"
tags:
  - "number-theory"
  - "mathematical-music-theory"
  - "group-theory"
  - "rhythm"
  - "perception"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

## Runners on a Circle

Imagine _n_ runners on a circular track of circumference 1. They all start at the same point, and each runs at a distinct constant speed. The **Lonely Runner Conjecture** (posed independently by Jörg Wills in 1967 and by Thomas Cusick and others in 1982) says:

> For each runner, there exists a moment when that runner is at distance ≥ 1/_n_ from _every_ other runner on the track.

Every runner, no matter how the speeds are chosen, will eventually find itself maximally isolated. The conjecture has been proven for up to 7 runners (Barajas and Serra, 2008) but remains open in general.

It's a clean, deceptively hard problem in Diophantine approximation — the study of how well real numbers can be approximated by rationals, or equivalently, how periodic processes at incommensurable frequencies relate to each other over time. And it has a shadow in music that's hard to unsee once you notice it.

## The Musical Restatement

Replace "runners" with "oscillators." Replace "circular track" with "the octave" (pitch classes modulo the octave). Replace "constant speed" with "frequency."

Now the Lonely Runner Conjecture says something about music:

> In any collection of tones at distinct frequencies, each tone will eventually find a moment of maximum independence from all the others.

This is a statement about the inevitability of voice independence in polyphonic textures. It says that no matter how you combine periodic signals — whether they're the partials of a complex tone, the voices of a fugue, or the rhythmic cycles of a polymetric groove — each strand is guaranteed a moment of maximum separation from the rest.

## Commas and Near-Misses

In ["The Comma Problem"](/docs/essays/the-comma-problem.md), we explored how stacking perfect fifths (ratio 3:2) never exactly returns to the octave. Twelve fifths overshoot seven octaves by the Pythagorean comma (~23.46 cents). This is the Lonely Runner problem in miniature: a single runner at speed log₂(3/2) ≈ 0.585 on a track of length 1 (the octave), and the question of how close it gets to integer multiples (octave equivalence).

The deeper connection: the reason the comma exists at all is that log₂(3/2) is _irrational_. The runner never returns to its starting point. It traces out an equidistributed sequence on the circle (by Weyl's theorem), eventually coming arbitrarily close to every point — but never exactly landing on any rational point. The comma is a measure of how badly "close" falls short of "exact."

Equal temperament distributes 12 points evenly around the octave — maximum uniform separation. But this is a _static_ geometry, not a kinematic one: the notes don't move at different speeds, so the Lonely Runner conjecture doesn't strictly apply. Where the conjecture _does_ illuminate music is in polyphonic voice leading, where voices genuinely move at different rates through pitch space, and the theorem's guarantee — that each runner eventually finds itself isolated — resonates with the contrapuntal principle that every voice deserves its moment of independence.

## Phase Music as Lonely Runner Experiment

Steve Reich's _Piano Phase_ (1967) — the same year Wills posed the conjecture — is perhaps the most literal musical enactment of the Lonely Runner scenario. Two pianists play identical patterns at very slightly different tempi. Over 15-20 minutes, the patterns gradually shift out of phase, pass through every possible alignment, and eventually re-synchronize.

The musical interest lives entirely in the geometry of the phase relationship. At certain alignments, the two patterns reinforce each other (unison, near-unison). At others, they create composite patterns that neither pianist plays alone. And at the points of maximum offset — the "lonely runner" moments — each pattern achieves its greatest independence, sounding almost as if it has nothing to do with the other.

Reich was exploring this empirically. The conjecture tells us it's _guaranteed_ — for any two periodic patterns at different rates, there must exist a moment of maximum separation. Music didn't need the proof. It heard the result.

## Counterpoint as Combinatorial Geometry

The rules of species counterpoint — avoid parallel fifths, approach perfect consonances by contrary motion, ensure each voice has its own melodic profile — are, at bottom, rules about maintaining voice independence. They are rules about keeping runners lonely enough to be heard as distinct.

Fux's _Gradus ad Parnassum_ (1725) codified these rules centuries before anyone formalized the mathematics. But the structure is the same: given _n_ voices, each constrained to move at its own pace through a shared pitch space, ensure that each voice achieves sufficient separation from the others to be perceived as an independent line.

The psychoacoustic reality backs this up. Albert Bregman's auditory scene analysis shows that the ear separates sound sources primarily by:

1. **Frequency separation** — sources at different pitches are easier to segregate
2. **Temporal independence** — sources with different rhythmic profiles stream apart
3. **Timbral coherence** — a consistent spectral profile groups partials into a single source

The first two are exactly the parameters of the Lonely Runner problem: spatial separation (frequency) and temporal behavior (speed/rhythm). The counterpoint tradition, the psychoacoustic research, and the number theory all converge on the same point.

## Polyrhythm and the Three-Gap Theorem

The **three-gap theorem** (also called the Steinhaus conjecture, proven by Sós in 1958) is a close relative of the Lonely Runner problem. It states that for any irrational rotation on a circle, the gaps between successive points come in at most three distinct sizes.

In rhythmic terms: if you place beats at times that are irrational multiples of a cycle length (like the golden ratio, φ ≈ 1.618...), the resulting rhythm has at most three distinct inter-onset intervals. This is why certain "maximally even" rhythms feel both regular and surprising — they distribute their beats as evenly as possible around the cycle while maintaining only a small number of distinct gap sizes.

Godfried Toussaint's work on Euclidean rhythms connects here directly. The Euclidean algorithm for distributing _k_ beats across _n_ time steps produces rhythms that are maximally even — the rhythmic equivalent of equally-tempered pitch. The tresillo (3+3+2), the son clave (3+3+4+2+4), the aksak meters of Balkan music (2+2+2+3) — all are Euclidean rhythms, all solve the same distributional problem the Lonely Runner conjecture addresses.

## What Loneliness Sounds Like

The deepest implication might be aesthetic rather than technical. The Lonely Runner Conjecture guarantees that in any texture of independent periodic processes, moments of maximum separation _must_ occur. You can't build a polyphonic texture so dense that every voice is always buried in the crowd.

This is reassuring for composers: voice independence isn't something you have to force. If you give each voice a distinct frequency of motion — its own speed, its own trajectory — the mathematics ensures that each will have its moment of solitude. The art is in choosing _which_ moments those are, and what you do with the convergences in between.

There's something poignant about the conjecture, too. It says that even in a crowd of runners, each one will find a moment when they're maximally alone. Not forever — the dynamics of the circle bring everyone back together eventually. But for that one guaranteed instant, each voice is as far from all others as the geometry of the situation allows.

Every fugue subject knows this moment. Every polyrhythmic pattern reaches it. Every partial in a complex tone has it. The mathematics just confirms what music already understood: independence is not the exception in periodic systems. It is the rule.

---

_Sources: The Lonely Runner Conjecture (Quanta Magazine, 2026); connections to Pythagorean comma via irrational rotation theory (Weyl equidistribution theorem); Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms" (2005); Bregman, "Auditory Scene Analysis" (1990); Sós three-gap theorem (1958)._
