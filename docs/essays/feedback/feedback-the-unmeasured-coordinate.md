# Feedback: The Unmeasured Coordinate
## Overall Impression

This compact essay has a precise and useful question: what relation does a system need for action that its input or representation does not explicitly provide? The spatial-reconstruction example supports this well, and the RBM example usefully distinguishes local fit from transformation invariance. The multimodal-safety example is less secure because the cues are reportedly present; the failure is integration, not measurement. That tension exposes the essay’s main conceptual problem: “unmeasured,” “latent,” “uninvariant,” “weakly encoded,” and “unintegrated” are treated as equivalent. They describe different failure modes and demand different remedies. The piece will be more defensible if “unmeasured coordinate” is explicitly a compositional umbrella rather than a technical diagnosis. The source note needs full bibliographic citations and enough methodological detail to verify each claim.

## Structure and Argument

The three-example structure is efficient, and the numbered recap makes the proposed commonality easy to inspect. But the recap actually reveals that only the Ambisonics case concerns missing measurements. The RBM receives pitches at fixed locations but lacks learned transposition invariance; MCBench models receive modality cues but may fail at relational reasoning. Reframe the taxonomy around three distinct absences: unsampled information, unencoded invariance, and unbound evidence.

That taxonomy would strengthen the compositional proposals because each invites a different intervention. Unsampled spatial detail calls for priors and uncertainty representation. Missing invariance calls for architecture, augmentation, or relational encoding. Failed binding calls for joint attention, causal scene modeling, or task design. “Withhold a coordinate and let a prior carry the weight” applies well to posterior reconstruction but not automatically to the other cases.

The practical test is a strong ending framework, though “the musically right move” is circular unless the composer defines an objective or listener criterion. End on the more careful point that composition can stage the boundary between observed evidence and model-dependent inference—and should expose uncertainty rather than merely aestheticize hallucination.

## Clarity and Flow

The Ambisonics paragraph needs to distinguish high-order Ambisonic coefficients, spatial sampling, and room impulse responses. “All the high-order spatial detail” is too vague, and “classical linear reconstruction fails” needs conditions and a baseline. Posterior sampling does not “fill in” the true missing room; it samples plausible completions under a learned prior and measurement model. That epistemic distinction is central to the essay.

The RBM account should clarify the meaning of “energy,” the construction of non-musical binary images, and the transposition test. Low model energy is not synonymous with musicality. Likewise, “musicians hear immediately” is an unsupported universal claim and ignores register boundaries, temperament, absolute-pitch listeners, and harmonic context.

## Style and Voice

The prose is admirably economical and carries its abstraction through concrete musical proposals. Still, phrases such as “allowed to dream,” “hear the room,” and “the relational ear” push the essay toward mystification precisely where uncertainty needs precision. Preserve one of these images, but pair it with language about priors, identifiability, or binding. The repeated “not only … but” construction is noticeable in such a short piece.

## Line-Level Edits

- “cannot measure all the high-order spatial detail needed for high-order Ambisonics” is tautological. Consider: “With too few or irregularly placed microphones, the array underdetermines the desired high-order spherical-harmonic coefficients.”
- “Classical linear reconstruction fails” should name the method, sampling regime, and failure metric. Consider: “Under the tested undersampling conditions, the reported linear baselines produce larger reconstruction error or artifacts.”
- “fill in plausible spatial structure” could become: “sample coefficients consistent with the observations and learned training distribution; these completions are plausible, not verified measurements.”
- “which invisible room is compatible with the audible one” is evocative but inaccurate if the model reconstructs an RIR field. Consider: “which unobserved spatial coefficients are compatible with the measured responses.”
- “assign them lower energy than non-musical binary images” needs the negative-data construction and quantitative result; arbitrary binary images may be an easy or musically irrelevant baseline.
- “Transposition equivalence is … one of the basic ways tonal material stays itself” should acknowledge that transposition can alter register, playability, timbre, and function. Consider: “Intervallic structure often supports transposition-based similarity, although identity need not be complete.”
- “the unmeasured coordinate is the relation between modalities” is the wrong diagnosis if cues are present. Replace with: “the missing operation is reliable cross-modal binding.”
- “A composer can decide which coordinate to withhold” should distinguish deliberate omission from accidental model incapacity.
- “when interval relation dominates, it becomes portable” could become: “increasing transposition invariance can make interval patterns more stable across absolute pitch locations.”
- “Sometimes the instrument begins where measurement runs out” is a strong close; retain it, but precede it with a warning that inferred detail should not be represented as observed fact.
