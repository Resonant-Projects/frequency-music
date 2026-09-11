# Feedback: The Proof Burden of Sound
## Overall Impression

The essay develops a useful account of listening as evidence management under time and interference constraints. “Proof burden” is a productive compositional metaphor when it names how much and what kind of evidence a listener needs before acting on a musical interpretation. The difficulty is the claim that the proof-complexity analogy “keeps the idea precise.” Formal proof length, cryptographic exploitability, statistical confidence, model classification, and human perceptual inference obey different standards. The essay should explicitly limit the analogy and replace “measurable mismatch” with proposed perceptual measures unless an actual formalization is supplied.

## Structure and Argument

The essay advances cleanly from separation to curation to streaming, then consolidates the idea as a parameter. The proof-complexity source is introduced as foundation but never described precisely enough to support the bridge. “Effective zero knowledge” and “a flaw that cannot be proven or exploited” need accurate definitions and a direct citation; proof complexity does not generally entail that unprovability makes a flaw equivalent to no flaw. If the source is a magazine article, distinguish its explanatory analogy from a primary result.

The audio examples each involve different claims. SR-CorrNet estimates separated signals; FSD50K-Solo classifies or curates examples under a definition of source purity; a streaming SpeechLLM commits to translation output under latency constraints. None literally proves source identity. Define proof burden as the essay’s metaphorical term for evidence required by an agent under a task-specific decision rule. That preserves the insight without borrowing mathematical certainty.

The orchestration paragraph is strong but should acknowledge auditory scene analysis: shared onset, harmonicity, spatial position, timbre, and continuation can promote either fusion or segregation, and cue effects are context-dependent. “Pay the proof cost with redundant cues” is too one-directional; some cues conflict, dominate, or become inaudible under masking.

The ending gestures toward tools that estimate evidence curves but needs an operational proposal. What observation would constitute a source-identity curve or meter-evidence curve? Listener response time, confidence, model posterior, or prediction error would yield different constructs. Close by naming this as a research program rather than a readily available tool.

## Clarity and Flow

The essay uses “proof,” “evidence,” “identity,” “claim,” and “knowledge” fluidly. Establish a hierarchy: acoustic cues are evidence; a system applies a decision rule; a provisional interpretation crosses an action threshold. “Proof” can then remain the governing metaphor without confusing it with logical demonstration.

“The structure exists, but its proof is too late” also assumes an objective structure independent of analysis. In ambiguous harmony or meter, multiple interpretations may remain legitimate. Say that a particular interpretation may not become available in time to shape live perception.

## Style and Voice

The questioning voice is effective, and “what does the music ask the listener to prove?” is a strong ending. The prose becomes overconfident when it converts suggestive analogy into scientific language. Preserve the aphorisms while placing caveats close to them rather than in a general disclaimer.

The bullet list of compositional operations is useful, but punctuation should be consistent. The phrase “wonderfully concrete” is unnecessary self-evaluation; let the final question demonstrate its concreteness.

## Line-Level Edits

- “every listening system carries a proof burden” should become “every listening system operates under an evidence threshold, explicit or implicit.”
- “an unexploitable flaw behaves like no flaw at all” requires careful attribution and conditions; it is not a general cryptographic equivalence.
- “infer the exact sources…exact room contribution” invokes identifiability that may be impossible even with unlimited computation. Replace “in principle” with a task-bounded target.
- “A chord may have an elegant theoretical interpretation that no listener can establish” should acknowledge analyst disagreement and listener expertise.
- “turning mixed observations into filters for target recovery” needs a direct technical citation and should not imply perfect recovery.
- “the piece must pay the proof cost” should be “the composer can strengthen segregation cues.”
- “Single-source audio is not a metaphysical category” is effective, but follow it with the dataset’s actual operational criterion.
- “A downbeat must become believable before the body can move with it” is too absolute; entrainment can be anticipatory and revised.
- “a measurable mismatch” should become “a potentially measurable relation,” followed by candidate measures.
- “how hard its claims are to prove in time” should be “how quickly and confidently listeners or models converge on specified interpretations.”
