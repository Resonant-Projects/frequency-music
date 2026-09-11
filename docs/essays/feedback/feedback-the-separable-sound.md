# Feedback: The Separable Sound

## Overall Impression

The essay brings together native stem generation, deepfake detection, and auditory streaming under the useful idea of “handles before identity.” Its ethical turn is serious and appropriately cautious. The synthesis nevertheless depends on an overbroad definition of separability: editable output channels, detector attribution, and a listener hearing two pitch trajectories are different properties. Addressability by a system does not require perceptual separability, while perceptual segregation does not make components independently editable. The essay should define at least engineering, perceptual, and provenance separability, then argue that modern artifacts can score differently on each axis.

The title and opening aphorism promise epistemic tension, and the final studio test returns to it. The middle could make that tension much sharper by replacing the umbrella category with a multidimensional model: more control handles may coexist with less certainty about lineage, but one does not necessarily cause the other.

## Structure and Argument

The WanSong summary needs independent precision. “Diffusion-only,” “up to five minutes,” multilingual vocals, and dual stems are reported system capabilities that require citation and evaluation context. A model emitting two channels does not guarantee clean, independently manipulable stems, and the essay responsibly admits this later. Move that caveat next to the initial claim.

The deepfake survey is used to support unseen-generator generalization failure, then the essay moves to ethics. That move is plausible, but distinguish authenticity, attribution, and provenance. A detector may classify synthetic versus bona fide without identifying a generator; provenance metadata may document a workflow without proving content integrity; vocal identity raises consent issues independently of classifier accuracy. These should not collapse into “lineage.”

The Vitalic example is intriguing but insufficiently evidenced. Explain the pitch-analysis method, what “two simultaneous melodic lines” means perceptually, and whether listening tests or analytical interpretation support it. One analyst’s hearing of an inharmonic tone is not enough to establish general perceptual separability.

The certification section is the argumentative peak, but its opening—“If a sound has only one obvious address, detection can focus on that address”—does not reflect how forensic detection works. Layering complicates localization and attribution, but detectors already operate on mixtures and may use global artifacts. Reframe the problem around component-level claims and transformations that obscure or distribute traces.

## Clarity and Flow

“Handle,” “address,” “layer,” “stem,” “identity,” and “authentic” need stable meanings. A handle is an editable control boundary; a stem is a delivered signal grouping; a perceptual stream is a listener’s organization; provenance is a record of origin and transformation. Making those distinctions explicit would prevent metaphor from doing technical work.

The phrase “surface continuity to imply identity” should identify whether identity means a recognizable person, a musical style, or sonic continuity. Ethical stakes differ substantially among them.

## Style and Voice

The essay has a confident, measured voice and avoids simplistic anti-generation rhetoric. Preserve “The handle works before the lineage is known” and “The answers may diverge,” but qualify them as possible outcomes rather than historical laws. The lists of hybrid authorship cases are effective and concrete.

Avoid treating “the ear” as a deterministic separator. Auditory organization depends on context, attention, playback, and listener, which the essay briefly acknowledges and should emphasize.

## Line-Level Edits

- “two stems…emitted in a single run” → “the report claims jointly generated vocal and accompaniment outputs; specify whether these are separately decoded channels and report separation quality.”
- “The mix arrives with handles” → “The system outputs predefined component channels intended as editing handles.” A mix alone does not guarantee their utility.
- “synthetic media can become operationally legible before it becomes reliably attributable” → “an artifact may be readily editable while remaining difficult to classify under generator shift.” These are parallel facts, not a demonstrated temporal sequence.
- “A vocal stem says: edit the lyric, singer, language, breath, or tuning here” → “A vocal stem permits some isolated processing, but changing lyric, singer, or language generally requires regeneration, not ordinary stem editing.”
- “The ear can make stems of its own” → “Listeners can organize partials or events into distinct auditory streams.”
- “two addressable partial groups” → specify the synthesis controls and psychoacoustic cues—frequency trajectories, onset synchrony, harmonicity, and level—that promote fusion or segregation.
- “Detection that fails out of distribution” → “Reported cross-generator failures mean forensic classification alone is insufficient”; cite datasets and performance drops.
- “treat provenance as part of the score” → explain the concrete form: signed metadata, source manifests, transformation logs, or program notes.
