# Feedback: The Hidden Name of the Sound

## Overall Impression

The essay productively reframes several audio tasks around source attribution and lands on a useful compositional parameter, “source legibility.” That term is clearer and more musically actionable than the title’s “hidden name.” The draft’s chief problem is conceptual compression: class label, individual speaker or machine identity, physical cause, perceived source, and dataset domain are treated as versions of one variable. They interact, but they are not interchangeable. An infant’s individual physiology is not the same level of identity as the class “infant cry”; a machine ID can be nuisance metadata or necessary conditioning; a separated speaker is an estimated stream, not a recovered “name.”

The essay should make “source legibility” its thesis and define attribution level explicitly. It also needs primary citations with enough detail to verify all four paper summaries; a generic source note is inadequate for empirical claims.

## Structure and Argument

The four-case progression is logical: curated purity, separation under mixture, hidden benchmark assumptions, and cross-domain variation. The musical turn then moves from orchestration examples to a definition and exercise. The structure is strong, but the first half repeats the claim that identity matters without resolving what identity means in each case. Add an early hierarchy: event class, source type, individual source, spatial/recording condition, and perceived causal object. Then locate each study on it.

The statement that multi-event labels are “poison” is overstated. Weakly labeled, polyphonic data can be appropriate for multilabel sound-event detection; it is problematic only for a task or evaluation that assumes isolated events. Similarly, FSD50K-Solo’s generated single-class examples instantiate the model’s operational definition of purity, not an objective fact that one cause exists “without much residue.”

The anomalous-detection result warrants care. A performance drop without known machine ID shows dependence on identity information or increased task difficulty, but does not prove what cues the model used. The infant-cry section moves from domain shift to claims about “a particular body’s resonant behavior”; recording devices, preprocessing, site, and label distribution may also drive shift. Name these confounds.

The concluding umbrella “source attribution under mixture” does not fully include anomaly detection across known machines or infant domain shift, which can occur in isolated recordings. A better umbrella is “source-conditioned interpretation,” with mixture as one important case. The final claim that “every musical texture” asks what remains itself is rhetorically appealing but needlessly universal.

## Clarity and Flow

Define “source identity,” “purity constraint,” “domain shift,” and “stable attribution.” The proposed “degree” may be multidimensional: confidence in source count, class, individual, location, and continuity can disagree. A sound can be clearly one object but impossible to identify by class. The recipe should specify which attribution question listeners answer and how the “flip” is measured.

The phrase “waveform is not enough by itself” is also misleading: all inferable acoustic evidence may be in the waveform, while the task additionally depends on priors, labels, or context. Say the waveform does not determine a unique attribution.

## Style and Voice

The prose is polished and accessible, with effective concrete examples of clarinet fusion and production processing. Preserve those. Replace categorical metaphors—“poison,” “name,” “one cause”—where they obscure task definitions. The essay’s voice will remain vivid if its levels of identity are made precise.

## Line-Level Edits

- “whose sound is this?” → “what source, source class, or continuing stream should this event be attributed to?”
- “the waveform is not enough by itself” → “the waveform often underdetermines attribution without task-specific priors and context.”
- “For supervised learning it is poison” → “For benchmarks that assume isolated single-label events, overlap creates label–signal mismatch.”
- “assigned to one cause without much residue” → “meets the dataset’s operational single-source criterion.” State that criterion.
- “reconstructed from relations inside the sound field” → “estimated from spatio-spectro-temporal relations represented by the model.”
- “The acoustic class is not independent of the individual source.” → “Class-relevant features can covary with infant, corpus, device, and recording context.”
- “Source legibility: the degree…” → Expand to a vector or specify the attribution level and listening task.
- “when the perceived cause flips” → “when listeners’ dominant attribution changes under a stated forced-choice or confidence judgment.”
- “source attribution under mixture” → “source-conditioned interpretation under mixture and domain shift.”
