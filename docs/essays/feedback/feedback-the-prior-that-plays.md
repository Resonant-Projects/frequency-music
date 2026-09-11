# Feedback: The Prior That Plays
## Overall Impression

The essay’s opening proposition is strong: underdetermined systems do not return emptiness but complete evidence according to learned or engineered assumptions. Its weakness is that “prior” expands beyond a coherent technical or conceptual meaning. A diffusion prior, an RBM’s learned distribution, benchmark sampling bias, a codec objective, and test leakage are not the same kind of object. The last case is especially problematic: access to target-position measurements is not a prior but an input-contract violation or distribution mismatch. The essay should distinguish priors, objectives, dataset distributions, and illicit evidence, then argue that all shape what a system does under incomplete information without naming them all “prior.”

## Structure and Argument

The sequence from spatial reconstruction to symbolic invariance, population coverage, codec tradeoff, and deployment protocol is intelligible, but it becomes a catalogue rather than a cumulative proof. Introduce a simple framework: what evidence is missing, what mechanism fills or discounts it, and what claim the output may legitimately make. Apply that framework consistently to each source.

The Ambisonics section best fits the thesis, though “supplies the missing geometry” may overstate what a posterior sample represents. It supplies plausible high-order spatial detail conditioned on measurements; it does not necessarily recover the actual geometry or room. The compositional measurement/prior continuum is exciting, but the feasibility of continuously controlling posterior freedom should be framed as a proposed interface.

The Bach RBM section conflates invariance and missing evidence. A failure to group transpositions may show that the representation is sensitive to absolute pitch, not that it lacked evidence and “played a prior.” Recast it as a contrast: priors encode some regularities and omit others. Similarly, benchmark underrepresentation does not cause a model to hallucinate missing population data; it limits what performance estimates warrant. The social argument should focus on invalid universal claims, not suggest that all normalization is “correction toward the center.”

The codec section needs factual detail about what 200 bps means, what was evaluated, and whether acoustic identity was actually measured. The conclusion should advocate exposing assumptions and uncertainty, not imply every hidden mechanism can become a musician-facing knob.

## Clarity and Flow

Define “prior” in both Bayesian and looser senses, or reserve it for an explicit/learned probability distribution. “Corpus norm,” “validation protocol,” and “style model” can then be named adjacent influences. This precision will make the refrain “the prior plays” meaningful rather than totalizing.

“Evidence” also changes across sections: microphone samples, relational structure, demographic coverage, bitrate, and test inputs. A repeated sentence identifying the missing or constrained information would improve flow and expose which examples genuinely share a structure.

## Style and Voice

The essay balances caution and wonder well in “constrained imagination” and “a memory of possible worlds.” Keep those phrases, but avoid turning epistemic uncertainty into aesthetic mystique before its risks are clear. The population section deserves plainer language and supporting evidence, particularly around protected or marginalized speech communities.

The sequence of five “The Missing…” headings gives shape but sometimes forces the analogy. “The Missing Deployment” is not semantically clear; “The Hidden Input Contract” would identify the real issue.

## Line-Level Edits

- “a perceptual frequency scale” is not obviously a prior. Explain how it supplies values under missing evidence or remove it from the opening list.
- “posterior sampling to infer high-order spatial detail” should add “plausible” and distinguish reconstruction accuracy from perceptual quality.
- “The prior supplies the missing geometry” should become “The learned distribution supplies plausible unmeasured spatial detail.”
- “The listener hears…epistemology” is an artistic proposal, not an empirical claim. Try: “A composition could make that epistemic difference perceptible.”
- “The missing evidence is not a note. It is a relation.” is rhetorically strong but technically inaccurate; the relation is present in the input and not encoded invariantly. Say: “The missing capacity is relational invariance.”
- “GigaSpeechBench shows” should identify the benchmark result, populations, and metrics rather than infer underrepresentation from a general concern.
- “At 200 bps…discarding much of the voice’s acoustic body” needs measured speaker-similarity or quality evidence; bitrate alone does not establish what was sacrificed.
- “recognizing a room fingerprint” should be attributed to a demonstrated ablation or softened to “may exploit target-position-specific information.”
- “If it adds hidden test-time evidence” is category error: the system receives that evidence. Replace with “If evaluation supplies unavailable deployment inputs, the reported capability is misnamed.”
- “Expose the prior as a control surface” should be “Expose consequential assumptions and, where technically possible, make completion strength controllable.”
