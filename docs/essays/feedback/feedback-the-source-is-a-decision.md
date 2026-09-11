# Feedback: The Source Is a Decision

## Overall Impression

This essay is rhetorically polished and has the most explicit framework of the sourcehood group: “operational sourcehood” ties evidence to action under constraints. Its central problem is conceptual overreach. It calls dataset labeling, neural separation, translation timing, listener grouping, and proof feasibility versions of a “source decision,” though two of those examples do not determine a source at all. The proof-complexity analogy is especially fragile. Narrowing the thesis to operational attribution would yield a more defensible and distinctive essay.

## Structure and Argument

The first two studies form a coherent foundation: one concerns preserving discriminative information for speaker separation; the other operationalizes a criterion for class-pure sound events. The streaming SpeechLLM study supports commitment under incomplete temporal evidence, but not source identity. Mark it as an analogy that contributes the time constraint, not as another empirical case of sourcehood.

The proof-complexity passage needs substantial revision or removal. “Truths or vulnerabilities…cannot be proven within practical limits” compresses a technical field into an ambiguous anecdote. Effective unprovability, computational infeasibility, and proof length are not interchangeable. “An unprovable flaw can behave like no flaw at all” is both too broad and potentially false depending on the cited result. Even translated “carefully,” the analogy equates formal provability with perceptual evidence thresholds without a shared mechanism. If retained, name the theorem or result, define the resource bound, and label the connection purely heuristic.

“Operational sourcehood” is useful, but “status a sound earns” anthropomorphizes the process, and “as one thing” hides whether the thing is an emitter, class, stream, or causal event. Define it as a system-relative assignment that groups observations for a specified action. Then the acoustic and institutional lists become evidence and priors affecting that assignment.

The composition section gives concrete parameters, but several are not directly controllable in a listener: a “sourcehood threshold” belongs to a model unless instantiated through acoustic cue agreement; “identity metadata” includes visual cues, which require a multimodal performance context. Split model controls from compositional manipulations.

The cost paragraph is promising. Identity may cost capacity and latency for a model, but “evaluative honesty” is not the same type of resource. Reframe as tradeoffs: inference costs, data constraints, and protocol transparency. The ending lands well after qualification; “can afford to make” should refer to a named system and task.

## Clarity and Flow

The essay needs a stable taxonomy of source, source identity, and operational sourcehood. It currently slides from speaker disentanglement to event-label purity to token sufficiency. A reader cannot tell whether the shared object is cause attribution, grouping, or any decision made from audio.

The paragraphs are logically ordered, but transitions use assertion (“adds the temporal edge,” “sharpens the analogy”) where they should state the limitation. Explicitly saying “this is no longer a source-identification task” would increase trust and make the synthesis more sophisticated.

## Style and Voice

The confident aphoristic voice is effective, especially “a contract between signal, representation, task, and time.” It also encourages overstatement. Phrases like “manufacturing conditions where the system is allowed to believe” and “listener’s permission” personify protocols and perceptual processes. Retain the metaphor at major turns but use literal descriptions around it.

The essay repeats “source is not…” variants. Reduce them so the final two-line reversal feels earned rather than preannounced.

## Line-Level Edits

- “A source is not merely discovered…It is decided under constraints.” → “What counts as a usable source is inferred under task, data, and latency constraints.”
- “identity cannot be left until the end” → “the architecture’s reported performance supports preserving speaker-discriminative information before the final decoding stages,” with results.
- “allowed to believe in one source at a time” → “trained to identify recordings meeting the paper’s criterion for a single-class event.”
- “That is a source decision too” → “That is a related sufficiency decision, though it concerns token emission rather than source attribution.”
- “truths or vulnerabilities” must identify the actual object of the proof-complexity result.
- “A source distinction that cannot be established in time may be real” → “For a time-bounded task, an attribution that cannot be computed before action may be operationally unusable.”
- “Low thresholds give the listener objects quickly” → “In a model, lower grouping thresholds produce earlier assignments; an acoustic analogue would require stronger specification.”
- “identity is expensive” → “reliable attribution can require resolution, capacity, labeled data, or latency.”
