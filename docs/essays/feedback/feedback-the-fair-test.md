# Feedback: The Fair Test

## Overall Impression

The central proposition—evaluation is fair when the evidence available to a system matches the intended question—is useful and more rigorous than simply demanding harder benchmarks. The essay also succeeds in showing several distinct failure modes: confounding, test-time leakage, tolerant annotations, incomplete representation probing, and irreducible label uncertainty. Its main weakness is that “fairness” risks becoming an imprecise container for all sound methodology. Matching evidence to a question is necessary, but not sufficient: sampling, construct validity, subgroup performance, statistical uncertainty, and deployment distribution also determine whether a test supports its claim.

The draft should define the scope as “epistemically fair evaluation” or “task-valid evaluation,” lest readers confuse it with demographic or allocative fairness. It also needs primary citations rather than extraction labels and IDs; many statements report paper results or imply benchmark prescriptions that readers cannot verify from the current source note.

## Structure and Argument

The opening survey establishes breadth, then the body expands each case before synthesizing a checklist. This works, but the case order could sharpen the logic: first define the intended construct, then show irrelevant cues (Echoes), unavailable cues (room acoustics), forgiving scoring (structure boundaries), missing latent information (SARL), and distributed targets (aesthetics). That yields a taxonomy rather than a sequence of summaries.

Several conclusions outrun the stated evidence. Semantic matching does not guarantee that “what remains” is generation artifact; provider, codec, mastering, or pipeline differences may remain. A drop under receiver-grouped validation supports leakage or distribution-shift concerns, but does not by itself prove the model used an impulse response as a “fingerprint.” Similarly, weaker linear decodability of room factors from particular encoders does not establish that their representations “underweight the environment” for every downstream task.

The compositional turn is engaging but conceptually unstable: deliberate ambiguity in art is not an “unfair test” in the methodological sense unless a listener is actually being evaluated against a stated construct. Frame these as artistic uses of privileged, withheld, or ambiguous evidence, not as exceptions to benchmark fairness. The conclusion should return to construct validity and state that changing admissible evidence changes what a score can warrant—not necessarily “the musical object.”

## Clarity and Flow

Define “bona-fide,” “semantic alignment,” “trimming,” “double trimming,” “decode,” and “hierarchical distributions” at first use. “Trimming makes the target narrower” is especially opaque: does trimming alter annotations, exclude boundary regions, or change the evaluation tolerance? The essay assumes readers know the underlying protocols.

The repeated “X adds/moves/gives…” transitions keep the prose moving, but the dense run of six studies makes the middle feel catalog-like. Topic sentences naming the failure mode would help readers retain the argument.

## Style and Voice

The voice is confident and memorable, particularly in “A fingerprint is not a transferable law.” Preserve that compression, but distinguish vivid diagnosis from demonstrated mechanism. “It has not heard forgery” and “it has not learned the room” anthropomorphize the model and present binary verdicts where the evidence more likely supports “the score does not isolate the claimed capability.”

The checklist is useful but too categorical. Each item should name when it applies and what tradeoff it introduces; tighter tolerance, for example, can punish legitimate annotator disagreement rather than merely remove vagueness.

## Line-Level Edits

- “which differences are audible” → “which differences affect the score.” A benchmark need not model audibility unless that is its construct.
- “so a deepfake detector cannot coast on genre” → “to reduce the detector’s opportunity to exploit genre.” “Cannot” is not warranted without residual-confound testing.
- “What remains should be closer to the thing we care about” → “The residual discrimination task is intended to emphasize generation-related traces, though unmatched production confounds may remain.”
- “it is too informative” → “it is privileged information unavailable under the stated deployment scenario.” This names the methodological problem exactly.
- “Trimming makes the target narrower. Double trimming makes it stricter still.” → Replace with a concrete description of what is removed or how tolerance changes, supported by the paper’s terminology.
- “Source factors are easier to decode than room factors.” → “Under the paper’s probes and datasets, the tested source factors were more decodable than the tested room factors.”
- “quality lives partly in uncertainty” → “listener disagreement makes the target a distribution rather than an uncontested scalar.”
- “If an aesthetic model returns one number… it has flattened the listener.” → “A point estimate without calibrated uncertainty conceals disagreement relevant to interpretation.”
- “The fair test is therefore a compositional control surface” → “The allocation of evidence can also function as a compositional control surface.” This preserves the turn without claiming equivalence.
