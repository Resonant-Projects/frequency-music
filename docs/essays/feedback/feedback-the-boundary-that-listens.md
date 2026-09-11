# Feedback: The Boundary That Listens

## Overall Impression

The essay has a clear governing claim: representations actively determine which distinctions a listening system can use. It is strongest when it treats format and encoding as consequential design choices rather than neutral preprocessing. However, “boundary” is stretched across frequency crossovers, watermark threat models, group transformations, score modalities, and encoder information bottlenecks. These are all selection mechanisms, but they are not the same kind of boundary. The essay should build a taxonomy—perceptual partition, robustness boundary, equivariant transformation, modality affordance, and learned bottleneck—then argue what these share.

The prose carefully labels Bark24 promotional evidence, yet gives research claims elsewhere without comparable provenance or limitations. Extraction IDs are absent altogether here, and there is no source block. The technical assertions require direct citations, especially the fairness conclusion and PHALAR architecture/result.

## Structure and Argument

The five-source sequence is easy to follow, and “The common shape” provides an explicit synthesis before the studio experiment. Still, each section follows the same rhetorical move—technical summary, expansive compositional analogy—without testing whether the transfer holds. The most important counterargument is missing: a representation does not create all usable structure; it selects, transforms, or makes tractable structure arising from the signal, task, and listener. “Representation is already composition” is provocative, but only defensible if “composition” is being used broadly enough to risk losing meaning.

The Bark claim that shared critical-band occupancy promotes “one body” and separation creates “contrapuntal independence” overlooks auditory scene-analysis cues such as onset synchrony, harmonicity, spatial location, and timbral continuity. Spectral separation can aid segregation but does not dictate it. Likewise, StreamMark’s detector boundary is engineered for an authentication task, not a general model of musical invariance. The experiment should distinguish source-derived claims from speculative compositional applications and state evaluation criteria for “remain itself.”

The ethical ending—“also ethical”—arrives as assertion. The ASR section gives it a basis, but the essay should draw the chain explicitly: representation choices may produce unequal error rates across groups; such errors affect access or treatment; therefore boundary design carries ethical responsibility. Without consequences and evidence, the triadic ending feels inflated.

## Clarity and Flow

“Critical bands” are not fixed neutral lanes, but neither are Bark bands a direct readout of individual cochlear resolution. State that Bark is a psychoacoustic scale approximating critical-band rate and that filters/crossovers only model it. “Same frequencies” and “the processor…imposing a perceptual map” also overstate the case; it applies a map inspired by average perceptual findings.

The equivariance section needs mathematical precision. Equivariance means a transformation of the input corresponds predictably to a transformation of the representation; it does not simply mean “sensitive to relationships.” Phase shifts may refer to complex spectral phase or time/phase transformations—specify which. In the score section, PDF is a container, not necessarily a modality; the relevant input is likely a rendered score image. Name exactly what MSU-Bench compares.

## Style and Voice

The voice is polished and aphoristic. The repeated one-sentence declarations create momentum, but they sometimes function as conclusions without supporting detail. Lowercase-style headings (“Critical bands are…”) are internally consistent and readable. Keep phrases such as “which musical facts survive,” but replace personification (“boundary that listens,” “representation hears”) with mechanisms often enough that the title remains metaphor rather than explanation.

## Line-Level Edits

- “They create usable structure by deciding where the boundaries are.” Try: “They make some structures usable by partitioning, preserving, or discarding information according to task-specific boundaries.”
- “If two sounds occupy the same critical band, they tend to fuse, mask, or compete.” Add “all else equal” and mention that harmonicity, timing, and location also influence segregation.
- “fails under the transformations we treat as meaning-changing” should be “fails under transformations designated as manipulations in the system’s training and evaluation.” The musical interpretation can then be proposed, not presumed.
- “using spectral pooling and a complex-valued head to improve stem retrieval and coherence judgments” needs the exact baseline and magnitude of improvement.
- “A PDF exposes spatial layout…” Replace with “A rendered notation image exposes…” because PDF files can contain text, vectors, metadata, or images.
- “audio encoder design, more than language model scale, drives both robustness and fairness” should specify the tested model families, fairness metric, groups, and acoustic conditions; otherwise use “was more predictive…within the study’s comparisons.”
- “A musical system hears only the distinctions its boundary conditions preserve.” Consider: “A musical system can act only on distinctions that survive its sensing and representation pipeline.” This preserves the insight without implying that representation alone constitutes hearing.
