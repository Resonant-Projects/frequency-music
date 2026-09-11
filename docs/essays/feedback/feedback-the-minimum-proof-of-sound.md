# Feedback: The Minimum Proof of Sound

## Overall Impression

This essay has one of the collection’s most distinctive concepts: composition as calibrated disclosure of evidence. “Proof timing,” “proof bandwidth,” and “proof disclosure” form a useful compositional vocabulary. The argument becomes unreliable when it treats statistical sufficiency, source separation, dataset filtering, perceptual binding, and cryptographic proof as versions of the same operation. In cryptography, “proof,” “witness,” “verifier,” completeness, soundness, and zero knowledge have exact meanings. The essay borrows those terms as if technical equivalence had been established, then draws aesthetic conclusions that the cited systems do not demonstrate.

The solution is not to abandon the analogy but to police it. Define “proof” as a compositional metaphor for evidence sufficient to support a listener’s provisional inference, and explicitly state that this is not formal proof. Replace extraction-only attribution with complete citations, especially for the Quanta secondary account; use a primary or authoritative cryptographic source for the definition of zero knowledge.

## Structure and Argument

The question-led opening is strong. The first three cases can be ordered more rigorously as temporal sufficiency, recoverability, and curation confidence. Each has a different decision-maker and criterion, so name those: a model’s emission policy, a separation estimator’s reconstruction objective, and a classifier or filtering pipeline’s estimate of source purity.

The SR-CorrNet section makes the largest unsupported leap. Correlations are model inputs or intermediate features, not a “proof,” and filters are not a constructive witness in the cryptographic sense. If the model separates poorly, the existence of filters proves nothing. Reframe this as an analogy: successful reconstruction provides operational evidence that a source representation was recoverable under the model and test conditions.

The FSD50K-Solo description also needs precision. The pipeline does not make a sample “single source” true through adversarial testing; it estimates or curates according to a defined process with false positives and false negatives. Report evaluation results and avoid treating a classifier decision as ontological proof.

The zero-knowledge section should state the crucial distinction between revealing no additional knowledge about a witness and merely withholding a musical process. Recurring musical constraints are usually evidence from which listeners do learn something about the mechanism, so “zero-knowledge-like” is at best a loose aesthetic analogy. “Partial disclosure” may be a stronger and less misleading term.

The tool proposal is imaginative but currently impossible to evaluate because “what claim is this passage making?” is not machine-readable without annotation or a specified model. Narrow the prototype to one claim, such as meter or source continuity, and present outputs as model-dependent estimates requiring listener validation. The ending should emphasize provisional inference rather than suggesting that sound literally argues or intends.

## Clarity and Flow

“Minimum,” “enough,” “act,” “commit,” and “claim” are never operationalized. Enough for what action, at what error tolerance, for which listener population? A streaming translator balances latency and quality; a listener recognizing a tonal center faces a different criterion. The essay needs one sentence acknowledging that every threshold is task-, listener-, and cost-dependent.

The movement from machine decisions to human musical expectation is smooth rhetorically but unsupported empirically. Signal the change with phrases such as “as a compositional analogy” and “this suggests a listening hypothesis.”

## Style and Voice

The voice is strongest in the practical controls, where abstract ideas become manipulable. Preserve terms such as “proof timing” if they are explicitly marked as invented artistic vocabulary. Reduce claims that animate the signal—“the mixture makes a claim,” “a line proves itself,” “sound … argues”—because their repetition turns a useful metaphor into an asserted ontology.

The essay sometimes equates ambiguity with vitality: “Too much evidence and the event becomes inert.” Many musics derive force from redundancy, clarity, and fulfilled expectation. Qualify this as one compositional strategy rather than a general law.

## Line-Level Edits

- “The shared shape is not classification” is false for the curation example. Try: “Across classification, translation, and separation, each system applies a task-specific sufficiency criterion.”
- “fixed-interval token emission is too crude” needs the paper’s baseline and evidence.
- “Too early, and the translation hallucinates” should use measured terms such as “anticipation errors” or “quality degradation” if those are what the paper reports.
- “A line proves itself” could become “A line remains perceptually segregable through coherent cues.”
- “The filters are the constructive witness” should be removed or explicitly introduced as a limited analogy.
- “survive adversarial context” is inaccurate unless the method uses adversarial examples. Use “remain identifiable under controlled contamination.”
- “zero-knowledge proofs … without revealing why it is true” is imprecise. They prove knowledge or truth without revealing the secret witness beyond the statement’s validity.
- “proof bandwidth” may be confused with information-theoretic bandwidth; consider “evidence channels.”
- “minimum proof curve” should become “model-estimated evidence curve” unless formal guarantees are intended.
- “Sound is not merely perceived. It argues.” could become “Listeners continually infer source, process, and structure from incomplete acoustic evidence.”
