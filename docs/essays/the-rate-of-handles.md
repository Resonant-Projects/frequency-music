# The Rate of Handles

Recent extractions keep returning to the same compositional trick: do not try to
control the waveform directly. First make a handle.

Aurchestra does this at the scene level. The acoustic world arrives as one
mixture, but the system turns selected sound classes into separate streams with
per-class gain controls. That is a very practical kind of analysis: a cafe is no
longer one noisy recording, but a small console of independently mixable
causes. Its reported 6 ms streaming chunks matter because the handles are useful
only if they arrive quickly enough to act on.

SPAM does something similar inside the voice. Instead of treating a speech model
representation as an opaque embedding, it maps each frame to phonological
feature activations such as voicing and nasality. Those features are not yet
music, but they are already close to musical material: breath, closure, buzz,
resonance, nasal color, and the little temporal edges where one vocal gesture
turns into another. A singer's timbre could be approached less as a single
continuous identity and more as a trajectory through articulatory handles.

ReGen and ReGenVoice push the idea in the opposite temporal direction. Their
reported 12.5 Hz and 6.25 Hz latent rates are startlingly slow compared with the
audio waveform, yet the claim is that rich semantic and acoustic latents can
still support high-quality generation. If that holds up perceptually, it
suggests that some musically meaningful controls do not need audio-rate
resolution. They live at the rate of syllables, gestures, articulations, and
phrases.

The optimal-transport AVSR extraction gives the mathematical version of the
same move. Audio, vision, and language begin in different spaces; optimal
transport estimates a coupling between them and uses that coupling as a soft
training target. A handle here is not a slider or a phonological label, but a
correspondence: this patch of sound, this visual mouth motion, and this
linguistic embedding are close enough to be moved together.

The connection is useful because it separates two questions that are often
blurred:

1. At what rate must the signal be rendered?
2. At what rate can the musical decision be made?

The first question may demand 48 kHz. The second might demand 6 ms, 12.5 Hz, a
phonological frame, or a transport plan between modalities. Composition happens
in the gap. If a system exposes the right handles, a musician can automate
street noise like orchestration, sculpt a voice by voicing and nasality, or ask a
generator to preserve a phrase-level identity while changing the acoustic skin.

This suggests a design rule for Frequency tools: every analysis should ask what
rate its handles occupy. A pitch tracker, source separator, timbre embedding,
gesture recognizer, or semantic aligner is not merely correct or incorrect. It
also chooses a tempo for intervention. Too fast, and the control becomes
unplayable noise. Too slow, and the music loses its transient teeth. The sweet
spot is where the representation is slow enough for intention and fast enough
for consequence.

_Sources: recent extractions on Aurchestra augmented hearing
(`j975t7frqwkx8wa1p26nshczhh8aefmy`), SPAM phonological activation mapping
(`j97ahj5ea6090z0px78x91de0s8afbxt`), ReGen low-rate audio latents
(`j97ckxzz5n5sgz51mz5z51tw7s8aej68`), and optimal-transport audio-visual speech
recognition (`j97cb636bvc5kfrebnahk2kzxd8afdbj`)._
