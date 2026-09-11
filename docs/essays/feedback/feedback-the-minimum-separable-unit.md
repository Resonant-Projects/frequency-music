# Feedback: The Minimum Separable Unit

## Overall Impression

The essay develops a persuasive musical proposition: perceived units are constructed through cues and can be compositionally expanded, fused, or destabilized. The passage that moves from cleanly differentiated instruments toward a fused environment is especially concrete. The main conceptual problem is the word “minimum.” The cited systems do not establish a smallest acoustic atom shared across tasks; they define task-specific units at different scales—a curated event, a speaker estimate, and sufficient streaming context. “Separable unit” also conflates physical sources, perceptual objects, labeled examples, and processing chunks.

The essay should foreground that the unit is operational and task-relative. It also needs full citations and measured results, not just extraction IDs. Claims about what late disentanglement loses, how FSD50K-Solo constructs references, and how the streaming model schedules output should be traceable to primary sources.

## Structure and Argument

The opening question is effective but currently presupposes a single answer. Revise it toward “What is the smallest unit this listening system can treat reliably for this task?” That wording makes the following diversity a strength rather than a contradiction.

The three technical paragraphs should distinguish their evidence standards. FSD50K-Solo concerns dataset curation and label purity; it does not necessarily identify the minimum temporally or perceptually separable unit. SR-CorrNet concerns recovering overlapping speech sources, but “the speaker” is not a unit in the same sense as a sound event. Streaming translation concerns an adaptive context window sufficient for token prediction, not acoustic separability. The last example may belong under “minimum actionable context” rather than source separation. Explain why it remains in the essay or replace “separable” with a broader term such as “operative.”

The claim that early separation is necessary because later compression has already destroyed evidence needs the paper’s architecture and ablation results. “Before too much information has been compressed away” is a plausible interpretation, not an automatic consequence of a late-split design.

The musical middle is the strongest section. It could become even more rigorous by drawing on auditory scene analysis: common onset, harmonicity, spatial location, temporal coherence, and spectral continuity are grouping cues, but none singly guarantees a source percept. Cite foundational or current perceptual work rather than deriving human listening principles solely from machine models.

The dataset paragraph opens a valuable annotation question—at what scale is a label valid?—but “flute-plus-breath object” illustrates ontology rather than annotation practice. Specify whether the proposed tool needs hierarchical labels, multi-label regions, source stems, or confidence estimates. The ending should conclude that sourcehood incurs model- and listener-dependent evidence requirements, not literal costs “paid for” by latency in every case.

## Clarity and Flow

The essay is generally readable, but “one sound,” “one source,” “one operative thing,” “unit,” and “object” are treated as synonyms. A source can produce multiple events; one perceptual object can fuse multiple physical sources; one translation unit can span several words. Define the axes—causal source, perceptual object, annotation unit, processing unit—then state which axis each paragraph addresses.

“Safely” and “usable” need criteria. Safety might mean low contamination probability, stable reconstruction, or acceptable translation error. Naming the error condition would make every example more precise.

## Style and Voice

The compact voice and gradual fusion exercise are effective. Preserve the tactile verbs—align, share, borrow, erase—but reduce declarations that convert an analytic decision into an ontological fact. “It is stabilized by analysis” is evocative yet suggests the model creates source identity rather than estimates it.

The critique of notation is too casual. “Western notation often pretends” anthropomorphizes a heterogeneous practice and invites a historical objection unnecessary to the argument. State its representational emphasis without claiming pretense.

## Line-Level Edits

- “the smallest thing a listening system can safely treat as one sound” should specify task and error tolerance.
- “A sound event dataset is not automatically built from labeled recordings” could become “A class label does not guarantee that a recording contains only one audible source.”
- “manufactures a reference for single-source identity” is unclear. Use the paper’s own term for synthetic mixtures, training data, or pseudo-labels.
- “train a filter” may be technically wrong if the pipeline trains a classifier or sample-selection model; verify and name the component.
- “source identity must be negotiated” should be “source-specific information must be preserved and assigned,” if supported by the architecture.
- “The minimum unit is … a moving boundary” is a category shift. Use “The required context is adaptive rather than a fixed-duration chunk.”
- “Western notation often pretends” could become “Common-practice notation represents note events more explicitly than continuous timbral and spatial processes.”
- “A drum hit can be … a cloud of partials” should acknowledge its noise and inharmonic components; “spectral components” is safer.
- “source-pure” needs definition and should be framed as a perceptual design target, not an absolute property.
- “Sourcehood is never free” could become “Reliable source attribution depends on cues, assumptions, and available context.”
