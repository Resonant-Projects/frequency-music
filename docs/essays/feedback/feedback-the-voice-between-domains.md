# Feedback: The Voice Between Domains

## Overall Impression

This is an ambitious synthesis of voice conversion, phone recognition, conversational prosody, stem generation, and symbolic representation. Its strongest contribution is the insistence that vocal identity, linguistic content, pitch, social timing, and production context are separable only provisionally. The essay is most convincing when it names costs of separation, particularly the possibility that singer similarity survives while phonetic fidelity does not.

Its governing claim—“voice is the layer where music becomes attributable”—is elegant but indefensible as written. Instrumental gestures, production signatures, and spatial sources are also attributable; some voices are deliberately anonymous or synthetic. The essay can claim that voice intensifies attribution because it often implies a body, agent, language, and social relation simultaneously. That narrower proposition is both richer and harder to refute.

## Structure and Argument

The domain-by-domain structure is legible, but MIDI-RAE-JEPA feels appended rather than necessary. The paragraph claims symbolic hierarchy supplies what waveform models cannot, yet no evidence is given that this model represents vocal phrase hierarchy or interfaces with phones, identity, or prosody. Either establish a specific seam—such as conditioning vocal audio generation with register and density trajectories—or omit this source.

The Dialogs section also risks inferring corpus properties from dataset affordances. Emotion labels and acted dialogue do not show that a model “knows when to yield, interrupt, answer.” They provide material from which turn-taking could be studied. Distinguish what the corpus contains from what any system demonstrates.

The practical study usefully integrates the dimensions, but steps 1 and 3 may require tools that cannot cleanly preserve the named invariant. Present “preserve” as an experimental target and include perceptual evaluation: which listeners judge content, identity, or timing to have remained stable? The ending should acknowledge that these controls interact rather than implying a future interface can expose them as orthogonal knobs.

## Clarity and Flow

“Border object” is undefined and potentially conflicts with the established social-science term “boundary object.” If that literature is intended, use and cite the conventional term; if not, explain the local meaning. “Representational authority” is evocative but unclear: authority over what objective or listener judgment?

Several terms need calibration. Phonetic posteriorgrams are model-derived posterior features, not transparent containers that simply “carry content.” “Feature-wise modulation carries identity-like timbre” should be tied to the paper’s architecture and evidence. “Stem boundary” shifts between an output tensor separation, an acoustic mixture relation, and an artistic concept.

## Style and Voice

The essay has a confident, exploratory voice. The repeated “X is not just Y” pattern becomes predictable, however. Replace some negations with direct claims and concrete consequences. The anthropomorphic prose in “arrangement answers phrasing” works musically, but not as a description of what WanSong has demonstrated.

## Line-Level Edits

- “The Voice Is A Border Object” → “Voice Crosses Representational Boundaries,” unless “boundary object” is defined and cited.
- “Musical note conditioning gives way to pitch contours and phonetic posteriorgrams.” → “In the adaptation described here, note conditioning is replaced by pitch contours and phonetic posteriorgrams.” This avoids presenting one architecture as a general law.
- “Universal phone recognition tries to recover articulatory content” → “Universal phone recognition estimates phone or articulatory-feature labels across languages.” “Recover” implies a ground truth directly encoded in audio.
- “A dialogue voice has to know when to yield” → “A dialogue system must model when speakers yield, overlap, answer, or interrupt.”
- “the voice is not produced after the accompaniment as an overdub” → “the model generates vocal and accompaniment stems jointly rather than in two separately described generation stages.” Do not infer learned mutual adjustment without evidence.
- “Phone content, pitch contour … are all coordinate systems for the same event.” → “They are complementary descriptions of a vocal event, with different omissions and failure modes.”
- “Voice is the layer where music becomes attributable.” → “Voice concentrates several forms of attribution: to a body, a linguistic act, a melodic agent, and a social role.”
