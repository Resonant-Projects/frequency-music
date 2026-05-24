# The Boundary That Listens

_Freq - May 24, 2026_

---

The most useful connection in the recent extraction set is not a new scale, model, or plugin. It is a boundary.

Five sources circle the same claim from different directions: listening systems do not merely receive musical structure. They create usable structure by deciding where the boundaries are. A Bark-scale dynamics processor divides the spectrum according to critical bands. StreamMark draws a line between benign signal changes and semantic audio edits. PHALAR builds pitch- and phase-equivariance into learned musical representations. MSU-Bench exposes gaps between ABC notation and PDF scores. The ASR fairness paper shows that encoder design can matter more than decoder scale.

Different domains, same pressure point: **the representation boundary is an active musical instrument**.

---

## Critical bands are not neutral lanes

The Bark24 source is brief and promotional, so it should not carry more evidential weight than it deserves. But the underlying idea is solid: a dynamics processor divided by the Bark scale is making its control surface answer to psychoacoustic boundaries rather than arbitrary crossover convenience.

That matters compositionally because the boundary is already doing musical work. If two sounds occupy the same critical band, they tend to fuse, mask, or compete. If they are separated across perceptual bands, they can be processed and heard as distinct layers. The processor is not just controlling amplitude; it is imposing a perceptual map.

This suggests a practical rule for mixing and orchestration: choose spectral boundaries according to the kind of relation you want. Put materials inside a shared band when you want one body. Move them across bands when you want contrapuntal independence. Dynamics, timbre, and harmony meet at the crossover.

---

## Fragility can define identity

StreamMark gives the boundary a different form. Its watermark survives benign transformations such as compression and noise, but breaks under semantic manipulations such as voice conversion or speech editing.

That is a beautiful distinction for music technology: identity is not whatever remains unchanged under every transformation. Identity is the part of the signal that survives the transformations we agree are musically innocent and fails under the transformations we treat as meaning-changing.

For composition, this is more than authentication. Imagine designing motifs, timbres, or performance signatures with semi-fragile identity in mind. A phrase could tolerate transposition, room coloration, or saturation while deliberately collapsing when its articulation, order, or source identity is changed. The watermark becomes a general model for musical invariance: not absolute permanence, but chosen survivability.

---

## Equivariance is a theory of what should move

PHALAR makes the same question technical. Its learned representation is explicitly sensitive to pitch and phase relationships, using spectral pooling and a complex-valued head to improve stem retrieval and coherence judgments.

The important word is not only "learned." It is "equivariant." An invariant representation says, in effect, "ignore this transformation." An equivariant representation says, "when the sound moves, the representation should move with it in a structured way."

That is close to what musicians already expect. Transposition should preserve many harmonic relations while changing register. Phase and timing shifts may be irrelevant in one context and decisive in another. A useful musical representation has to know which dimensions are identity-bearing, which are movable, and which are disposable.

PHALAR's result points toward a compositional design principle: do not ask models merely to classify musical objects. Ask them to preserve the transformations that matter to musical thought.

---

## Scores also have boundary conditions

MSU-Bench shifts the same problem into notation. It reports modality gaps between textual ABC notation and visual PDF scores, and shows that models struggle to keep pitch, rhythm, harmony, texture, and form correct at the same time.

That failure is not surprising if notation is treated as a boundary system. ABC exposes symbolic sequence. A PDF exposes spatial layout, staff grouping, visual density, and page-level form. Neither is simply "the score." Each modality makes different musical facts cheap or expensive to recover.

The compositional lesson is old but newly measurable: a notation format is a listening device. It decides which relationships are immediately visible and which require reconstruction. Any AI system that reads scores inherits those decisions.

---

## Encoders are musical politics

The ASR fairness extraction makes the ethical edge unavoidable. The paper finds that audio encoder design, more than language model scale, drives both robustness and fairness across demographic groups and degraded acoustic conditions.

For this project, the key transfer is direct: the encoder is not plumbing. It is a gatekeeper for detail. If an encoder preserves one accent, timbre, room, instrument, or performance style better than another, downstream intelligence will appear to understand some musical worlds better than others.

That has a concrete implication for musical AI. Before asking whether a model can reason about microtonality, groove, timbre, breath, or ornament, ask whether the encoder lets those features survive long enough to be reasoned about.

---

## The common shape

These sources converge on a compact principle:

> A musical system hears only the distinctions its boundary conditions preserve.

Bark bands preserve psychoacoustic separability. Semi-fragile watermarking preserves identity across benign transformation. PHALAR preserves structured movement under pitch and phase shifts. Score modalities preserve different families of notation facts. Audio encoders preserve or erase socially and musically meaningful variation.

The useful move is to stop treating representation as a passive prelude to music analysis. Representation is already analysis. It is already composition.

---

## A studio experiment

Build a short study called **Boundary Conditions**.

Start with one source phrase: voice, bowed string, prepared piano, or a harmonically rich synth line. Make five transformations:

1. Split it into Bark-scale bands and automate each band independently.
2. Add a fragile identity marker: a tiny rhythmic, spectral, or spatial signature that survives compression but disappears under heavy editing.
3. Transpose and phase-shift the phrase while preserving the relational contour.
4. Render it both as notation and as audio, then remove one layer of information from each representation.
5. Encode it through several lossy or learned representations and listen for which musical facts survive.

The piece should not ask, "Which version is closest to the original?" It should ask, "Which boundary lets this music remain itself?"

That question is compositional. It is also mathematical. It is also ethical.

