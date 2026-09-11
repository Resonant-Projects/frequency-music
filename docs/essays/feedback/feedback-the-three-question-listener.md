# Feedback: The Three-Question Listener

## Overall Impression

The who/what/when framework is clear, memorable, and immediately applicable to polyphonic analysis. The proposed “layered event ledger” is the essay’s strongest practical contribution because it turns the triad into a data structure while retaining confidence and competing interpretations. The central weakness is that the categories are treated as universally separable even when their definitions are unstable in music. A spectral region is not the same kind of identity as a singer; harmonic function is not the same kind of event as a bow change; and shared time coordinates do not by themselves solve auditory object formation. The essay should acknowledge that the ledger is a modeling choice whose ontology must be task-specific.

## Structure and Argument

The four source summaries move from grounding to benchmark failure, identity disentanglement, and causal modeling. TagSpeech directly supports the triad. MUGEN supports a capacity problem under multiple inputs, but the inference that models lack “auditory object permanence” is speculative unless the benchmark diagnoses retention through time rather than context length, attention, ordering, or prompt difficulty. DSEF-PNet supports nuisance variation in enrollment, though “tries to isolate speaker identity” needs a more exact statement about its loss and evaluation. The world-model paragraph is the least grounded and could be shortened or moved after the practical proposal as a future direction.

The research test is underdesigned. Mixed audio, separated stems, and permuted candidate inputs differ in information content and task formulation. A performance change would not uniquely identify object-permanence failure. Hold acoustic evidence constant when testing order sensitivity; separately compare mixtures with oracle stems to measure separation dependence. Predefine identity and event labels, temporal tolerance, permutation protocol, and metrics. Include human annotator agreement because the categories may be genuinely ambiguous.

The ending is evocative but claims overlap is “where identity, action, and time negotiate.” Sometimes overlap simply masks evidence. A defensible conclusion would say overlap reveals whether a representation can maintain multiple linked hypotheses.

## Clarity and Flow

Define diarization for readers outside speech research, then explain how the musical problem exceeds it. “Semantic stream” and “speaker stream” require a one-clause explanation. The sentence “timing becomes the synchronization signal between them” needs verification: timestamps may be jointly predicted anchors rather than a causal synchronization mechanism.

The essay also shifts between “source,” “speaker,” “auditory object,” and “identity” without specifying persistence criteria. Is identity physical cause, perceived stream, assigned track, or label? This is especially important for synthetic layers and spectral regions, which may not correspond to independent causes.

## Style and Voice

The interrogative opening and short triad are effective. The voice becomes overconfident around metaphorical terms—“hinge,” “braided,” “somewhere to live,” “object permanence”—that carry different technical meanings. Keep the musical warmth, but follow each metaphor with an operational definition. Avoid “deliciously practical” language; it adds enthusiasm without clarifying the claim.

## Line-Level Edits

- “a useful listener has to answer three questions at once” → “many polyphonic listening tasks require linked estimates of identity, event, and time.” This avoids making the framework exhaustive.
- “all ask the same structural question” → “can be analyzed through a related structural question.” A quartet and field recording may require different ontologies.
- “Time is the hinge that lets identity and content stay coordinated” → “Shared temporal anchors provide indices through which identity and content predictions can be associated.”
- “large audio-language models degrade sharply” → report models, task metric, number of inputs, and magnitude. “Sharply” is unsupported without values.
- “If that result holds beyond the abstract” appears to mean “abstract” as paper summary. Replace with “If the result generalizes beyond the benchmark conditions.”
- “tries to isolate speaker identity” → “penalizes output inconsistency across enrollments from the same speaker, aiming to reduce dependence on enrollment-specific content or affect.” Verify that these pairings are indeed same-speaker.
- “A graph of states and actions gives that question somewhere to live” → “A causal state-action model could make such counterfactuals explicit, provided its interventions correspond to musically meaningful variables.”
- “where the model’s auditory object permanence breaks” → “whether performance depends on presentation order or access to oracle separation.” Reserve “object permanence” for a separately defined diagnostic.
