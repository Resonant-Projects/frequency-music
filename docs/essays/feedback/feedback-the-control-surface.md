# Feedback: The Control Surface

## Overall Impression

This is an ambitious synthesis with an attractive central claim: useful musical parameters expose a regime of possible action, not merely scalar values. The essay’s breadth is also its main liability. “Control surface” expands to include pitch neighborhoods, dynamical trajectories, experimental validity, correction representations, and attention weights. By the end, it risks meaning any structured relation that affects a result. The draft needs a stricter criterion separating a control surface from a representation, metric, constraint, or evaluation protocol. Without that boundary, the thesis becomes difficult to falsify.

## Structure and Argument

The five-thread structure is orderly, but the argument accumulates examples rather than demonstrating a common mechanism. Pitch controls and weighting functions can plausibly be manipulated by a musician; dataset leakage and boundary tolerance are choices made by researchers. Calling both “control surfaces” elides who controls what, at which stage, and toward which outcome. Introduce a small taxonomy: operational surfaces change generated audio; inferential surfaces change what a model can recover; evaluative surfaces change what counts as success. Then say whether the essay intends all three or only uses the latter two analogically.

The maxim “A musical parameter is mature when it exposes the right control surface” is memorable but circular: “mature” and “right” are undefined. What makes a surface right—causal specificity, perceptual legibility, robustness, low dimensionality, or alignment with a musician’s intent? Offer criteria and acknowledge tradeoffs. A surface that exposes more structure may also create cognitive overload or unstable interactions.

The imagined phrase provides a welcome compositional payoff, but it combines unrelated transformations sequentially without explaining why they form one piece rather than a demonstration reel. Ground the scenario in a single musical goal—say, preserving phrase identity while changing pitch organization, density, restoration, and evidence visibility—and specify what remains invariant.

The ending is elegant but too totalizing. “Sound becomes compositional when…” implies sound is not already compositional without a system-provided intervention point. Narrow this to tool design.

## Clarity and Flow

Several coined concepts arrive in rapid succession—“pitch field,” “change vector,” “admissible signal,” “correction surface,” “weighting function”—with only compressed examples. Readers unfamiliar with the source essays may not know whether these are established technical terms or this project’s interpretive vocabulary. Label them as local concepts and define each in plain language.

The pitch paragraph bundles scale steps, lexical tone, supersaw detuning, and partials. Their relation is suggestive, but “field of nearby permissions” does not specify whether nearness is intervallic, perceptual, spectral, or cultural. One sentence distinguishing those neighborhood types would prevent a poetic phrase from substituting for analysis.

The source note provides extraction IDs but no conventional citations, titles, or direct mapping from claims to sources. Empirical statements—especially about model behavior, leakage, and authenticity—need inline references or numbered source markers.

## Style and Voice

The prose has energy and a coherent house voice. “Instead of editing the object, the musician edits the regime” is the essay’s clearest formulation. Retain that sentence and make earlier passages earn it. Reduce repeated constructions such as “thread makes the same move,” which flatten meaningful differences among domains.

Avoid presenting speculative compositional interpretations with the same certainty as reported research findings. Mark the pivot with “compositionally, this suggests” or “by analogy.” That small tonal distinction will strengthen rather than weaken the voice.

## Line-Level Edits

- “what does a musical system let you touch?” → “which properties can a musical system make directly and predictably actionable?”
- “It is ‘decide what kind of neighborhood C4 has.’” → “It is ‘choose whether C4 is organized by scalar adjacency, contour, detuned density, or partial structure.’” The alternatives become inspectable.
- “all treat a sound as something under directed motion” → “all model change through a directed trajectory, although the state variables and objectives differ.” Add citations for each technical characterization.
- “A model can only be trusted if the evidence it uses belongs to the task” → “An evaluation supports its intended claim only when the decisive evidence is relevant to that task.” This avoids an absolute claim about trust.
- “It is projecting a damaged or ambiguous signal onto a surface” → “It maps a damaged or ambiguous observation into a representation where a specified error can be estimated or corrected.” “Projection” has a technical meaning and may be inaccurate for some examples.
- “A musical parameter is mature” → “A musical parameter becomes more useful when it exposes the structure governing its effects, not only a value.”
- “Nothing mystical is required.” → Delete; nothing preceding it alleges mysticism.
- “Sound becomes compositional when a system gives us a faithful place to intervene.” → “A musical tool becomes compositionally useful when it offers a faithful, legible place to intervene.”
