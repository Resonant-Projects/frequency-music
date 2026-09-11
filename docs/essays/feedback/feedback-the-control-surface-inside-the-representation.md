# Feedback: The Control Surface Inside the Representation

## Overall Impression

The essay’s best contribution is “representational affordance”: the idea that a representation matters compositionally when its geometry supports particular transformations and decisions. That concept is more precise and defensible than the title’s broader “control surface.” The draft should organize itself around affordance earlier. At present, it moves from equivariant embeddings to out-of-distribution detection, tracking, and scale evolution as if each showed the same four-stage process. They do not quite. Some representations enable manipulation, some enable classification, and one is a culturally evolved pitch system rather than a learned machine representation.

## Structure and Argument

MIDI-RAE-JEPA is the strongest opening case because magnitude-sensitive pitch/time transformations directly support the thesis. However, “distance in the representation changes with the magnitude” is insufficient evidence that axes “mean something musical.” Many embeddings reflect transformation magnitude without providing disentangled or user-controllable axes. Clarify whether the result demonstrates equivariance, monotonic distance, controllability, or merely correlation.

The vocoder OOD section shifts from reconstructability as a classifier score to a proposed compositional belonging test. This is fruitful, but it is an analogy, not a direct consequence. Reconstruction failure can reflect decoder capacity, feature mismatch, or nuisance conditions—not ontological foreignness. State those failure modes before turning the method into a compositional device.

The moving-speaker example genuinely introduces closed-loop action and should be the hinge of the essay. The four-step “common structure,” though, overfits the sources: scale evolution is not described as a system where an action changes the next state, and class-specific OOD decoding need not do so either. Present the sequence as a proposed design pattern derived from the examples, not their demonstrated common structure.

The melody-versus-harmony discussion overstates one extraction. “The path may be the stronger global organizer” needs the study’s model assumptions, dataset coverage, and definition of scale structure. Cross-cultural scale datasets are not neutral samples of all musical practice, and semitone binning imports a particular resolution. Acknowledge those limitations and cite the empirical claim.

The ending is defensible but vague: “structure emerges” can sound self-organizing when the composer or designer has chosen the representation, loss, decoder, and feedback rule. End by naming that agency.

## Clarity and Flow

Define “representation” consistently. The essay uses it for learned embeddings, WavLM features plus decoders, a Bayesian state estimate, and a scale. A brief distinction between encoded state and culturally inherited coordinate system would make the comparison rigorous.

“Pitch/time-equivariant” should be explained in one clause: for example, a pitch or time shift in the input produces a predictable change in the embedding. “Autoregressive Bayesian tracking” also needs a careful description; frame-by-frame temporal feedback is not necessarily autoregressive in the same sense as token generation.

The practical sketch is strong, but it conflates controls with tests: source class and spatial direction are variables, while reconstruction and tracking are evaluators. State which values the user sets and which the system estimates.

## Style and Voice

The voice is persuasive when it stays close to causal operations: “let the current rendering of a sound update the coordinates that will render the next one.” Preserve this. Phrases such as “old melody-versus-harmony question” and “grand consonant ratio” introduce rhetorical bias; the source apparently reports comparative constraints, not the defeat of harmony. Use more neutral wording.

Avoid repeatedly turning empirical results into declarations of what a representation “really” is. The tension between description and instrument is richer if the essay admits degrees of actionability.

## Line-Level Edits

- “when does a representation stop being a description and start becoming an instrument?” → “under what conditions can a representation support reliable musical action, rather than description alone?”
- “Its symbolic-music embeddings are trained so that pitch shifts and time shifts are not arbitrary distortions.” → “Its objective encourages pitch and time shifts to produce structured, measurable changes in symbolic-music embeddings.” Add a source citation and exact objective.
- “whose axes have been pressured to mean something musical” → “whose geometry is constrained to reflect selected musical transformations.” This avoids implying interpretable axes without evidence.
- “which origin makes this sound reconstructable?” → “which trained decoder reconstructs these features with sufficiently low error?” Then note that inferred origin depends on decoder coverage.
- “If no region explains it, the sound becomes an outsider.” → “If no region reconstructs it under the chosen criterion, the composition can treat that failure as an ‘outsider’ event.”
- “The scale-evolution extraction… argues” → “The reported evolutionary model supports, under its dataset and assumptions, a stronger role for small melodic steps than for the tested harmonic constraints.”
- “The common structure across these sources is” → “A design pattern suggested by these sources is”.
- “Structure emerges from what the representation can keep stable” → “Structure can be organized around what the chosen representation and tests preserve while sound changes.”
