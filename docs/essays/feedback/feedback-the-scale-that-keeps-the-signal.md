# Feedback: The Scale That Keeps The Signal

## Overall Impression

The essay identifies a valuable design question—what a representation preserves for a task—but “scale-preserving representation” is not yet defined tightly enough to unify modulation spectra, token alignment, ultra-low-bitrate coding, wavelet scattering, and Tonnetz geometry. In several examples, the decisive issue is objective or coordinate system rather than scale. ClariCodec changes the optimization target; a Tonnetz changes relational representation; tokenizer alignment reconciles rates or units; WST-X tunes invariance and resolution. Calling all of these “scale choices” risks making the concept so broad that every representation qualifies.

The ending supplies the most defensible formulation: preservation is a task-specific promise. Center that idea earlier and treat scale as one axis among objective, invariance, granularity, and geometry. The essay can remain synthetic without claiming a single technical mechanism.

## Structure and Argument

The opening paragraph introduces five sources in a dense catalogue, then the next section repeats each. Use the introduction only to state the problem and move paper details into “What Must Survive.” More importantly, identify both the preserved quantity and the discarded quantity for each case. The rhythm analysis preserves low-frequency envelope organization while discarding waveform detail; the codec aims to preserve intelligibility under a rate budget; wavelet settings preserve discriminative artifacts while accepting certain deformations. For Qwen3.5-Omni and Tonnetz, the essay must state comparable tradeoffs rather than merely assert analogy.

The claim that each source “rejects a naive kind of fidelity” is too strong for Tonnetz theory, which may not be responding to signal fidelity at all. Likewise, “optimizing word error rate” needs methodological precision: is WER a training loss, a differentiable proxy, a reinforcement objective, or an evaluation criterion? At 200 bps, “acoustic reconstruction is too expensive a target” is rhetoric unless the paper directly demonstrates that conclusion.

The compositional example is imaginative but technically underspecified. A “200 bps-like reduction” is not reproducible, and vowel spectra do not straightforwardly become a harmonic color field without a mapping. Either describe an implementable chain or present it explicitly as a sketch. The Tonnetz step feels appended; explain what musical relation it preserves that the earlier transformations threaten.

## Clarity and Flow

Define “scale” before using it as the umbrella term. Does it mean temporal window, frequency resolution, bitrate, token granularity, or abstraction level? Those are related but non-equivalent. A compact taxonomy would prevent equivocation.

“The representation’s ethics” is an interesting phrase but jumps from objective design to moral language without naming the stakeholder or harm. “Priorities” or “value function” would be more precise unless the essay develops who benefits when intelligibility is privileged over speaker identity, naturalness, or paralinguistic cues. At very low bitrates, those sacrificed cues may themselves matter ethically.

Technical terms including rhythm formants, deformation stability, directional resolution, and Tonnetz configurations need brief definitions or citations. “Speech tokenizers move at incompatible rates” should distinguish token rate from unit granularity and alignment instability.

## Style and Voice

The repeated sentence pattern—“X makes the same point,” “X adds,” “X gives”—makes heterogeneous studies sound more consensual than they are. Use contrast to acknowledge that the examples preserve different targets for different users. The musical prose is strongest in “At every step, the composer asks: what must survive here?” Keep that refrain.

Avoid treating paper names or product claims as verified facts without reported evaluation. The essay can say “the authors report” and specify metrics without losing momentum.

## Line-Level Edits

- “a musical signal is not preserved by measuring it more completely” → “A useful musical representation need not preserve every measurable feature.” The original creates a false opposition between measurement and preservation.
- “roughly the syllabic and phrasal rhythm band” → give the reported frequency range and cite the study; syllabic and phrasal rates are not interchangeable.
- “ClariCodec pushes speech down to 200 bps and improves intelligibility” → “At 200 bps, ClariCodec reportedly improves [metric] relative to [baseline].” Name the comparison.
- “fine spectral artifacts” → “artifacts at the time-frequency resolutions emphasized by the chosen scattering parameters.” “Fine” alone is not informative.
- “Prosody…depends on an alignment scale” → “The model’s prosody may benefit from an alignment mechanism that reconciles linguistic and acoustic token sequences.”
- “The music is not reduced to geometry” → specify what the cited Tonnetz construction enables—adjacency, transformation, classification, or voice leading.
- “A 200 bps-like reduction” → “Encode and decode the phrase with a specified ultra-low-bitrate codec, then derive musical material from what remains.”
- “scale-preserving representation names the common operation underneath them” → “task-conditioned preservation may be the broader operation; scale is one way to implement it.”
