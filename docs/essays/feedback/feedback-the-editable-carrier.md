# Feedback: The Editable Carrier

## Overall Impression

The essay has a compelling product-level argument: useful generative music systems need addressable, constrained editing, not only one-shot output. Its weak point is the “carrier” concept. It includes sources, representations, production processes, spaces, balances, and styles, making it broad enough to name almost any aspect of recorded music. The essay also slides between true internal editability and post hoc estimates derived by source separation. Those differ sharply in fidelity, causality, and control. Define a carrier by its function in the argument—perhaps an addressable layer through which musical identity is rendered—and distinguish native project structure from reconstructed handles.

## Structure and Argument

The first two sections establish melody/rendering and source/effect-chain distinctions, but the evidence for the headline “next useful music model” is insufficient. These papers show promising directions, not a singular frontier. Replace the market-like prediction with a scoped design claim.

“Generation Leaves Too Much Unsaid” and “The Old Studio Was Already A Graph” overlap: both argue that stereo audio collapses a structured production process. Merge or more clearly divide them—first diagnose loss of provenance, then contrast systems that retain project graphs with those that infer approximations from a render. This would also surface an important limitation: source-separated stems are not the original multitracks, inferred FX chains may be non-identifiable, and many chains can produce perceptually similar outputs.

The workflow sequence—generation, tokenization, separation, effect modeling, post-production, evaluation—looks causal but is not generally required in that order. Tokenization may occur before generation; source separation may be unnecessary with native stems; agentic editing may operate directly on parameters. Present it as a capability map, not a pipeline.

The exercise’s third edit is logically muddy: if effects are reordered or substituted while loudness and spectral balance are matched, “same room” is neither guaranteed nor the clearest notion of mix identity. The final tool proposal should also distinguish estimated descriptors from editable causal controls. An “identity-risk warning” requires a defined identity target and validated predictor; present it as a research goal.

## Clarity and Flow

Technical claims need source-specific evidence. What exactly does “8-codebook RVQ tokenizer” preserve, under which objective and metric? Does WanSong actually supply independently controllable stems, or only generated vocal/background outputs? Does StemFX recover engineering style, predict chains, or merely represent them? “Text-ready” is undefined. Cite the papers directly and avoid treating model claims as demonstrated compositional capabilities.

“The carrier is not the melody” conflicts with later examples where a stem carries a contour and the carrier map includes preserved melodic contours. Clarify the content/carrier distinction while admitting their interaction. A voice can be both source and musical material; a room response can become part of identity rather than a neutral conduit.

## Style and Voice

The studio vocabulary gives the prose authority and texture. The list of specific edit requests is especially effective. The essay is less persuasive when it declares a sweeping technological direction in bold or anthropomorphizes abstractions (“style an order,” “source-separated stem becomes an addressable body”). Keep the metaphors, but pair them with precise operational language. “The difference is not verbosity. It is agency.” is a strong turn, though “control” may be more exact than “agency.”

## Line-Level Edits

- “The next useful music model is not just a generator” → “A useful class of music models should expose constrained edits as well as generation.”
- “A carrier is the layer…” → “Here, a carrier means an addressable source or processing layer through which recognizable musical content is rendered.”
- “Cover-song generation only works if…” → “Recognizable cover generation requires some cues—often contour, rhythm, or phrasing—to remain stable while others change.”
- “compositionally it is a promise” → “its reconstruction results test whether the discrete bottleneck preserves specified musical features.”
- “Style is…a recoverable arrangement of actions” → “Some production-style cues may be modeled as an ordered set of per-stem effects; the chain is not necessarily uniquely recoverable from audio.”
- “source separation gives the material addresses” → “source separation estimates editable regions, with leakage and artifacts that limit those addresses.”
- “The old studio was already a graph” → “A multitrack session already records a graph of sources, routing, and transformations.”
- “Together they begin to recover the studio” → “Together they approximate parts of a studio graph, though they do not recover its original causal history.”
- “identity-risk warnings” → “warnings tied to an explicitly locked feature, such as contour similarity or lyric intelligibility.”
