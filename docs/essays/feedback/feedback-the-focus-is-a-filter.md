# Feedback: The Focus Is a Filter

## Overall Impression

The essay offers a compelling compositional claim: foregrounding is constitutive, not merely descriptive. Its best contribution is to connect spatial enhancement, evaluation metrics, latency policy, separation, and curation as different weighting mechanisms. The weakness is that “focus” becomes so broad that any selection, optimization, or loss of information qualifies. A binaural filter changes a signal; an ASR metric scores it; a streaming policy chooses an emission time; a curator selects examples. These operations have different causal roles. The essay should define focus as task-dependent weighting of evidence, then distinguish filtering, evaluation, commitment, and categorization as implementations or consequences.

The opening’s “newest extraction batch” and source list without publication details position the piece as an internal synthesis rather than a stand-alone essay. Primary citations are necessary for claims about architecture, correlation with human WER, latency, and dataset curation.

## Structure and Argument

The narrative moves efficiently from literal filtering to metaphorical filtering and then to a studio exercise. That arc is sensible, but the supporting cases are not equally probative. The binaural system directly supports selective enhancement. The ASR case demonstrates metric sensitivity, not attention in a perceptual system. Streaming translation concerns a stopping or emission policy. SR-CorrNet and FSD50K-Solo concern source inference and selection. Treating all as “theory of attention” is an interpretive proposal that needs to be labeled as such.

The ASR argument is especially under-specified. Better correlation with human word error rate and reduced sensitivity to acoustic damage can coexist because lexical accuracy and perceptual quality are different constructs. The issue is not that the metric “stops caring”; it is that it may be unsuitable for evaluating non-lexical degradation. Name the target construct and cite the conditions under which the divergence was observed.

The compositional exercise is the essay’s strongest section, but version three asks multiple orthogonal questions at once. Recommend one controlled degradation per render and a stated judgment task. The proposed interface with six confidence curves is intriguing but assumes those dimensions can be independently and reliably estimated. Flag this as a research design, and specify that the curves would need calibration against listeners and musical tasks.

The conclusion’s scarcity claim—hearing one thing clearly necessarily makes something else less available—is plausible under limited attention but too universal. Selective enhancement can sometimes improve a target without meaningful loss to already irrelevant cues, and auditory attention is not identical to signal filtering.

## Clarity and Flow

“Natural cues,” “acoustically meaningful failures,” “source-continuity evidence,” and “the piece survives” all need operational meaning. Survival could refer to recognizability, aesthetic effect, task performance, or preservation of a feature. Choose one in each example.

The paper-to-composition transitions are graceful but often skip the middle premise. For instance, an algorithm blending binaural filters does not demonstrate that “the ear is always weighting.” That latter claim requires auditory-attention literature, not just an engineering analogy.

## Style and Voice

The prose has a strong cadence and several memorable contrasts, particularly “not a spotlight placed on a finished scene.” Preserve that image. Reduce personification where it conceals construct mismatch: metrics do not “care,” and systems do not necessarily decide what “deserves gain.” The confident voice will be more credible when empirical claims carry scoped qualifiers.

## Line-Level Edits

- “Every system has to decide which evidence deserves gain” → “Every task-specific system weights some evidence more heavily than other evidence.”
- “without explicit direction-of-arrival estimation” → Clarify whether direction is never estimated or merely not represented as an explicit intermediate target.
- “preserving natural cues” → Name the evaluated cues and metric, or write “intended to preserve binaural localization cues.”
- “The ear is always weighting.” → “Auditory attention and scene analysis weight cues according to task and context.” Add a psychoacoustic citation.
- “their robustness can also hide acoustically meaningful failures” → “their lexical robustness can make them insensitive to degradations that matter to other perceptual-quality judgments.”
- “the latency policy decides when partial evidence is enough” → “the learned emission policy operationalizes sufficiency under a latency–quality objective.”
- “everything else becomes background, interference, or residue” → “unselected components may be treated by the system as background, interference, or residual energy.”
- “If the music survives” → Replace each instance with the relevant criterion: “if listeners still identify the rhythm,” “if source attribution remains stable,” or “if the intended expressive rating is preserved.”
- “Because focus is never free.” → “Because focus encodes a tradeoff whose costs depend on the task.” This retains the cadence without an absolute claim.
