# Feedback: The Sourcehood Separation Threshold
## Overall Impression

This essay has the richest set of examples and the clearest compositional exercises in the sourcehood group. Its best insight is that physical causation, perceptual grouping, annotation, and task-specific decomposition yield different source counts. Yet the headline claim—“Sourcehood is a threshold, not a property”—sets up a false opposition. Thresholds are decision rules over measured or inferred properties; the essay actually argues that sourcehood is relational and task-dependent. The scope also sprawls from speech architecture through dataset construction, anomaly detection, room synthesis, orchestration, and studio practice, producing repetition and leaving key empirical claims unsupported.

## Structure and Argument

The four main sections provide a readable scaffold, but they are not equally connected to the titular “separation threshold.” SR-CorrNet and FSD50K-Solo directly concern separation and curation. The anomaly paper concerns identity side information, while room-impulse-response generation concerns conditional synthesis; neither by itself shows a threshold at which a room becomes a source. The essay supplies that perceptual hypothesis, so mark it as a proposed extension requiring testing.

The argument would be stronger if it first established four source definitions: causal body, auditory stream, labeled event, and target component for a task. Each paper could then show where one operational definition diverges from another. That framework would prevent statements such as “A clean dataset says ‘one event’” from implying that annotations settle causal or perceptual unity.

The “Practical Test” is promising but currently cannot locate a “flip point” because its manipulations are categorical and its judgments are heterogeneous. Specify graded context level, competing-event level, and room strength; collect repeated forced-choice or continuous judgments across listeners; and model separate thresholds for source count, identity, pitch, and phrase function. These judgments may not flip together, which may be the most interesting result.

The final section says the boundary “can be measured, modeled, and deliberately moved.” “Can be operationalized and experimentally estimated” is more defensible. Measurement requires a declared observer, task, stimulus continuum, and criterion.

## Clarity and Flow

The long essay frequently reintroduces the same principle. The opening, end of the FSD section, “A Practical Test,” and “Why It Matters” all state that source count depends on the question. Condense one recap and use the space to define “separability,” which could mean signal recoverability, listener stream segregation, or label purity.

Technical precision needs attention. “Strongly labeled” should be defined. “Correlation-to-filter problem” is unexplained. Claims that multichannel correlations recover targets under noise and reverberation need the actual evaluation conditions. The RIR paragraph should distinguish generating a plausible impulse response from generating or identifying a physical room; text-conditioned output is not evidence that a room is a “generative object” in the ontological sense.

## Style and Voice

The prose has energy and the studio exercise is concrete enough to invite experimentation. Preserve lines such as “Which level counts as the source?” The recurring formula “This is not only X. It is Y” becomes mannered, however, and often inflates an engineering result into a philosophical claim. State the empirical result first, then label the compositional inference explicitly.

The title is cumbersome because “sourcehood” and “separation” already overlap semantically. If retained, define the phrase in the first paragraph as the criterion at which an observer changes its estimated source count.

## Line-Level Edits

- “A clean dataset says ‘one event.’” → “A dataset annotates a clip as containing one target event under a particular taxonomy.” This does not imply causal purity.
- “Sourcehood is a threshold, not a property.” → “Operational sourcehood emerges when task-relevant evidence crosses a declared decision threshold.”
- “The same spectrum can be heard as one fused object” → “Similar long-term spectra can support different groupings when onset, spatial, temporal, or contextual cues differ.” Literally the same spectrum is insufficiently specified.
- “Single-Source Is A Curated Fiction” → “Single-Source Is a Curated Category.” “Fiction” prejudges the utility and reality of the category.
- “a door slam with room tone” → distinguish the initiating event, background sound, and acoustic response; “room tone” is not equivalent to reverberation.
- “performance degrades” → report the benchmark, metric, magnitude, and machine-ID condition, and avoid generalizing beyond that evaluation.
- “The same A4” → “Nominal A4s”; tired singing, extended bowing, and prepared-piano attacks may differ in fundamental frequency, partial structure, and pitch stability.
- “A room becomes promptable” → “A model can generate an impulse-response estimate conditioned on a textual room description.” Add evidence about physical plausibility and generalization.
- “If the listener hears continuity, the room has crossed the sourcehood threshold.” → “If listeners attribute continuity primarily to the preserved room response, that would support the hypothesis that environment cues can carry object continuity.”
- “the place where a sound stops being an object and becomes a relation” → “the region where source-count judgments become unstable or task-dependent.” The original falsely opposes objects and relations.
