# What Comes Apart

**Essay #104** — April 9, 2026

## The Question

When can you pull two aspects of sound apart — and when are they fused into one thing? The answer turns out to depend not on the sound itself, but on how you represent it.

## The Evidence

Four recent papers trace the same boundary from different directions.

**StressTest** evaluates whether speech-aware language models can detect sentence stress — the emphasis placed on specific words to convey meaning. The finding: current SLMs perform poorly, despite strong general audio capabilities. What makes this striking is that sentence stress is *separable* from lexical content at the signal level. The same words carry different meanings depending on which one you stress. "I didn't say *he* stole the money" and "I didn't say he stole *the money*" are acoustically different — F0 contour, duration, amplitude — but lexically identical. Stress lives in a channel that's parallel to but independent of the words. You can change the meaning by changing only the emphasis.

Yet SLMs, which represent speech as unified embeddings, can't see this separation. The representation collapses the two channels into one.

**LRCM** demonstrates the opposite case: successful decoupling. This dance generation framework separates motion capture data, audio rhythm, and text descriptions into independent features, then conditions generation on each modality separately. Rhythm becomes an isolated signal that can drive choreography on its own. The feature decoupling paradigm works precisely because the representation was designed to keep these streams apart. Audio rhythm, motion, and verbal description are different enough in their statistics that they can be projected into separate subspaces — and the system benefits from treating them as independent conditioning signals.

**Backdoor Propagation in SLMs** finds the dark side of representational fusion. When a speech language model is poisoned with backdoor-carrying samples, the contamination propagates through the entire pipeline and becomes inseparable from clean data in the shared multitask embedding space. Common filtering defenses fail because the representation doesn't preserve the distinction between poisoned and benign. The two become one thing.

**CDMA** — cross-linguistic depression detection from speech — demonstrates that emotional arousal markers are separable from language. Acoustic signatures trained on Italian speakers transfer to Chinese Mandarin, achieving high accuracy across languages that share essentially no phonemic inventory. The depression signal lives in a representation space (prosodic contour, spectral characteristics) that's orthogonal to linguistic content. Arousal comes apart from language.

## The Pattern

Whether two properties of sound are separable depends on the space in which you ask the question.

In the *signal domain*, prosodic stress and lexical content coexist in the same waveform but occupy distinguishable acoustic dimensions — you can measure F0 contour independently of phoneme identity. In the *feature domain*, rhythm separates cleanly from motion and text when you design the representation to maintain that separation. In the *embedding domain*, clean and poisoned samples dissolve into the same distributed representation and can no longer be told apart. And in the *cross-linguistic domain*, emotional arousal maintains its separability from linguistic content because it lives in acoustic properties (spectral flux, tempo perturbation) that languages don't control.

The same signal. Different representations. Different answers to "what comes apart?"

## The Musical Parallel

Musicians have always navigated this. Consider:

**In notation**, pitch and rhythm are perfectly separable — different symbol systems, different visual axes on the page. A composer can modify one without touching the other. This is notation's great power and its great illusion.

**In performance**, they're entangled. A slightly late note changes the harmonic rhythm. A held pitch alters melodic phrasing. Swing transforms the metric grid without changing a single pitch, yet it changes everything about how the harmony breathes. The performance representation doesn't preserve notation's clean separation.

**In the mix**, timbre and loudness seem separable — EQ controls frequency content, faders control amplitude. But psychoacoustically, they're coupled: louder sounds brighter (equal-loudness contours), and perceived brightness depends on both spectral centroid and level. The mixing board's representation promises independence that the ear doesn't honor.

**In the score**, melody and accompaniment are separable (different staves, different instruments). In the listener's perception, they're one texture. This is why "the same tune with different harmonies" isn't really the same tune — the listener's representation fuses them.

The lesson that emerges across all four papers and all four musical examples: **separability is not a fact about the signal. It's a fact about the representation.** And choosing a representation is choosing what you can independently control.

## The Deeper Implication

This reframes a fundamental question in music technology and theory. When we ask "can we separate vocals from instruments?" or "can we isolate the rhythm from the melody?" or "can we extract the emotion from the performance?" — we're not asking about the signal. We're asking whether we have a representation in which those things live in orthogonal subspaces.

The StressTest result suggests that current speech models have *collapsed* a separation that the signal preserves. The LRCM result shows that careful representational design can *maintain* a separation that's useful. The backdoor result shows that representational fusion can make *even adversarial contamination* invisible. And the CDMA result shows that some separations are robust enough to survive changes in the signal domain (different languages, different speakers) because the relevant information lives in a subspace that those changes don't affect.

For composition, this means: the representational choice is the first creative decision. Whether you compose in notation (where pitch and rhythm separate), in a DAW (where time and frequency separate), in a modular synth (where voltage sources separate), or in code (where anything you parameterize separates) — the representation determines which musical dimensions you can manipulate independently. The rest are entangled, and you'll have to navigate them as coupled quantities.

The papers suggest this isn't a limitation to overcome. It's a structural feature to understand. Some things come apart. Some don't. And the boundary between them is the representation itself.

## Connections

- **Essay #99** ("The Basis Problem"): basis choice determines visibility; this essay extends it to *separability* as the key consequence
- **Essay #101** ("The Grain of the Signal"): grain determines what's resolvable; separability is grain's sibling — what's resolvable and what's independently controllable are related but distinct
- **Essay #102** ("What the Machine Hears"): physics vs. culture in learned representations; separability may be the test — culturally entangled features won't separate under representation change, physically grounded ones will
- **Essay #103** ("Where the Signal Breaks"): boundary fragility as information; inseparability at regime boundaries may be *why* those boundaries are fragile — you can't independently adjust what you can't pull apart

---

*The representation is not the territory. But it determines which paths through the territory you can walk independently.*
