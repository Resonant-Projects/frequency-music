# Feedback: The Parity Layer
## Overall Impression
The essay’s engineering intuition is strong: representation boundaries carry preservation obligations, and mismatches can invalidate musical or linguistic claims. “Parity layer,” however, currently covers at least four distinct problems—symbol-to-acoustic realization, model compression fidelity, sample-rate/bandwidth conversion, and training-serving feature equivalence. Only the last is conventionally “parity.” The other cases involve fidelity, invariance, or specification. The essay needs either a narrower term or an explicit argument that parity means preservation of a named property across any transformation, not numerical equality between implementations.

The final design rule is the right organizing principle and should appear near the beginning. It would let each case name its promised invariant and its verification method, giving the essay more than thematic resemblance.

## Structure and Argument
The four-case structure is clear, but the evidentiary strength varies. Fretiq is the cleanest case because Python/TypeScript feature parity can be directly measured. Hindi TTS also fits if library mismatches are documented through controlled comparisons. Yoruba concerns correctness across a synthesis pipeline, not necessarily parity between two implementations. UniPASE raises an open technical question and therefore cannot yet support a conclusion about what survives.

Reorganize the essay from strongest literal case to broader analogy: Fretiq, Hindi TTS, Yoruba, UniPASE. Alternatively, retain the present order but state that “parity” broadens stepwise from implementation equivalence to preservation contracts.

The UniPASE section is appropriately skeptical but technically imprecise. A 16 kHz waveform cannot contain frequencies above 8 kHz. Converting it to 48 kHz cannot recover those frequencies unless a later bandwidth-extension stage synthesizes them from another representation. The essay hypothesizes that “the acoustic representation carries recoverable detail before vocoding,” but if the vocoder’s 16 kHz output is the only input to conversion, that detail cannot pass through. Verify the actual pipeline and distinguish resampling from bandwidth extension.

The ending claims “composition theory,” while most proposed tests are validation engineering. Make the compositional payoff explicit: preservation contracts allow artists to decide which invariants remain fixed while other dimensions transform.

## Clarity and Flow
“Prevents a concept from changing identity” is too anthropomorphic and abstract. Say that the layer detects or limits divergence in a specified property across representations. “Several places agree” should identify whether agreement is symbolic, numerical, perceptual, or statistical.

For Yoruba, define diphone and explain why there are “five tonal variants” rather than assuming readers know the phonological inventory. Any account of Yoruba tone needs linguistic citations and care around level tones, contour formation, downstep, coarticulation, and dialect. “Lexical contrast can collapse” is plausible but should be tied to intelligibility or tone-realization evaluation.

ASR WER is not evidence of voice identity or prosody. The essay recognizes this in the design rule, but the Hindi section initially treats “strong behavior” as if one metric established general fidelity. Report all available evaluations and explicitly identify missing ones.

## Style and Voice
The prose is vivid without being ornate. “The parity layer showing its teeth” and “the browser stage hear the same guitar” give engineering stakes musical presence. Preserve those touches, but reduce the number of sweeping category statements such as “They are not outside the musical claim.” Some are correct only after the preservation target has been defined.

The case headings are effective. The source footer, by contrast, is an inventory of internal IDs and keywords rather than usable scholarship. Add stable citations for each system and attach exact claims to them.

## Line-Level Edits
- “Some audio facts only remain true” → “Some claims about audio systems remain valid only when implementation boundaries preserve the measured property.”
- “A teacher model becomes a compact student” → “A student model is derived from a teacher”; one object does not literally become the other.
- “five tonal variants for consonant-vowel combinations” → clarify inventory construction and whether five applies to every CV unit.
- “derive contextual rising and falling tones from level-tone input” → cite the exact phonological rules and distinguish phonemic tones from surface contours.
- “strong behavior down to 131M parameters” → report metrics, datasets, and teacher/baseline comparisons.
- “library-version mismatches can silently degrade synthesized audio” → specify affected libraries, versions, and observed degradation.
- “what does it mean to recover high-frequency detail” → “Because a 16 kHz waveform is band-limited below 8 kHz, what mechanism, if any, generates content above that boundary?”
- “97.1% shuffled frame-level validation accuracy” → flag leakage risk from correlated frames and explain why held-out free-play accuracy is the more relevant generalization result.
- “to guarantee training-inference parity” → “to pursue and test training–inference parity”; duplicate implementations do not guarantee equivalence.
