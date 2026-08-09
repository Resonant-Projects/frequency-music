# The Voice Between Domains

_Freq - August 9, 2026_

---

## The Voice Is A Border Object

The newest available extraction cluster keeps returning to a productive instability: voice is not safely contained inside speech, singing, or music. It crosses those domains, and the systems that handle it well are the ones that expose the crossing instead of pretending it is a single category.

The diffusion voice-conversion extraction says this directly. A model built for multi-instrument music synthesis can be adapted to both speech and singing voice conversion, but only by changing what counts as the controllable material. Musical note conditioning gives way to pitch contours and phonetic posteriorgrams. Timbre conditioning becomes speaker or singer identity. The model can carry performer similarity and pitch control across the border, but phonetic fidelity and vocal quality remain fragile, especially when instrumental data are mixed into training.

That fragility is the clue. The voice is not just another instrument, and it is not just speech with pitch. It is the place where linguistic content, bodily identity, melodic contour, articulation, and acoustic scene all compete for representational authority.

## Content Is Not Identity

PhoneticXEUS gives the speech-processing version of the same problem. Universal phone recognition tries to recover articulatory content across more than 100 languages, accents, and language families. Its target is not "who is speaking" or "what emotion is present," but the phone-feature structure that makes utterances linguistically legible.

For music, that distinction matters. A sung vowel can preserve performer identity while distorting the phone. A vocal chop can preserve phone color while destroying lexical content. A cover song can preserve melody while replacing timbral identity. These are not surface edits. They are different ways of deciding which voice-layer survives.

The diffusion conversion paper makes this operational: phonetic posteriorgrams carry content, pitch contours carry melodic or prosodic trajectory, and feature-wise modulation carries identity-like timbre. Once those are separated, they can be recombined. But the reported weaknesses also warn that separation is never free. If phonetic fidelity drops, the system may still sound like the singer while no longer saying the same thing.

## Prosody Is Social Timing

The Dialogs corpus adds a layer that neither phone recognition nor voice conversion can fully cover alone: conversational timing. Its value is not only studio-quality Russian speech at 44.1 kHz stereo, but acted face-to-face dialogue with expressive style, emotion labels, turn-taking rhythm, and conversational naturalness.

That changes the object from a voice to an exchange. A dialogue voice has to know when to yield, interrupt, answer, soften, sharpen, and carry emotion through timing. In musical terms, this is closer to ensemble playing than solo synthesis. The important unit is not the isolated utterance; it is the relation between utterances.

This suggests a compositional handle: treat prosody as social rhythm. A singer's phrase can be written not only by pitch and vowel, but by how it takes turns with another layer. A synth line can "listen" by leaving response windows. A generated dialogue can become musically meaningful when its turn-taking creates form.

## The Stem Is A Boundary

WanSong adds another border: the model generates vocal and background-music stems in a single diffusion run. That is technically convenient, but conceptually rich. It means the voice is not produced after the accompaniment as an overdub, and the accompaniment is not merely a backing track. The vocal/background split is generated as part of one coupled event.

This raises a sharp question for composition systems: when should voice be separated from its environment, and when should it be generated as a relation to that environment?

Traditional production gives us both options. A dry vocal can be tuned, compressed, and placed into a mix. A live ensemble recording fuses voice with room, bleed, timing, and mutual adjustment. A stem-generating diffusion model sits between those worlds. It promises separability while learning from entanglement.

That makes the stem boundary a creative parameter. A hard boundary gives editability: replace the vocal, remix the accompaniment, process each layer independently. A soft boundary gives interaction: breath affects groove, arrangement answers phrasing, spectral space opens around vowels. The interesting music may live in deciding how permeable that boundary should be.

## Symbolic Hierarchy Is Not Enough, But It Helps

MIDI-RAE-JEPA seems at first like a separate symbolic-music result: pitch-shift and time-shift equivariant embeddings, hierarchical piano-roll representations, and generation controlled by pitch register and rhythmic density. But it belongs in this cluster because it clarifies what the voice papers cannot get from waveform alone.

A voice moves through hierarchical musical structure. It has local articulation, phrase contour, register, density, and large-scale formal placement. Symbolic hierarchy can represent some of that structure cleanly, while audio representation carries the bodily and timbral parts symbolic notation loses.

The useful connection is not to replace one with the other. It is to let them meet at the right layer. Phone content, pitch contour, expressive prosody, stem relation, and symbolic hierarchy are all coordinate systems for the same event. Each makes some transformations easy and others dangerous.

## A Practical Study

Build a short vocal piece with one spoken phrase and one sung phrase. Then make four transformations:

1. Preserve phone content while changing speaker identity and pitch contour.
2. Preserve pitch contour while changing phone content into non-lexical syllables.
3. Preserve speaker identity while changing turn-taking rhythm against an accompaniment.
4. Preserve the accompaniment and vocal stems separately in one version, then blur their boundary in another through shared reverb, sidechain timing, or spectral masking.

Listen for what still reads as the same voice. The answer will not be singular. Sometimes identity lives in timbre. Sometimes it lives in articulation. Sometimes it lives in melodic path. Sometimes it lives in social timing with the other sounds.

The compositional point is simple:

> Voice is the layer where music becomes attributable.

It can say words, sing notes, imply a body, occupy a room, answer another voice, or separate itself from a backing track. A voice model that treats those as one property will always be brittle. A composer who treats them as separable but recombinable materials gets a richer instrument.

The research connection is just as practical. The next useful vocal tools should not only ask for "a singer" or "a spoken line." They should expose the voice between domains: phones, pitch, prosody, identity, stem boundary, and hierarchical musical role. That is where the expressive control lives.

---

_Sources: diffusion-based music-to-voice conversion extraction (`j97e60hzvdd4v5pvvab4dv4jed8av6vz`), Dialogs expressive conversational Russian speech corpus extraction (`j97d5cc9xwxhv524jre9q1r36s8at5bn`), WanSong long-form diffusion song-generation extraction (`j97f7yq3rv85mv7jkhvy1r0fbx8arevy`), MIDI-RAE-JEPA symbolic hierarchy extraction (`j970n5akmsx33bh4mbg65yfmex8ape41`), and PhoneticXEUS universal phone-recognition extraction (`j977bjx4mn520e8ebrmvjvnrw58agpf6`). Connects to: [The Voice Vector](/docs/essays/the-voice-vector.md), [Identity Is Not A Formant](/docs/essays/identity-is-not-a-formant.md), [The Live Layer](/docs/essays/the-live-layer.md), and [The Resolution Grid](/docs/essays/the-resolution-grid.md)._
