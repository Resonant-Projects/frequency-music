# Feedback: The Reachable Representation
## Overall Impression

The essay offers a valuable design principle: judge a representation not only by descriptive accuracy but by whether it preserves the relations a musical process needs to manipulate. The studio test and its falsifier are unusually concrete. The conceptual problem is that “reachable” accumulates too many meanings—kinetically accessible, perceptually continuous, robust to transformation, representable in notation, manipulable by a composer, and recoverable by a model. “Actionable” and “survivable” are also used almost interchangeably. Without a tighter definition, nearly any representational affordance or failure can be called reachability.

The cached synthesis directory is not a sufficient public citation. Every empirical claim about ice phases, auditory bands, watermarks, PHALAR, score benchmarks, and ASR fairness needs a conventional reference, and the essay should separate source findings from its own extrapolations.

## Structure and Argument

The opening definition says a reachable representation has coordinates that “remain actionable under the transformations the music must survive.” This combines two tests: can an agent intentionally move through the representation, and does a feature remain invariant after external processing? A watermark may survive compression without being an actionable musical coordinate; staff notation may be actionable without surviving a modality conversion. Split the concept into navigability and robustness, then argue that a representation is fit for a task when it supplies the needed degree of each.

The ice section usefully introduces path cost, but composition does not literally share metastable thermodynamics. “A modulation can be theoretically valid and still feel pasted in” invokes aesthetic judgment without specifying listener, style, or evidence. Frame path dependence as a compositional analogy and give a musical operationalization, such as listener ratings of continuity across transformations matched for destination.

The middle sections repeatedly reach the same conclusion—that representations preserve some relations and discard others—so the essay feels longer than its argument. The Bark, watermark, and PHALAR sections could be condensed into a taxonomy: perceptual grids organize evidence; robust codes carry information through attacks; equivariant representations preserve predictable transformations. Notation and fairness then become strong boundary cases showing that representational choices also distribute error.

## Clarity and Flow

Several technical formulations need correction or qualification. Bark bands, mel bands, ERB filters, STFT bins, and learned pooling are not merely alternative “grids”; they differ in psychoacoustic grounding, invertibility, resolution, and purpose. “Asymmetric phase coding” appears without introduction or a source in the final list. PHALAR’s better correlation with coherence judgments does not establish that phase preservation caused the improvement unless the study isolates that factor.

The fairness section is important but risks using harms to speech communities as an analogy for lost musical nuance. Keep the ethical claim on its own terms: front-end design can distribute recognition errors unequally. Then separately note the engineering analogy to music. “Compressed fairness gaps where all groups fail badly” also needs definition; a smaller group gap caused by uniformly worse performance is not improved fairness.

The studio test says “keep loudness constant” while changing dynamics processing and low bitrate; specify whether this means integrated loudness matching. The notation comparison also needs controls: different composers or repeated trials, otherwise differences may reflect one realization rather than the codec.

## Style and Voice

The voice is ambitious and coherent, but repetitive imperatives (“Choose the grid. Choose the codec…”) create a grand conclusion before the term is stable. Reduce claims of exactness and similarity across domains. The best stylistic mode is the careful sentence already present: “The graph is not more real than the sound. It is a window.” Bring that restraint throughout.

## Line-Level Edits

- “It is part of the piece’s reachability” could be “It constrains which transformations remain legible and controllable.”
- “The ice source … its lesson is exact” should become “The ice source offers a bounded analogy about path dependence.”
- “Composition has the same hidden constraint” should become “Composition can exhibit an analogous dependence on the path to an arrival.”
- “The representation is reachable only if its grid aligns with the listening task” confuses map and state. Consider: “The representation is fit for purpose only if its resolution preserves task-relevant evidence.”
- “ordinary notation barely sees” personifies notation. Use “ordinary notation does not explicitly encode.”
- “phase- and pitch-equivariant architecture” needs a concise definition of equivariance and exact task result.
- “Notation is a codec” should be marked as analogy: notation encodes instructions and relations, not necessarily an audio signal.
- Replace “Bigger downstream reasoning cannot recover coordinates” with “Downstream models cannot reliably reconstruct information eliminated by the front end without additional priors or evidence.”
- “Ice does not become every possible crystal” should not bear the final inference. End on the falsifiable design rule established by the studio test.

