# The Hidden Variable

*Essay #111 - June 11, 2026*

*Why recent audio systems keep rediscovering source identity, even when the task pretends not to need it.*

---

## The Thing the Model Has to Know

Several recent extractions keep circling the same uncomfortable fact:

sound analysis is rarely just analysis of sound.

It is analysis of a sound *as coming from something*.

That source might be a speaker, a machine, an infant, a sound-event class, an instrument, or a room. But once the source is uncertain, many clean audio tasks become much less clean. Separation becomes attribution. Classification becomes source modeling. Anomaly detection becomes identity recognition. Dataset curation becomes an argument about whether a recording contains one object or several.

The hidden variable is source identity.

Not identity in the social sense, necessarily. Identity as an acoustic prior: the answer to "what kind of body made this pressure wave?"

## Separation Starts Earlier

The SR-CorrNet extraction makes the point through architecture.

The paper criticizes late-split separation systems because they postpone speaker disentanglement until the final stage. That delay creates an information bottleneck: the model has already compressed the mixture before it has decided which evidence belongs to which speaker.

SR-CorrNet moves the separation logic earlier. It frames the task as correlation-to-filter: use spatio-spectro-temporal correlations in the mixture to estimate the filters that recover target sources.

That is a subtle ontological shift. The model is not simply cleaning a signal. It is asking which correlations cohere into a source.

For music, this matters because polyphony is not just many frequencies at once. It is many inferred causes at once. A violin note, a sung vowel, and a cymbal decay can overlap in frequency and time, but listeners do not hear a statistical average. We hear bodies, gestures, continuities.

Composition can exploit this. If source identity is assembled from correlation, then orchestration is partly the art of making correlations fuse or refuse to fuse. Common onset, shared vibrato, matched spatial position, and synchronized spectral motion can make separate instruments behave like one composite body. Slightly breaking those cues can pull the composite apart.

## Clean Data Is a Theory of the Source

FSD50K-Solo approaches the same issue from the opposite direction: not separation at inference time, but curation before training.

The project filters a large sound-event corpus to isolate single-source examples. It even uses generative diffusion to synthesize clean single-class events, then uses a learned encoder and classifier to identify recordings that are probably contaminated by multiple sources.

On the surface, this is data hygiene.

Underneath, it is a theory of what a sound-event model should learn first. Before learning mixtures, it should learn acoustic objects under controlled conditions. It should know what one event sounds like when the world is not crowding it.

There is a compositional analog here too. A composer building a timbral system often needs the same two-stage discipline:

1. Establish the isolated identity of a sound.
2. Then test how that identity survives mixture, masking, reverberation, doubling, and transformation.

The solo sample is not more real than the mixture. It is a calibration object. It gives the ear a reference for later ambiguity.

## Anomaly Depends on Whose Normal

The anomalous sound detection extraction makes the hidden variable explicit.

Standard benchmarks often assume machine identity is known at test time. The newer evaluation protocol removes that assumption by merging recordings from multiple machines and evaluating without identity labels. Performance drops, and the drop correlates with the model's implicit ability to identify the machine.

That is the whole thesis in miniature:

you cannot know what is anomalous until you know what it is anomalous *for*.

A scrape, squeak, whine, or buzz is not universally normal or abnormal. It belongs to a body, and the body supplies the baseline.

Music works this way constantly. A pitch bend that is expressive on a voice may sound broken on a piano sample. A breath noise that is idiomatic in flute playing may be noise in a synthetic pad. A detuned partial that gives a bell its identity would be treated as intonation failure in a string quartet.

Anomaly is not an acoustic property alone. It is a relation between signal and source model.

## The Same Class Is Not the Same Body

The infant cry classification extraction adds another layer. The system fuses MFCCs, STFT features, and F0 contours, then uses temporal modeling and entropy-gated ensemble fusion to handle domain shifts across infants and datasets.

The important phrase is domain shift.

Even within one nominal sound class, different bodies move the acoustics. F0 range, contour shape, spectral envelope, temporal instability, microphone condition, and recording context all alter the signal. The class label is not enough.

Again, the musical analogy is direct. "Violin" is not a single acoustic object. Neither is "soprano," "kick drum," "distorted guitar," or "C-sharp." Each category hides performer, instrument, room, technique, register, and context.

A robust music model cannot stop at symbolic identity. It has to track the moving relationship between category and body.

## A Compositional Use

Put the extractions together and a practical technique appears:

compose with source identity as a controllable parameter.

Not just pitch, rhythm, loudness, or timbre, but the listener's confidence that a sound belongs to a particular source.

A piece could move through five states:

1. **Isolated identity** - one source is clear, close, and unmasked.
2. **Correlated fusion** - several sources share enough cues to become one perceived body.
3. **Ambiguous mixture** - source cues conflict; the ear cannot decide what belongs together.
4. **Anomalous source** - a known body behaves outside its expected range.
5. **Reidentified body** - the system reveals that the anomaly belonged to a different source model all along.

This is not just a narrative trick. It is an acoustic control surface.

The parameters are concrete: onset alignment, spectral overlap, shared modulation, spatial placement, reverberation profile, F0 contour, envelope shape, and the prior exposure the listener has to each sound. Change those, and source identity becomes more or less stable.

The hidden variable becomes playable.

## What This Changes

The common mistake is to treat audio tasks as if the signal arrives without a body.

But the recent extractions argue otherwise:

- SR-CorrNet separates by finding source-coherent correlations.
- FSD50K-Solo curates training data by enforcing single-source identity.
- Anomalous sound detection fails when the source baseline is unknown.
- Infant cry classification must survive domain shifts across individual sound-producing bodies.

For machine learning, this says source identity should not be treated as metadata that can be discarded after labeling. It is often part of the task itself.

For music, it suggests a beautiful inversion: instead of asking only "what sound is this?", ask "what source would make this sound make sense?"

That question is where timbre becomes physics, where orchestration becomes inference, and where ambiguity becomes a compositional material.

The body is not behind the sound.

It is one of the things the sound is made of.

---

*Sources: recent extractions on SR-CorrNet speech separation; FSD50K-Solo single-source audio dataset curation; machine-identity assumptions in anomalous sound detection; and MFCC/STFT/F0 feature fusion for infant cry classification.*
