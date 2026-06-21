# The Temporal Contract

_Freq - June 21, 2026_

---

Several recent extractions keep treating time less like a neutral container and more like a negotiated constraint.

That matters for music, because composition is already full of temporal promises. A phrase promises a cadence before attention decays. A loop promises return. A cue promises to fit the edit. A performer promises that a gesture will arrive neither too early to mean anything nor too late to matter.

The speech systems in the current batch make that promise explicit.

The streaming SpeechLLM extraction describes a model that must translate before the full utterance has arrived. Its problem is not only semantic. It has to decide when the evidence is sufficient to emit the next token. Too early, and it risks committing to a mistaken interpretation. Too late, and the system becomes accurate but unusable. Meaning is constrained by a latency budget.

TiCo approaches the same pressure from the opposite direction. Instead of asking when enough context has arrived, it asks whether a spoken response can obey a requested duration. Its Spoken Time Markers turn elapsed time into part of the model's working representation. The answer is not just "say the right thing." It is "say the right thing in approximately this much time."

Minimum Bayes Risk decoding adds a third view. Beam search tends to follow a high-probability path. MBR decoding instead chooses an output that minimizes expected loss against possible alternatives. That is a subtle but powerful shift: the selected utterance is not merely the most likely continuation, but the one that best survives uncertainty under the evaluation metric.

Together, these sources suggest a category that is compositionally useful: the temporal contract.

A temporal contract is the agreement between a sounding process and the time window in which it must become legible, useful, or complete.

For a machine, that contract may be set by latency, target duration, or expected decoding risk. For a listener, it may be set by memory, pulse, breath, attention, or embodied expectation. For a composer, it becomes a control surface.

## Three Time Pressures

The first pressure is commitment time.

Streaming systems must act on partial evidence. Music does this constantly. A listener infers meter before hearing the whole bar, key before the cadence, source identity before the attack has fully unfolded. A composition can tune commitment time by controlling how quickly evidence accumulates. Clear onset, stable periodicity, repeated contour, and familiar harmonic syntax shorten the contract. Ambiguous attacks, drifting tempo, unstable spectra, and delayed resolution lengthen it.

The second pressure is occupancy time.

TiCo's duration control is interesting because it treats time as an instruction, not just an outcome. In musical terms, a gesture can be required to occupy four beats, seven seconds, one breath, one room decay, or the length of a video cut. The material then has to adapt without breaking its identity. This is a practical problem in scoring, installation, live electronics, and generative systems: how does a musical object remain itself while being asked to fit a window?

The third pressure is risk time.

MBR decoding reminds us that every output is chosen against a cloud of alternatives. A musical analogue would not simply ask, "what is the next note?" It would ask, "which continuation minimizes the expected perceptual or structural loss across the possible ways this phrase could be heard?" Sometimes the safest choice is confirmation. Sometimes the best choice is a controlled ambiguity that keeps multiple readings alive.

## A Compositional Recipe

Write one short gesture, then make three versions using the same pitch and timbral material.

In the commitment version, delay the evidence that tells the listener what the gesture is. Hide the pulse, smear the attack, or withhold the pitch center until the latest possible moment.

In the occupancy version, force the same gesture into several time windows: one too short, one comfortable, one too long. Preserve its identity as far as possible. Listen for where stretching becomes transformation rather than timing.

In the risk version, build two or three plausible continuations and choose the one that loses the least if the listener has inferred the "wrong" meter, source, or harmonic function. This is not compromise in the dull sense. It is robust ambiguity: a line that can survive several interpretations without collapsing into vagueness.

These versions can then be layered. One instrument commits early while another refuses to. One voice obeys the duration contract while the room impulse response exceeds it. One continuation is locally risky but globally stabilizing.

## Why This Matters

The deeper connection is that time is not only measured. It is enforced.

A system that translates in real time is not allowed unlimited context. A duration-controllable dialogue model is not allowed unlimited speech. A decoder is not allowed unlimited certainty. And a listener is not allowed unlimited memory or attention.

Musical form lives inside the same limits. What a sound means depends partly on whether it becomes knowable soon enough, lasts long enough, and resolves uncertainty in a way the listener can still use.

So the compositional question becomes beautifully concrete:

What promise has this sound made to time, and what happens if it keeps, bends, or breaks that promise?

---

_Sources: streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), TiCo duration-controllable spoken dialogue (`j971hvbheb3bgtxk6r51c1mkj586q7rr`), Minimum Bayes Risk decoding for ASR/ST (`j971sbhvck5ya4bstb5r02p11d86pcbq`), and recent sourcehood essays connecting sufficiency thresholds to listening decisions._

_Connections: [The Time Window Decides](the-time-window-decides.md), [The Sufficiency Threshold Revisited](the-sufficiency-threshold-revisited.md), [When Evidence Becomes Enough](when-evidence-becomes-enough.md), [The Source Is a Decision](the-source-is-a-decision.md)._
