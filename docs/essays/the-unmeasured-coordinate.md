# The Unmeasured Coordinate

The newest extraction cluster has a clean shape: three systems each run into a coordinate they need but do not directly possess.

The Ambisonics RIR paper states the problem most physically. A sparse or irregular microphone array cannot measure all the high-order spatial detail needed for high-order Ambisonics. Classical linear reconstruction fails because the missing information is genuinely unobserved, not merely noisy. The proposed diffusion method works by posterior sampling: keep the reconstruction consistent with the measurements, then use the learned room-acoustic prior to fill in plausible spatial structure. The room becomes partly measured and partly inferred.

That is musically interesting because high-order spatial sound is often treated as a rendering format, a way to place sound after composition. This extraction suggests a different view. Spatial detail is a latent coordinate. If the microphone array did not capture it, the system must decide which invisible room is compatible with the audible one. Composition can enter exactly there: not only in choosing where a source sits, but in choosing how much spatial detail is measured, guessed, constrained, or allowed to dream.

The RBM-on-Bach extraction gives the symbolic version. The model learns local piano-roll statistics well enough to reconstruct musical-looking inputs and assign them lower energy than non-musical binary images. But it does not robustly map transposed versions of the same music to nearby hidden states. The missing coordinate is not a room direction but a musical equivalence: this pattern is the same relation moved through pitch space.

That failure matters. A representation can learn many local facts about Bach and still miss the transformation that musicians hear immediately. Transposition equivalence is not a decorative abstraction. It is one of the basic ways tonal material stays itself while changing register or key. Without translational invariance, the model hears surface position more strongly than relational identity.

MCBench adds a third case from multimodal reasoning. The extraction reports that omni models can pick up modality-specific cues, especially salient acoustic or visual ones, but often fail to integrate them effectively for safety judgments. Here the unmeasured coordinate is the relation between modalities. The audio cue and visual cue may both be present, but the judgment depends on binding them into one scene.

Across the three sources, the same lesson keeps appearing:

1. A sparse array can hear the room but not all of its spatial degrees of freedom.
2. A piano-roll RBM can hear local musical texture but not the transposition relation.
3. An omni model can hear and see cues but fail to bind them into a shared situation.

The compositional concept is **the unmeasured coordinate**: a musically important dimension that is required for action, but absent, weakly encoded, or only indirectly recoverable in the representation.

This is not just a warning about model limitations. It is a design handle. A composer can decide which coordinate to withhold and which prior must carry the missing weight.

In spatial audio, a piece could move between measured and inferred rooms, letting the listener hear the transition from physical capture to plausible acoustic fiction. In symbolic generation, a model or instrument could expose transposition sensitivity as a control: when pitch position dominates, music feels fixed to the staff; when interval relation dominates, it becomes portable. In audiovisual composition, salient sounds and images could deliberately disagree until a binding event makes the scene snap into one perceived cause.

The practical test is this: ask what the system would need to know to make the musically right move, then ask whether that coordinate is actually present. If it is not, the missing coordinate becomes the site of composition. You can reconstruct it, exaggerate its absence, or make the listener feel the cost of not having it.

That is the useful thread in this batch. The most interesting musical dimensions are not always the ones in the input. Sometimes the instrument begins where measurement runs out.

_Sources: recent extractions on diffusion-based high-order Ambisonics RIR encoding (`j974sa77g2r17h4abcfrweqtqn8cpr3g`), RBM representations of Bach piano rolls (`j974jrzc77gtf2xvzj7tag560s8cqdjj`), and MCBench multimodal safety reasoning (`j97d4x09m35xs3z5ga8w6x7f7h8cpyjf`). Connections to: spatial audio encoding, sparse spatial sampling, posterior sampling, transposition equivalence, translational invariance, local musical texture, cross-modal cue binding, evidence carrier, coordinate of evidence, and the relational ear._
