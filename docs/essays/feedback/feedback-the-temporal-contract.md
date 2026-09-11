# Feedback: The Temporal Contract

## Overall Impression

The essay successfully turns latency and duration constraints into a compositional question: when must a sound become legible, and how long may it occupy? “Commitment time” and “occupancy time” are useful handles. “Risk time,” however, does not yet describe a temporal property; it imports Minimum Bayes Risk decoding because the other examples involve speech systems, then forces it into the three-part scheme. The essay would be stronger either with a genuinely temporal third pressure—revision horizon, deadline, or lookahead—or with MBR presented as a decision rule that can operate under a temporal contract, not as time itself.

## Structure and Argument

The opening examples establish two clear constraints: streaming translation must trade context for latency, and duration-controlled speech must fit content into a target span. MBR differs categorically. It minimizes expected loss over a candidate set under a chosen utility or error measure; it does not mean that “a decoder is not allowed unlimited certainty,” nor does it inherently “spend more time.” Name that distinction explicitly.

The definition—“the agreement between a sounding process and the time window in which it must become legible, useful, or complete”—bundles three different success conditions. Legibility concerns inference, usefulness concerns task, and completeness concerns form. A contract needs parties, obligations, and breach criteria. Define who sets the deadline, what must be delivered, and how failure is judged. This would make the later compositional recipe more than metaphor.

The recipe has a strong A/B logic, but the “risk version” asks a composer to minimize expected perceptual loss without defining a distribution of listener interpretations or a loss function. Frame it as a heuristic unless the essay supplies a concrete procedure. The conclusion lands well as a question, though it should acknowledge that listeners’ temporal limits vary with expertise, attention, culture, and context.

## Clarity and Flow

Claims about perception need citations. Listeners do not universally infer meter “before hearing the whole bar” or key “before the cadence”; often they form probabilistic expectations that revise over time. Similarly, familiar syntax may shorten recognition time, but “clear onset” does not necessarily establish the identity under discussion. The essay moves too freely among semantic meaning, musical identity, and usability.

The three sections would flow better if each used the same template: constraint, failure at one extreme, failure at the other, controllable musical variable. Occupancy currently lacks a clearly defined failure on the long side, while risk lacks a clock.

## Style and Voice

The temporal-promise metaphor is elegant and coherent with musical practice. Preserve “one voice obeys the duration contract while the room impulse response exceeds it”; it concretely demonstrates two coupled clocks. Avoid rhetorical inflation around technical methods. “That is a subtle but powerful shift” tells readers how to value MBR before explaining the metric dependence and candidate approximation that limit it.

## Line-Level Edits

- “time less like a neutral container and more like a negotiated constraint” → “time not merely as an index, but as a constraint on when a system must commit and how long its output may last.”
- “It has to decide when the evidence is sufficient to emit the next token” → specify whether the cited system learns a read/write policy, uses fixed chunking, or applies another latency mechanism. The current sentence may inaccurately attribute explicit sufficiency decisions.
- “Spoken Time Markers turn elapsed time into part of the model’s working representation” should define the markers and cite the model’s duration-error results.
- “the one that best survives uncertainty under the evaluation metric” → “the candidate with the lowest estimated expected loss under a specified metric and sampled hypothesis set.”
- “A listener infers meter before hearing the whole bar” → “A listener may begin forming a metrical hypothesis from partial evidence and revise it as the phrase unfolds.”
- “Clear onset, stable periodicity…” → “Depending on the target judgment, stable periodicity or repeated contour may accelerate commitment.” This avoids treating unlike cues as universally identity-bearing.
- Rename “risk time” to “decision risk,” then state that it interacts with time through available lookahead and compute.
- “a decoder is not allowed unlimited certainty” → “a decoder must choose despite residual uncertainty and finite candidates.” Certainty is not a resource that MBR allocates.
