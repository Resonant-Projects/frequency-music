# The Control Surface Inside the Representation

The recent extraction set keeps returning to the same compositional question: when does a representation stop being a description and start becoming an instrument?

MIDI-RAE-JEPA makes the question explicit. Its symbolic-music embeddings are trained so that pitch shifts and time shifts are not arbitrary distortions. They are measurable movements in the learned space. The extraction's most useful claim is not just that the model reconstructs piano-roll material well, or that conditioned generation follows register and rhythmic density. It is that distance in the representation changes with the magnitude of a musical transformation. The embedding is not a neutral container for notes. It is a control surface whose axes have been pressured to mean something musical.

The vocoder OOD detector approaches the same idea from the opposite side. There, a sound's origin is tested by asking which class-specific decoder can reconstruct its WavLM-derived features. If no decoder can reconstruct the feature satisfactorily, the sample is treated as outside the known vocoder set. The representation becomes a set of gates. It asks: which origin makes this sound reconstructable?

That is remarkably close to a compositional operation. A composer can treat synthesis classes, microphone chains, performance techniques, rooms, or tunings as decoders. A sound belongs to a region of the piece when that region can explain it. If no region explains it, the sound becomes an outsider. The piece does not need to announce this verbally. It can stage the test by letting materials pass through filters, resonators, transpositions, or spatial scenes that either preserve them or expose them as foreign.

The moving-speaker tracking extraction adds time. Its Bayesian tracker uses temporal feedback from the enhanced speech signal to improve direction estimates in a causal frame-by-frame loop. Here the representation is not merely judged after the fact. It steers the next moment. The enhanced signal helps update the spatial hypothesis, and that updated hypothesis helps guide enhancement. Representation and action become coupled.

For music, this suggests a strong design pattern: let the current rendering of a sound update the coordinates that will render the next one. A spatialized phrase could leave behind a direction estimate. A filtered chord could update the resonant profile that shapes the next chord. A rhythmic layer could alter the time-warp grid that future material must inhabit. The representation is no longer an analysis panel beside the music. It is inside the feedback path.

The scale-evolution extraction seems, at first, to live in a different world. It argues that global scale structure may be driven more by melodic constraints, especially a preference for 1-3 semitone steps, than by harmonic constraints. But this also belongs to the same thread. A scale is a representation of pitch space. If local melodic motion is what makes that representation usable across cultures and performances, then the representation's real control surface is not the grand consonant ratio but the reachable next step.

That reframes the old melody-versus-harmony question. Harmony describes stable vertical relations. Melody describes traversable paths. If the recent extraction is right, the path may be the stronger global organizer because it is the part of the representation that a singer or player can continuously act on. A scale is not only a set of available pitches. It is a set of nearby moves.

The common structure across these sources is:

1. A representation is trained, built, or inherited.
2. A transformation tests what it preserves.
3. The preserved feature becomes actionable.
4. Action changes the next state of the system.

That gives us a useful concept: **representational affordance**. A representation affords a musical action when its coordinates make some transformation easier, more stable, or more meaningful than others. Pitch/time-equivariant embeddings afford transposition and temporal displacement. Class-specific reconstruction affords origin testing. Autoregressive spatial tracking affords motion-following enhancement. Step-size-biased scales afford singable melodic continuation.

This matters because many composition tools expose representations as static displays: a spectrogram, a piano roll, a chromagram, a latent embedding, a graph. The deeper opportunity is to ask what each representation lets the composer *do*. Can it transpose without losing identity? Can it reveal when a source no longer belongs? Can it steer the next frame? Can it make the next pitch feel reachable?

A practical sketch:

- Build a phrase generator whose latent controls are not arbitrary knobs but tested transformations: pitch shift, time shift, density, register, source class, spatial direction.
- After each generated phrase, pass the result through a reconstruction or tracking test.
- Let the test update the next phrase's available moves.
- Treat failure to reconstruct, track, or preserve identity as a formal event.

The musical payoff is a piece where structure is not imposed from outside the material. Structure emerges from what the representation can keep stable while the sound moves.

_Sources: MIDI-RAE-JEPA extraction on pitch/time-equivariant symbolic-music embeddings; reconstruction-based vocoder OOD extraction using WavLM features and class-specific decoders; autoregressive Bayesian tracking extraction for moving-speaker spatial enhancement; melodic-scale-evolution extraction emphasizing 1-3 semitone step constraints over harmonic explanations._
