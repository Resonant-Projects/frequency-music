# Feedback: The Hidden Carrier

## Overall Impression

The essay’s question—what information survives transformation, and where is it carried?—is fertile. Its strongest contribution is the proposal to compose “survival rules” rather than only events. The technical synthesis, however, relies on three sources that operate at very different levels: a commercial dynamics plugin, a semi-fragile watermarking system, and a learned representation. Critical-band processing concerns psychoacoustic resolution and masking; a watermark is deliberately encoded auxiliary data; phase equivariance is an architectural property. Calling them all “hidden carriers” is an evocative analogy, not a demonstrated common mechanism.

Factual precision is the central need. The source note gives titles but no authors, venues, links, versions, benchmarks, or primary documentation for Bark24. Assertions about imperceptibility, robustness, collapse under editing, human judgments, and improved retrieval all need metrics and conditions.

## Structure and Argument

The sequence from critical bands to phase to semi-fragile identity is coherent, and the studio experiment gives the essay somewhere to go. But the title concept is never defined tightly. Is a carrier a signal component that encodes recoverable information, a perceptual dimension that affects grouping, or any invariant under transformation? Define it operationally: information must be decodable above a stated criterion after a specified transformation. That would expose where the metaphor stops. Bark-band occupancy is not necessarily “hidden,” and phase relationships are not necessarily a separate information channel.

The critical-band section overstates the status of the 24-band division. Bark is a psychoacoustic scale based on critical-band concepts, but exact band counts and boundaries vary by model and implementation. A plugin’s 24 bands do not prove that human hearing consists of 24 bins. Likewise, masking does not make a band a stable “hiding place”; audibility depends on level, masker timing, spectral relation, listener, and playback conditions.

The phase section conflates absolute phase, relative phase, group delay, interchannel phase, and temporal alignment. Listeners’ sensitivity varies greatly among these. PHALAR’s phase equivariance and StreamMark’s complex-domain embedding should be described precisely before inferring perceptual coherence. Better agreement with human judgments also needs the judgment task, baselines, sample size, and effect size.

The semi-fragile analogy is the strongest conceptual bridge, but identity-preserving transformations are normative and context-dependent. A watermark’s benign/malicious partition is designer-defined; it does not establish the identity boundary of music. Make that discrepancy explicit—it could deepen the essay rather than weaken it.

## Clarity and Flow

Terms such as “structural effect,” “musical coherence,” “belong,” “identity layer,” and “survived” remain undefined. The studio test says “listen and measure” but names no measurements. Specify watermark recovery rate, feature similarity, listener identification, or another outcome for each carrier.

The piece also slides between speech editing and music without acknowledging domain differences. Voice-conversion tamper detection may not generalize to re-orchestration, stem recombination, or musical pitch shifting.

## Style and Voice

The voice is imaginative and compact. “Write survivals” is an excellent concluding imperative. Preserve it, but remove mystical phrasing where a technical distinction would be more interesting. “Phase is not empty,” “ordinary listening thinks nothing important is happening,” and “infrastructure” imply hidden profundity before the evidence is established.

## Line-Level Edits

- “It divides sound into 24 Bark-scale critical bands” → “It implements 24 processing bands arranged on a Bark-like psychoacoustic scale.” Verify the manufacturer’s exact claim.
- “an imperceptible signal” → “a watermark reported as imperceptible under the paper’s listening or perceptual metric.” State the test.
- “collapses under voice conversion or speech editing” → Report detection or recovery performance for named attacks; “collapses” is imprecise.
- “A critical band is … a region where the ear groups, masks, and blurs” → “Critical-band models approximate frequency-selective auditory filtering and masking.” Grouping is a broader phenomenon.
- “below the listener’s explicit attention but above the threshold of structural effect” → Define the effect or remove this unfalsifiable threshold.
- “listeners are less directly sensitive to absolute phase” → Distinguish absolute waveform phase from relative, interaural, and component phase, with a psychoacoustic citation.
- “Two parts … fail to feel like they belong together if their temporal and phase relations are wrong.” → “Temporal alignment and some relative-phase relations can affect fusion, localization, and timbre.”
- “machine listening and human coherence judgments may converge” → “the reported representation may predict the study’s coherence judgments better than its stated baselines.”
