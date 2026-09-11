# Feedback: The Test-Time Instrument

## Overall Impression

This is a promising essay about operational availability: the inputs, coordinates, alignments, and output separations accessible when a system must act. The room-acoustics example precisely motivates “test-time evidence,” but later cases drift into preprocessing, representation design, and output format. The essay recognizes this drift in its final litany—“input contract,” “representation basis,” “output separation”—yet never revises the title concept to encompass it. Either narrow the essay to information available at inference or rename the principle around the broader idea of an operational interface.

## Structure and Argument

Five examples give the piece breadth but not enough comparative structure. MulTTiPop’s manual anchor selection concerns dataset construction and alignment, not necessarily evidence available to a deployed model. GLRF changes the latent basis, while WanSong exposes stems as outputs. These support “what can downstream users access,” not “what the system knows at test time.” A table-like paragraph distinguishing stage, available information, and resulting affordance would prevent conceptual slippage.

Several causal conclusions exceed the stated evidence. A fall in room-parameter accuracy under position-grouped splits may reveal leakage, distribution shift, loss of measured covariates, or all three; “the same hybrid CNN…can use the target impulse response as a position fingerprint” needs the paper’s ablation or analysis. The 38 percent onset F1 does not by itself “expose the difference between a symbolic object and a performed recording”; it also reflects model architecture, label construction, matching errors, repertoire, and the F1 tolerance window.

The conclusion should deliver a bounded claim: compositional affordances depend on which variables remain available for intervention at each stage. That is defensible and connects every example without equating availability with knowledge.

## Clarity and Flow

Technical terms need brief definitions: ISO 3382-1 parameters, onset F1, equivariance, alias equivalence classes, Gabor basis, and pure diffusion. The phrase “The sound was already there” is misleading for a latent representation; pitch-relevant information may be decodable without being linearly localized or independently controllable. “Reach into it cleanly” should become an operational statement about a specified manipulation or evaluation.

The composition paragraph is imaginative but introduces interfaces not demonstrated by the cited systems. Mark “basis selector,” progressive room fingerprints, and fused/stem switching as proposals. Also explain whether acquiring measured room information during performance is technically feasible or simply a thought experiment.

## Style and Voice

The direct questions create a strong spine. Keep “what does the piece know while it is happening?” as a deliberate metaphor, then immediately translate it into “what information is available to the system and performer at each moment.” The repeated formula “X is one instrument; Y is another” becomes categorical where “different operating mode” may be more accurate.

## Line-Level Edits

- “what a system is allowed to know at the moment of action” → “what information and controls are available when a system produces or revises an output.” Systems do not “know” raw inputs in an undifferentiated sense.
- “reported accuracy falls dramatically” → give the actual metric and before/after values. “Dramatically” is evaluative without numbers.
- “If it knows the target position’s impulse response” → “If prediction uses features derived from an impulse response measured at the target position.” This identifies the potential leakage precisely.
- “The best automatic transcription model still reaches only 38 percent onset F1” → include instrument scope, onset tolerance, averaging convention, and test split; otherwise the figure is uninterpretable.
- “pitch and time shifts have measurable effects” → “the reported embedding metric varies with specified pitch and time shifts.” All nonconstant encoders have measurable effects; the issue is structure and consistency.
- “Strided convolutional encoders may collapse time-frequency primitives into alias equivalence classes” needs a definition, citation, and qualification indicating whether this was theoretically shown or empirically inferred.
- “a pure diffusion song model” should be explained or omitted; purity of architecture does not advance the argument.
- “The extractions suggest they are compositional parameters” → “The cited systems suggest these engineering choices can become compositional parameters when an interface exposes them to musicians.” Exposure is the missing condition.
