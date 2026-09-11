# Feedback: The Metric Chooses What Survives

## Overall Impression

The essay has a clear and productive thesis: objectives and representations privilege particular information under transformation. The codec and Tonnetz cases support it well because their tradeoffs are easy to state. The deepfake, language-rhythm, and ice examples broaden the range, but they also blur “metric” into objective function, feature representation, detector, relational geometry, and physical pathway. Those mechanisms all select or expose structure, but not in the same way. The title promises an argument about metrics; the body ultimately argues about metrics, representations, and dynamics together. Either narrow the scope or revise the key term to “criterion” or “constraint” and distinguish its forms.

All empirical details need primary references rather than extraction IDs or an omnibus source note. Reported bitrates, accuracy, robustness, and architectural advantages should be attributed precisely. The listed Qwen3.5-Omni report is not discussed in the body and should be integrated or removed.

## Structure and Argument

The essay progresses by analogy: codec, rhythm features, forensic features, harmonic geometry, and phase transitions. The first four can form a disciplined sequence if each answers the same question: what information is retained, what is discarded, and for which task? A compact recurring formulation would make the comparisons rigorous.

The ice section is the structural outlier. Ostwald’s step rule concerns kinetics and metastable phases, not a metric preserving signal content. “The final structure is … a property of the route” supports path dependence, but not the title’s claim that a metric chooses survival. Present it explicitly as a separate extension: selection can occur through reachable dynamics as well as an evaluation objective. Also qualify the rule; it is heuristic and not a universal law that systems always transition to the “nearest” state.

The ClariCodec paragraph risks implying a zero-sum result without data. At 200 bps there is a severe capacity constraint, but “bits are spent” is an intuitive gloss on learned coding, and WER fine-tuning does not necessarily directly allocate discrete bits to words. State what the paper actually optimized and how intelligibility and quality changed.

The language-discrimination paragraph needs sample size, validation protocol, and the meaning of “substantial accuracy.” Related languages can be distinguished for reasons unrelated to rhythm; the essay should not imply that low-frequency amplitude modulation uniquely locates language identity. Similarly, WST-X may expose artifacts useful on a benchmark without proving those artifacts generalize across generators or channels.

The final two paragraphs effectively translate the thesis into a design question. Strengthen the ending by acknowledging the cost of every invariant: preserving one property can erase or distort another.

## Clarity and Flow

“Preserve” shifts among reconstructing, retaining discriminative information, detecting artifacts, and encoding adjacency. A detector does not preserve an anomaly in the same sense a codec preserves intelligibility. Use verbs specific to each case, then reserve “selective memory” as the concluding metaphor.

Define “metric” early. If it includes loss functions, feature maps, graph relations, and state-transition constraints, say so and explain why. Otherwise readers with technical backgrounds will object before reaching the musical application.

## Style and Voice

The prose is concise and confident, but phrases such as “different ghosts audible,” “makes the connection sparkle,” and “absurd compression” tilt toward promotional language. One vivid phrase per paragraph is enough; replace the rest with measured claims.

The imperative sequence near the end is effective. Preserve the voice by keeping those concrete task-to-representation mappings while reducing categorical statements about what a system “learns” internally unless the study analyzes its representations.

## Line-Level Edits

- “a system rarely preserves ‘the signal’ in general” could become “under limited capacity or a task-specific representation, a system preserves some signal properties more faithfully than others.”
- “bits are spent on perceptual detail” should be “the reconstruction objective favors features rewarded by its loss,” unless the paper provides a bit-allocation analysis.
- “the codec learns a different conservation law” is metaphorical overreach. Try: “WER-based optimization changes the codec’s tradeoff toward lexical recoverability.”
- “enough to discriminate related languages with substantial accuracy” needs the exact accuracy, baseline, dataset size, and held-out conditions.
- “MFCC features then add a finer spectral layer” should state whether feature fusion actually improved performance and by how much.
- “opaque self-supervised embeddings” is prejudicial without an interpretability comparison. Use “less directly interpretable embeddings.”
- “deformation-stable” needs definition and should not be equated automatically with cross-domain robustness.
- “The geometry is powerful because it forgets productively” is strong; follow it with a limitation that Tonnetz relations depend on the chosen pitch-class and chord model.
- “Ostwald’s step rule says” should be qualified as a heuristic tendency under some conditions.
- “choose the metric before choosing the transformation” may reverse real workflows. Consider: “Specify the desired invariant before selecting the transformation and evaluation metric.”
