# Feedback: The Self-Measuring Voice

## Overall Impression

This is the most focused of the “self-measuring” pair. The distinction between an input-side evidence clock and an output-side expenditure clock is useful, and the essay repeatedly returns to the practical demand that a live system must finish as well as start. The main weakness is conceptual inflation: the “output clock” begins as an explicit representation of elapsed generation time, expands to any musician’s awareness of phrase length, then expands again to RIR decay and MBR risk. Those are illuminating analogies, but they should not be presented as the same mechanism.

The essay should anchor the technical claim in TiCo’s actual design and evaluation: what a Spoken Time Marker encodes, how often it appears, how duration requests are represented, and what improves relative to baselines. Without that information, “internal representation” risks implying introspective temporal awareness rather than conditioning on engineered tokens.

## Structure and Argument

The opening builds cleanly from TiCo to streaming translation and produces the essay’s strongest formulation: “One clock measures evidence; the other measures expenditure.” Use that distinction to organize everything that follows. The room should be introduced as an external persistence clock, not another output clock in the same sense. MBR belongs under a separate decision-policy section and currently weakens the argument because expected-risk decoding is not inherently temporal.

The musician analogies need care. Singers and drummers can adjust motor plans using embodied feedback; a generative model conditioned on time markers may not “listen backward and forward” or monitor itself continuously. Present the analogy at the level of function—both allocate material under a deadline—without suggesting equivalent cognition.

The “temporal risk” section names too many heterogeneous failures. Dryness and certainty are not temporal errors; reverberance can affect perceived duration but is not itself a clock failure. Define a loss function over endpoint deviation, truncation, semantic omission, prosodic distortion, and overlap with the next turn. Then identify genuine tradeoffs: meeting a duration target may increase speaking rate or reduce content completeness.

The exercise is strong, but “room close before the phrase has emotionally finished” is not measurable. It can remain as an artistic instruction, paired with a concrete manipulation such as gating the tail before a cadence or breath release.

## Clarity and Flow

“Real-time generated speech” may not accurately describe TiCo unless the cited system is streaming and tested at interactive latency. Duration-controllable spoken dialogue is not automatically real-time. Verify this or remove “real-time.” Likewise, Streaming SpeechLLM’s emission policy should be described accurately: does it explicitly estimate sufficiency, use fixed blocks, or learn alignment? Cite the relevant mechanism.

The distinction between quantization and an output clock is valuable but overstated. Quantization need not be post hoc, while an elapsed-time signal does not itself decide how to compress or conclude. The policy using that signal makes the decision. Separate state representation from control policy.

## Style and Voice

The voice is vivid without becoming opaque, particularly in the performer examples. Preserve “A tool that only starts at the right moment is incomplete. It also needs to know how to finish.” Reduce repeated anthropomorphism around clocks “feeling” and rooms “measuring.” One framing sentence can authorize the metaphor while the technical passages remain literal.

The conclusion repeats “internal” and “self-measuring” without addressing a key limitation: explicit elapsed-time conditioning can hit a deadline while producing rushed or incomplete phrasing. Ending with that tradeoff would make the promise defensible rather than merely clear.

## Line-Level Edits

- “Real-time generated speech” → “Duration-controlled generated speech,” unless real-time operation is demonstrated.
- “ordinary instruction following is not enough” → “the authors report that text-only duration instructions underperform explicit Spoken Time Markers on [named metrics].”
- “The model needs Spoken Time Markers” → “TiCo introduces Spoken Time Markers to expose elapsed output time during generation.” Avoid universal necessity.
- “A voice that cannot measure itself will overshoot, pad, rush, or trail off” → “Without usable remaining-duration state, a model may miss the target or compensate through padding, truncation, or rate changes.”
- “The output clock lives inside the gesture” → “The output clock is state supplied during generation; the decoding policy uses it to allocate the remaining material.”
- “The room keeps measuring after the source stops” → “The room response continues after excitation ends, extending the perceived event.”
- “A late perfect answer can be wrong” → “In an interactive objective that penalizes latency, a semantically better but late answer can receive higher total loss.”
- “too dry, too reverberant, or too certain” → remove “too certain” from temporal risk and treat dry/reverberant balance as a factor in event overlap or perceived completion.
