# Feedback: The Upstream Name

## Overall Impression

The essay has a strong central intuition: source identity is not simply present or absent but depends on whether a representation retains evidence that supports attribution. The phrase “the name of the source is part of the signal path” gives that intuition memorable form. The main weakness is that “name,” “identity,” “sourcehood,” and “attribution” slide into one another. A source’s physical identity, a dataset label, a model’s latent grouping, and a listener’s causal inference are related but not interchangeable. The essay needs to state that its “name” is operational evidence for attribution, not necessarily an explicit class label or an intrinsic feature of a signal.

The source summaries also require citations readers can inspect. Extraction IDs are provenance markers, not evidence in a publishable essay. Claims about SR-CorrNet’s bottleneck, FSD50K-Solo’s use of diffusion and filtering, and anomaly-detection performance should cite the papers and, where possible, specify the reported comparison or result.

## Structure and Argument

The progression from architecture to corpus to evaluation is effective, but the three examples do not establish exactly the same proposition. SR-CorrNet concerns when speaker-discriminative information is processed; FSD50K-Solo concerns curatorial confidence in polyphony; the anomaly benchmark concerns missing metadata and distribution structure. A short paragraph acknowledging these distinct levels would prevent the synthesis from seeming stronger than the evidence permits.

The streaming SpeechLLM extraction appears in the source note but nowhere in the argument. Either integrate it as a genuine example of evidence accumulating over time or remove it. The composition section arrives naturally, though the assertion that a late clue “rewrites” perceived source identity should be framed as a hypothesis or listening possibility. The ending is concise, but it restates the premise rather than defining what follows from it. A stronger conclusion would distinguish system design—retain uncertainty and attribution cues—from compositional design—control when those cues become perceptually sufficient.

## Clarity and Flow

“Operational identity” needs an early definition. Does it mean enough evidence to separate a stream, assign a class, or track a causal source? Those tasks have different thresholds. Likewise, “source” can mean a physical emitter, an auditory object, a recording stem, or a labeled event. Naming that ambiguity would sharpen rather than weaken the essay.

The middle is slightly repetitive: “carry source evidence forward,” “usable path,” “early name,” and “upstream representation” all make the same point. Compress one of these passages and use the space to explain failure cases: early cues can be misleading, and later processing can sometimes recover identity information rather than merely invent “a plausible cause.”

## Style and Voice

The voice is assured and evocative, especially in “temporal harmony” and “a sound can wait for its name.” Preserve those phrases, but temper declarations that convert an analogy into a technical law. “Compositional and technical rule” overstates what three heterogeneous studies can support. “Working proposition” would fit the evidence and retain authority.

The anthropomorphic vocabulary is useful when clearly metaphorical, but “the system knows” and “the signal carries its identity” can obscure whether the claim concerns representation, inference, or perception.

## Line-Level Edits

- “when does an audio system know what source it is hearing?” → “when does an audio system have enough evidence to attribute a signal to a source?” This replaces undefined machine “knowledge” with an observable operation.
- “Operational identity is not just caused by the source.” → “Operational source identity depends not only on the emitter, but on which attribution cues survive representation and processing.”
- “The dataset is not merely collecting cleaner examples.” → “The dataset pipeline aims to construct examples with higher confidence that one labeled event dominates.” This avoids implying verified physical isolation unless the paper establishes it.
- “The name of the source is part of the signal path.” → Consider “Evidence for naming the source is part of the signal path.” The current slogan is elegant but literally conflates metadata with acoustics.
- “If it arrives too late, the later stage is not naming the source. It is reconstructing a plausible cause.” → “If decisive cues are discarded early, a later stage may have to infer a cause from incomplete evidence.” The original is too absolute.
- “A model that succeeds only when the upstream name is given has not solved source understanding” → “A model evaluated only with source identity supplied has not demonstrated source attribution under missing identity metadata.” This makes the criticism testable.
