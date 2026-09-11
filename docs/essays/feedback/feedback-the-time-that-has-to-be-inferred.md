# Feedback: The Time That Has to Be Inferred
## Overall Impression

The essay’s four-layer model—score, gesture, acoustics, inference—is clear and compositionally fertile. It avoids reducing expressive timing to onset deviation and gives the reader several practical ways to make temporal layers disagree. The central term, “temporal evidentiality,” however, arrives near the end without a stable definition and risks sounding like a renamed bundle of familiar concerns: performance timing, acoustics, and perceptual inference. The essay should state precisely what the term adds. It also needs stronger factual discipline around what each cited system measures or predicts. Extraction IDs alone make the empirical claims difficult to audit; paper-level citations and, where relevant, dataset or metric definitions are necessary.

## Structure and Argument

The numbered translation stack is an effective early map, and the four source paragraphs correspond to it reasonably well. Yet the mapping is not one-to-one: VocalRender spans score and synthesis, SKY-Piano records gesture rather than establishing how listeners infer it, the MIDI metric evaluates representations, and live separation concerns source recovery under acoustic mismatch. Acknowledge this asymmetry rather than implying that the four papers collectively validate a single stack.

The middle repeats the same proposition at three levels: each layer has a clock, note-wise metrics miss relations, and the room alters evidence. Condense those claims and devote the saved space to the hard question: when two layers disagree, how would a composer or evaluator tell which one “decides”? That would turn a persuasive metaphor into a testable framework.

The proposed tool design is the strongest section, but “inference time” mixes latency with content: “what a listener or model can recover” is not a temporal layer unless tied to an observation window or decision point. The conclusion should define temporal evidentiality as the allocation of authority among time-bearing representations, then admit that the papers motivate rather than establish that concept.

## Clarity and Flow

“Written time is not performed time” is intuitive but too binary. Scores can encode performance instructions, and performance is constrained by notation. “Symbolic time underdetermines performed time” would be more precise. Similarly, gesture time includes anticipatory motion, while acoustic time includes propagation and decay; neither is a single clock. The essay will be clearer if it uses “timescale” or “temporal evidence” rather than “clock” whenever no actual clock or deadline is identified.

The SKY-Piano discussion blurs missing data with musically meaningful absence. Marker occlusion is a measurement problem, not necessarily a gap in performance time. That analogy can remain, but it must be labeled as an analogy. The live-separation paragraph should also distinguish room impulse responses, loudspeaker coloration, crowd noise, and source timing; they affect recovery differently.

## Style and Voice

The voice is confident, accessible, and strongest when it names concrete phenomena such as consonants taking time from vowels. It becomes less exact when lyrical compression substitutes for mechanism: “the room late,” “the wrong temporal world,” and “which temporal evidence should be allowed to decide?” Keep these phrases, but anchor each in a specified parameter or observable outcome. Repeated sentence openings (“A score…,” “A late note…,” “A phrase…”) create pleasing cadence, though the final third could use more syntactic variation.

## Line-Level Edits

- “written time is not performed time” could become: “symbolic duration does not uniquely determine performed duration.” This retains the hook while avoiding a false separation.
- “If the model predicts output length during synthesis” needs confirmation and a definition of output length. Consider: “If VocalRender explicitly predicts acoustic duration rather than receiving it from an aligner, it is estimating one part of the score-to-performance mapping.”
- “The flagged-versus-imputed motion data is conceptually beautiful here” makes a data-quality flag carry too much philosophical weight. Consider: “The distinction between observed and imputed motion usefully exposes where the dataset ends and reconstruction begins.”
- “performance time contains gaps” is misleading because the performance continued during marker occlusion. Replace with: “the motion record contains gaps even when the performance does not.”
- “Contextual embeddings and kernel distances are attempts to evaluate the temporal field” should name the exact embedding, kernel metric, and validation against human judgments; otherwise “better perceptual proxies” remains unsupported.
- “A separator trained only on studio stems has learned the wrong temporal world” is vivid but imprecise. Consider: “A separator trained on clean studio mixtures faces a distribution shift in reverberation, playback coloration, masking, and audience noise.”
- “Keep the MIDI quantized but move the room late” is unclear. Consider: “Keep MIDI onsets quantized while increasing pre-delay or late-reverberation energy.”
- “temporal evidentiality” needs an inline definition at first use: “the distribution of timing authority among score, gesture, acoustics, and inference.”
