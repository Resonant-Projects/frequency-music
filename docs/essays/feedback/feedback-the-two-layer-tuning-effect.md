# Feedback: The Two-Layer Tuning Effect
## Overall Impression

The essay identifies a worthwhile experimental distinction between local acoustic consequences of tuning and larger-scale recognition of harmonic motion. Its proposed controlled traversal is the strongest feature: keeping notes, voicing, dynamics, and form fixed while changing tuning could reveal partially independent listener judgments. The scientific framing, however, is too confident. “Acoustic” and “path” are not cleanly separable layers, and the essay makes broad psychoacoustic, historical, and cognitive claims without citations. It also treats identical MIDI note numbers as an identical harmonic path even when adaptive tuning changes absolute and relative pitches through time. The cached synthesis directories are not sufficient references; readers need the actual papers, tuning definitions, implementation details, and evidence behind each claim.

## Structure and Argument

The sequence from acoustic layer to path layer to adaptive tuning is sensible. The opening should nevertheless state that the two-layer model is an analytical hypothesis, not an established effect. Calling it “the two-layer tuning effect” implies replicated empirical status. “A two-factor hypothesis for tuning perception” would more accurately describe what follows unless cited work directly demonstrates the dissociation.

The acoustic section groups partial alignment, beating, roughness, difference tones, and consonance. These are related but not equivalent; roughness models depend on spectrum, level, register, and timbre, while consonance judgments include familiarity and context. The path section similarly groups Tonnetz adjacency, neo-Riemannian transformations, common tones, voice-leading distance, and line-of-fifths cognition. Choose one operational path representation for the proposed study rather than treating all geometric accounts as mutually validating.

The studio protocol is concrete but lacks controls essential to its inference. Adaptive JI may retune sustained notes, drift pitch centers, or choose among incompatible ratios; meantone and non-octave tunings may change enharmonic spelling and octave equivalence. “Identical MIDI” does not ensure identical scale-degree or voice-leading perception. Specify mapping rules, reference pitch, pitch-bend behavior, adaptive objective, retuning speed, timbre, register, participant population, and whether listeners are trained.

The prediction that continuity “should move more slowly” is vague. State a statistical interaction: tuning condition should have a larger standardized effect on roughness ratings than on path-recognition accuracy or continuity ratings. The ending should acknowledge that evidence for dissociation would be graded, not proof of two independent carriers.

## Clarity and Flow

The essay uses “path identity,” “continuity,” “recognizability,” and “memory” as though they are one outcome. Define a behavioral task: ordering chords, recognizing a transformed progression, tracing a prescribed graph route, or rating continuity. A listener can judge a progression continuous while failing to identify its path, and familiarity with tonal syntax may dominate both.

Several tuning labels require explanation. “Phi-octave,” “Sbeta5,” and “SN” are undefined; “golden-ratio algebraic tunings” says little about pitch generation. The reader also needs to know whether the comparison preserves nominal pitch classes, ratios, melodic contour, or spectral centroid.

## Style and Voice

The voice is assured and musically imaginative, especially around adaptive tuning as a “moving contract.” Yet “the body of the sound,” “tritone fault line,” and “acoustic weather” sometimes cover gaps in mechanism. Keep those phrases as illustration, not evidence. The prose also romanticizes the tritone historically and psychoacoustically; its status varies across tuning, register, voicing, timbre, and musical culture. More qualification would make the central experiment sound stronger, not weaker.

## Line-Level Edits

- “A chord progression has at least two layers of evidence” should become: “For this experiment, it is useful to distinguish local acoustic cues from cues to sequential harmonic organization.”
- “Just-intoned intervals align partials in simple ways” assumes harmonic spectra and suitable fundamentals. Consider: “With harmonic complex tones, low-integer frequency ratios can align more partials, depending on voicing and spectrum.”
- “Equal temperament distributes errors” should identify the reference system and avoid implying a single optimal standard: “12-TET tempers pure intervals to permit uniform transposition among its pitch classes.”
- “They shift combination tones” needs qualification: audible combination tones depend on level, frequency region, and listener, not merely small tuning differences.
- “The tritone is a fault line: historically, psychoacoustically, and geometrically” is unsupported and culturally narrow. Replace with a specific rationale for choosing tritone-rich sonorities in this protocol.
- “The same notes trigger” is false across alternative tuning outputs at the frequency level. Consider: “The same nominal MIDI events and voicings are retained, while rendered frequencies vary by a documented mapping.”
- “short-term intonation memory” needs a citation and operational timescale.
- “the harmony does not arrive at dissonance; it retunes into dissonance” is vivid but should be identified as a compositional possibility, not a property of adaptive JI.
- “optionally a phi-octave algebraic tuning such as Sbeta5 or SN” should be removed unless those systems are defined and the protocol explains how a non-octave mapping preserves the claimed path.
- “If that happens, the piece has revealed two different carriers” overstates the inference. Consider: “Such a dissociation would support the hypothesis that local roughness and sequential continuity draw differently on the manipulated cues.”
