# Feedback: The Interpretable Grain

## Overall Impression

The essay has a strong governing distinction—fidelity is not the same as controllability—and it reaches a useful compositional proposition: representations matter because they determine what musicians can address. The three-paper braid is intelligible, but “grain” changes meaning as the essay moves from timing distributions, to latent frequency localization, to phoneme-aligned explanations. Those are respectively a statistical variable, a representational basis, and an interpretability vocabulary. Calling all three “grain” is evocative, but the essay needs to define the common property more rigorously: perhaps a grain is the smallest unit at which a system exposes stable, intervention-ready evidence. Without that definition, the synthesis risks being verbal resemblance rather than a demonstrated connection.

The empirical claims are unusually specific but have no usable citations. The essay should identify each paper, link or formally cite it, and distinguish the paper’s findings from the essay’s interpretation. In particular, associations between synthetic timing and recognition do not by themselves establish causal control, and reconstruction quality plus wider learned bandwidths do not automatically prove that musical primitives have been “collapsed.”

## Structure and Argument

The progression from three examples to “fidelity versus access,” then time, then human-readable cues, works. The practical method earns its place because it converts the abstraction into a testable exercise. However, the opening summarizes all three papers at enough length that the next three sections partly repeat it. Shorten the opening to state the puzzle and reserve evidence for the body.

The argument also slides between properties of a representation and properties of an interface. A latent may encode pitch information without exposing a user control; conversely, a good interface may create a useful macro over an entangled representation. The synthesizer analogy actually reveals this distinction but does not analyze it. Name the levels—encoding, probe/decoder, and control interface—before concluding that an inaccessible representation is merely a renderer.

The ending is memorable, but “Below it, there is signal. Above it, there is syntax” invents a hierarchy the essay has not defended. Interpretability is not necessarily a scalar threshold, and syntax is not simply coarser grain. End instead on the defensible claim that controllable systems require named units at the scale of intended intervention.

## Clarity and Flow

“Compositionally alive,” “underlying musical primitives,” “access,” and “interpreted” need operational meanings. Does access mean linear decodability, independent manipulability, predictable perceptual change, or musician comprehension? These are not equivalent. The Gabor example could clarify the standard: what was measured as “pitch control,” and what exactly remained constant when fidelity was said to be preserved?

The timing section overextends from an ASR result to composition. “Corpus proximity is less explanatory than induced timing statistics” may be true within a particular experimental comparison, but it is stated universally. Specify the dataset, metric, and scope, and signal that the proposed overlap-profile score is an analogy, not a validated consequence.

## Style and Voice

The voice is assured and musically literate, especially in “A pause is not empty time” and the patch/control analogies. Preserve that compression. Reduce recurring formulae such as “The point is not just…” and “That is…”; they give every paragraph the same rhetorical cadence. Avoid anthropomorphic claims that a model “listens” or “understands” unless clearly marked as shorthand.

The practical method’s three grains are parallel in formatting but not in kind: timing is a distribution, frequency is an attribute, and phonetic grain is an annotation policy. Rephrase them as three control tests so their symmetry is conceptual rather than merely typographic.

## Line-Level Edits

- “what is the smallest unit of sound that remains usable after a machine has listened?” Replace “usable” with “stable enough to identify and manipulate for the task,” and clarify that the minimum unit differs by task.
- “Higher overlap exposure is associated with lower word error rate” Name the actual metric if it was cpWER, and add the tested conditions; ordinary WER and concatenated minimum-permutation WER are not interchangeable.
- “may collapse time-frequency-localized primitives into alias equivalence classes” This is technically dense and unsupported. Define the aliasing mechanism and cite the paper, or soften to “may make distinct localized features indistinguishable after downsampling.”
- “their learned filters may have bandwidths far wider than a theoretical resolution bound” Identify the bound and comparison method. “Theoretical” alone implies more authority than the sentence supplies.
- “The vowels carry the artificiality while the pauses preserve the speaker” Mark this as a hypothetical example; it currently reads like a reported result.
- “it is a renderer, not an instrument” Replace with “it behaves more like a renderer than a controllable instrument for that task.” The current binary ignores instruments with coupled controls.
- “The interpretable grain is the threshold where sound becomes steerable.” Consider “An interpretable grain is a task-specific unit at which evidence becomes nameable and intervention becomes predictable.”
