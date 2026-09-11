# Feedback: The Input Contract

## Overall Impression

This essay has the strongest general framework in the set. “What evidence is available, when it is available, and whether that evidence is allowed to stand for the thing being claimed” is a precise and portable definition of an input contract. The room-acoustics example demonstrates the stakes especially well: evaluation design can change what task a score actually represents. The essay’s main weakness is scope. Five substantial studies are each used to derive a different lesson, and the late compositional method does not fully integrate them.

The piece should distinguish three contracts: training inputs, test-time inputs, and evaluation sampling. A row-wise split is not an input in the same sense as a target-position impulse response; population coverage is a dataset/evaluation contract; stem availability is a system-interface contract. The broader term can contain all three, but the taxonomy is necessary.

## Structure and Argument

The sequence from room leakage to editable stems to guitar constraints to speech enhancement to benchmark coverage is intelligible, but each section restarts the argument. Add a short recurring test after each case: What is observed? What is predicted? What is unavailable at deployment? What claim is justified? That would make the framework cumulative.

“The Room That Cheats” is rhetorically sharp but assigns agency incorrectly. The room does not cheat; the evaluation protocol may permit leakage or interpolation. More importantly, an impulse response at a target position could contain legitimate measurements for some use cases. The essay correctly notes that interpolation may still be useful; bring that qualification earlier.

The StemFX section makes an unsupported leap from tokenized effect chains to editability. Outputs are only meaningfully editable if tokens map to exposed, valid processors and parameter ranges, and if users can reconstruct or alter chains reliably. Likewise, “musically honest” is a value judgment. Explain the actual affordance and its limitations.

The UniPASE discussion is the most speculative but also one of the richest. Verify the pipeline wording—especially “before conversion to 48 kHz and resampling,” which sounds redundant or contradictory—and distinguish reported anti-hallucination behavior from the hypothesis that musical identity may be smoothed away. The GigaSpeechBench parallel to music should acknowledge that ASR population fairness and musical-cultural representation are related ethical issues, not interchangeable ones.

The conclusion should return explicitly to claim validity. “Only as musical as … honest” is too vague; a contract can be transparent yet inadequate. The defensible principle is that system claims must be bounded by the evidence and populations allowed under training and evaluation.

## Clarity and Flow

Several technical terms need definition: ISO 3382-1 parameters, R², pseudo-stems, MFCCs, vocoder, and phonetic/acoustic representations. “Around R2 = 0.81” should use R² and identify aggregation, test design, and uncertainty. A range of 0.09–0.57 is not directly comparable without knowing parameters and splits.

The essay is careful about limitations but sometimes states inference as diagnosis: a model “recognizing the coordinate,” learning “the style of separation,” or smoothing performance evidence. Mark these as plausible shortcut mechanisms unless the papers provide ablations.

Full bibliographic citations or links are necessary. Extraction IDs and related-essay links provide provenance within the project but not reader-verifiable support.

## Style and Voice

The contractual metaphor is coherent and productive throughout. Phrases such as “A prediction says…” provide welcome compression. Keep that direct voice, but remove evaluative adornments—“cleanest warning,” “musically honest,” “charmingly strict,” “lovely thing”—where they pre-judge the evidence.

The final list reads more like brainstorming than a culmination. Two well-developed compositional examples would be stronger than five one-line prompts, especially because some—“treat evaluation protocol as part of the score”—need explanation to be actionable.

## Line-Level Edits

- “the musical intelligence … is a property of the contract” should be qualified: “the validity and scope of the resulting claim depend on the contract.”
- “reported mean performance reaches around R2 = 0.81” should identify the metric as R², the averaged parameters, and the validation scheme.
- “The input contract has smuggled the answer into the test” implies leakage without proving it. Try “The protocol may allow target-position information to substitute for generalization to unseen positions.”
- “If the system requires a measurement at the exact seat it is supposed to predict” should specify whether that measurement is an impulse response and whether the target parameters are derived from it.
- “By predicting tokenized chains on pseudo-stems, StemFX moves style … into an editable coordinate system” should become “represents style as processor tokens that may be inspectable and editable if mapped to exposed effect controls.”
- “Untrained listeners may find” needs a perception citation or deletion; it is irrelevant to classifier performance.
- “shuffled frame validation is much higher” needs actual scores and should flag recording-level leakage from correlated adjacent frames.
- “then through a vocoder to 16 kHz waveform reconstruction before conversion to 48 kHz and resampling” needs technical correction and a stated reason for each sample-rate operation.
- “hallucinate musical identity” is evocative but undefined. Try “alter speaker- or performance-specific acoustic cues.”
- “part of the signal’s real geometry” should become “dimensions of the deployment distribution that evaluation must represent.”
- “only as musical as its input contract is honest” could become “A model’s claims should not exceed the evidence its input and evaluation contracts permit.”
