# Feedback: The Sourcehood Contract
## Overall Impression

“Contract” is a productive metaphor because it captures that treating something as a source authorizes downstream operations. The essay is strongest when it lists those consequences—counting, separation, comparison, scoring, transformation. Yet it never identifies the parties to the contract, the criteria of acceptance, or what breach means. As written, “contract” often becomes a decorative synonym for categorization. The final claim, “The source is not before the sound,” also swings from a defensible operational thesis to an unnecessarily broad ontological denial of physical causes.

## Structure and Argument

The four-study survey has a coherent inside-model/outside-model/withheld-label/temporal sequence. The anomaly-detection example is especially valuable because it exposes a hidden dependency rather than merely offering another threshold. The essay should use that example to sharpen its thesis: every source attribution is made under declared or undeclared priors, and those priors determine what actions are licensed.

At present, however, the sources do not all support the same “contract.” SR-CorrNet concerns representation and separation; FSD50K-Solo concerns label purity; anomalous-sound detection concerns machine-ID side information; SpeechLLM concerns when translation output is emitted, not necessarily source attribution. The fourth example is the weakest fit. Either show that stable speaker/utterance attribution is actually part of the streaming method or describe it as an adjacent sufficiency contract.

The five-step compositional sketch is the argumentative center because it turns abstraction into manipulable cues. Move it earlier or refer back to it in the conclusion. The ending currently broadens to “what kind of object a signal is allowed to become,” then names several entire musical domains without demonstrating the consequences. A stronger ending would state a limited principle: source boundaries are task-relative commitments constrained by acoustic evidence, not arbitrary inventions.

## Clarity and Flow

The key terms need separation. A “boundary” may be causal, perceptual, dataset-defined, or computational, but those are not merely different techniques for drawing the same line. A physical instrument can remain one causal source while becoming multiple auditory streams; multiple instruments can fuse perceptually while remaining separable stems. State this explicitly before using the examples.

“Sourcehood has to be negotiated early” gives a model intentionality it does not possess and turns one architecture’s result into a universal rule. “The representation benefits from retaining source-discriminative cues before compression” is narrower and more credible. Similarly, classifier-based filtering does not necessarily “test” sourcehood unless human evaluation or a validated ground truth supports the classifier’s decisions.

## Style and Voice

The essay’s concise declarative style works well, and “Density counts how much is happening. Sourcehood asks whether the listener can draw stable borders” is an effective distinction. Preserve the compactness while reducing repeated personification (“right,” “allowed,” “negotiated,” “admitted”). One legal metaphor can organize the piece; using legal language in nearly every section makes the mechanism less visible.

The phrase “manufactured” is vivid but risks implying falsity or manipulation where “operationalized” or “curated” would be more accurate. If the provocation is intentional, explain that manufactured categories can still be useful and empirically constrained.

## Line-Level Edits

- “when does a listening system have the right” → “under what evidence and task assumptions may a listening system treat a sound as one source?” This defines the normative language operationally.
- “A note, a voice, an instrument, a room, and a machine all become usable” → “These entities become usable *as source units* only after a system selects a boundary around them.” Notes and rooms are not parallel source categories without qualification.
- “compressed away too much source-specific information” → “produced a representation less effective for recovering source-specific information.” Use the stronger causal version only if the paper measures information loss.
- “synthetic single-class audio as a calibration object” → name the synthesis method and filtering role; “calibration object” otherwise sounds more rigorous than the description shows.
- “performance drops in ways that correlate with implicit source identification” → report the metric, comparison, and correlation if available, and clarify whether identity is machine instance, type, or domain.
- “one physical cause” → “one excitation or performed event.” A prepared-piano note and bowed cymbal involve coupled causal systems, so “one physical cause” is misleading.
- “one pitch center” in the assigned pole → replace with “one salient pitch trajectory”; pitch center is a tonal-function concept, not a source-identity cue.
- “The source is not before the sound” → “For a listening system, a usable source is not simply given before analysis; it is a claim made from evidence in the sound.” This preserves the voice without denying causation.
