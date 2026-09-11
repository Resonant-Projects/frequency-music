# Feedback: The Decision Has A Shape
## Overall Impression

The essay offers an attractive unifying metaphor: decisions differ according to the distribution, timing, and cost of their evidence. Its four-part vocabulary—handle, narrowing, pressure, budget—could become a rigorous compositional framework. At present, however, “shape” remains metaphorical. Wide, narrow, arriving, and expensive describe different dimensions rather than shapes in a common space. The essay needs to specify the axes: breadth of available cues, ambiguity of hypotheses, accumulation time, and computational or cognitive cost.

The source synthesis also overstates equivalence. Speech separation, dataset curation, streaming translation, and proof complexity do not constitute four versions of one technical problem. The proof-complexity analogy is especially precarious: formal proof length is not directly comparable to perceptual inference difficulty. Mark it as an analogy and articulate what transfers—finite resources and deadlines—without importing mathematical authority into a psychological claim.

## Structure and Argument

The sequence is easy to follow and each source gets a named compositional operation. Yet the opening promises a single geometry that the body never formalizes. Add a framework paragraph after “That geometry has a shape”: a decision state consists of available evidence, competing interpretations, time remaining, and cost of evaluation. Then make each section vary one dimension while holding the others conceptually distinct.

“Correlation As Handle” makes a useful move from sources to recoverability, but it treats source identity as the recovered output when speech separation often estimates signals under permutation and target definitions that may not equal human identity judgments. “Curation As Narrowing” should acknowledge that dataset filtering narrows training examples, not necessarily the listener’s live hypothesis space. “Latency As Pressure” is the cleanest section because it clearly links accumulating evidence to a deadline.

“Proof As Budget” needs substantial restraint. A listener failing to infer a hidden ratio within a musical window is not analogous to a proposition requiring super-polynomial proof except at a very general level. Replace “proof” with “evidential path” for the musical case and avoid suggesting formal complexity results establish perceptual inaccessibility.

The compositional exercise usefully tests one decision under four conditions, but “make the proof too long” is not operational. Say which cues are delayed, degraded, or distributed beyond working memory. The conclusion should state how success will be measured: confidence, response time, stream count, recognition, or action choice.

## Clarity and Flow

Define “decision” as an observable classification or action, not every instance of understanding. Define “operationally available” relative to an agent, task, time window, and resource budget. Otherwise the essay slides among model output, performer response, conscious report, and tacit perception.

The claim that “the ear splits” or that a signal gives “enough grip to act” needs perceptual grounding. Auditory scene analysis supports roles for common onset, harmonicity, spatial cues, and timbre, but their effects are context-dependent. Add citations for those human-listening claims rather than relying only on the machine-learning papers.

The sources are named by title or extraction ID, but readers need primary references and reported conditions. In particular, identify the proof-complexity result precisely and explain what “effective zero knowledge” means; the current label is too opaque to evaluate.

## Style and Voice

The voice is strongest when it converts abstract limits into compositional questions: “do not only write sources; write the handles.” Preserve that imperative quality. Reduce the frequency of aphoristic closure—“The handle is part of the instrument,” “Curation is the art…,” “The sound is not only…”—because each makes a local analogy sound like a settled theorem.

Capitalize “as” consistently in headings according to the project’s title style; “Correlation As Handle” and the essay title’s “A” look mechanically title-cased. More importantly, use fewer agentive formulations where no agent chooses (“the piece controls when knowledge is cheap”) and name the relevant cues and constraints.

## Line-Level Edits

- “These are not separate problems” is indefensible. Try: “These distinct problems can be compared along shared dimensions of evidence availability, timing, and cost.”
- “The mixed signal is not asked to disclose a speaker directly” is unclear. Replace with: “The model estimates separation filters from learned time-frequency and spatial correlations rather than predicting a speaker label.”
- “If those handles align, the ear splits them easily” ignores fusion cues and listener variation. Try: “When several segregation cues agree, listeners are more likely to hear distinct streams.”
- “Curation is the art of deciding which ambiguities are allowed to enter the room” should specify: “Dataset curation decides which ambiguities appear in the training distribution; composition can similarly stage which ambiguities listeners first encounter.”
- “Some statements may be true but require proofs too long to write down” needs the exact complexity-theoretic scope and citation.
- “the relation is not operationally available” should read: “the relation may not be available for the specified listening task within that time window, even if it influences lower-level perception.”
- “a contour of available proof” is evocative but undefined. Consider: “a time-varying profile of available cues, competing interpretations, and inference cost.”
