# Feedback: What The System Is Allowed To Know

## Overall Impression

The essay has a productive governing question—what evidence is legitimately available to a system at the moment of inference—and the room-acoustics example gives that question real methodological force. The trouble is that “allowed to know” changes meaning across the four cases. In TTSYoruba it means explicit input representation; in pruning it means representational capacity; in benchmarking it means coverage of an evaluation distribution; in room prediction it means leakage or deployment-time feature availability. Those are related constraints, but they are not one information boundary. The essay currently gains elegance by blurring them. It would become more defensible if it named these as four distinct boundaries and argued that composition can make each audible.

The sources are identified only by internal extraction IDs. That may support project traceability, but it does not let a reader verify unusually precise claims. Add paper titles or links, and cite the specific tables or reported experiments behind the numerical statements. This is especially important because the prose repeatedly turns reported results into broad principles.

## Structure and Argument

The sequence is sensible: encoded knowledge, architectural capacity, evaluation coverage, then leakage. Yet the thesis is strongest in the first and fourth sections, where “what the system sees” is literal. “Capacity As A Memory Limit” is the weak link because parameter depth is not simply evidence and a transformer’s internal capacity is not memory in the ordinary or technical sense. Either recast this section as a separate “capacity boundary” or explain why resource capacity belongs under admissible knowledge.

The studio test usefully converts the research into practice, but its four items do not test a common variable. Accent and age cannot responsibly be treated as interchangeable audio “variations” one passes a phrase through; synthetic accent or age transformation risks caricaturing precisely the human specificity the benchmark section asks composers to respect. Use recordings from consenting speakers or controlled changes in vocal register and noise, and distinguish demographic coverage from signal augmentation.

The ending is resonant but repeats the opening taxonomy rather than earning a further conclusion. “The information boundary is…part of the instrument” would be stronger after one qualifying sentence: the composer must know whether the boundary concerns supplied notation, model capacity, evaluation population, or leaked test information, because those boundaries have different ethical and technical stakes.

## Clarity and Flow

Key terms need sharper definitions. “Licensed knowledge,” “admissible evidence,” “benchmark center,” and “known as a fingerprint” are evocative but underspecified. “Permitted evidence” should mean information legitimately available at deployment; if the phrase also covers training data and architecture, say so explicitly. The account of the room study should define “row-based validation,” identify what “measured-at-test inputs” are, and write $R^2$ rather than “R2.”

Several causal transitions overreach. The fact that a pruned model’s metric worsens does not establish that “timing, articulation, or spectral detail fail all at once,” nor does a WER gate establish that speech “feels like speech.” Likewise, admitting more speaker groups to a benchmark does not make age or accent “evidence”; it makes them dimensions of evaluation coverage. Tightening these sentences would improve both accuracy and momentum.

## Style and Voice

The voice is confident, compressed, and musically alert. Preserve the short declarative pivots, but reduce anthropomorphism when it conceals experimental design: benchmarks do not “admit” evidence, rooms do not know, and models are not morally “allowed” inputs unless a protocol defines that allowance. The repeated “For composition / Musically / For music / Compositionally” openings make the middle feel templated. Let one or two technical sections stand longer before translating them, then synthesize their musical consequences in the studio test.

“Beautifully explicit,” “striking,” and “sharpest” are evaluative without demonstrating why. Replace them with the precise property being praised: inspectable rules, a discontinuity in a named metric, or a validation protocol that separates interpolation from spatial generalization.

## Line-Level Edits

- “A compact Hindi TTS student can inherit a teacher's width and interfaces” is unclear and may misuse “student” if the method is iterative pruning rather than knowledge distillation. Try: “A Hindi TTS model can retain the teacher architecture’s width and input/output shapes while losing successive transformer blocks.”
- “The teacher remains near-functional after a 27 percent block reduction, collapses past 50 percent” needs a named metric and exact comparison. Replace “near-functional” and “collapses” with the reported WER or other quality measure, and cite the relevant result.
- “That cliff is…a threshold in what the model can continue to carry” presents an interpretation as a finding. Try: “That metric discontinuity suggests a capacity threshold under this pruning and re-fine-tuning procedure.”
- “how many sequential transformations are needed before speech still feels like speech?” confuses ASR WER with perceived naturalness. Try: “how much depth can be removed before intelligibility, as proxied here by ASR WER, degrades sharply?”
- “Once the benchmark admits age, accent, dialect, and domain vocabulary as evidence” should become: “Once evaluation includes speakers across ages, accents, dialects, and domains, measured robustness can change.”
- “pass the phrase through accent, age, register, and noise variations” should become: “compare consenting speakers across accents and ages, then separately test within-speaker register and added noise.”
- “using only guessed geometry” unfairly weakens geometry-based prediction. Use: “using only deployment-available geometry and environmental variables.”
