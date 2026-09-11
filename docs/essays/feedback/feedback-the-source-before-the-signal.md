# Feedback: The Source Before the Signal

## Overall Impression

This is a lucid, ambitious essay whose strongest contribution is the practical axis of “source certainty.” Its core formulation, however, reverses the relation between source inference and signal too aggressively. A signal exists and can be processed before a source is identified; source attribution conditions some later judgments, but pitch, onset, or anomaly need not universally wait for a categorical source decision. The essay should present source inference as an interacting layer, not an absolute prerequisite, and separate model architecture from claims about human auditory organization.

## Structure and Argument

The sequence—curation, separation, benchmark identity, composition—is coherent. It is also very close to several neighboring essays, so this version needs a distinctive argumentative center. “Source certainty” provides that center; introduce it earlier and make each paper supply a different uncertainty: event purity, stream assignment, or known machine identity.

The FSD50K-Solo section conflates “single class,” “single event,” “isolated cause,” and “purity.” A recording can contain multiple instances of one class, and a diffusion-generated example can contain artifacts while remaining class-pure. Explain the annotation target and validation method. The claim that the system learns “isolated cause” may exceed what its binary classifier establishes.

The SR-CorrNet-to-human-listening analogy needs a firewall. A neural correlation-to-filter module and auditory scene analysis may exploit analogous cues, but “very close to what skilled listening does” requires auditory-science evidence. The counterpoint paragraph is compelling as a heuristic, yet parallel motion does not necessarily reduce stream independence, and contrary motion is not a universal separation aid. Frame these as controllable tendencies conditional on timbre, register, and context.

The anomaly section needs empirical details and causal restraint. Give the scale of the drop, the evaluation setup, and the correlation statistic if available. Then distinguish knowing a machine identifier from inferring an acoustic source. The harmony analogy illustrates relational judgment well, but key/chord context is not source identity; say it is an analogy about conditional evaluation.

The list of six controls is the essay’s practical payoff. It should become a set of hypotheses rather than laws, ideally with citations to auditory grouping. The conclusion repeats the thesis in four forms. End instead with a bounded claim: composing the reliability and timing of attribution cues can shape whether a listener hears object, stream, or texture.

## Clarity and Flow

Define “source identity” at the start. The essay alternates among physical cause, instrument category, individual machine, separated stream, and perceptual object. “Identity layer,” “listening contract,” and “source model” are useful only if readers know which sense applies.

The sentence “source identity is not metadata. It is part of the signal model” is memorable but imprecise: machine identity can literally be metadata, while also conditioning a model. State that identity assumptions are part of the inference problem even when supplied as metadata.

## Style and Voice

The confident, essayistic voice works best in the compositional examples. It becomes overstated when rhetorical certainty substitutes for evidence: “The deepest musical implication,” “the ear’s first act,” and “cannot treat” all announce stronger conclusions than three engineering papers warrant. Preserve the cadence while adding epistemic markers—“suggests,” “for these tasks,” “can.”

The title is paradoxical but potentially misleading. If retained, explicitly explain near the opening, not only at the end, that “before” means structurally or inferentially rather than temporally or physically.

## Line-Level Edits

- “Before a system can decide what a sound means, it has to decide what kind of source made it.” → “For many audio judgments, a system must implicitly or explicitly estimate which source model makes the evidence meaningful.”
- “The shared lesson is sharp: source identity is not metadata.” → “Across these tasks, supplied identity metadata can hide how strongly performance depends on source attribution.”
- “The system does not simply find purity” → “The pipeline operationalizes class purity using synthetic examples and controlled mixtures.”
- “The ear…infers sources by correlating…” needs an auditory-scene-analysis citation and should read “may group components using cues such as…”
- “Parallel motion…reduce[s] the evidence” → “Depending on register and timbre, synchronized motion and articulation can encourage fusion.”
- “A sound is anomalous only after a source model has been established.” → “Anomaly judgments are ordinarily conditional on an expected source or context.”
- “synchronized attacks fuse; staggered attacks separate” → “synchronized attacks can promote fusion; onset asynchrony can promote segregation.”
- “The source comes before the signal” → “In the judgments examined here, the interpretation of the signal depends on a provisional account of its cause.”
