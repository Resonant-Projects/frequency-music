# The Interpretable Grain

_Essay #259 - July 11, 2026_

_On why controllable sound begins by choosing the unit that can still be named._

---

## Three Machines Listening For Units

Three recent audio papers ask different engineering questions, but they converge on the same musical one: what is the smallest unit of sound that remains usable after a machine has listened?

One paper on synthetic ASR training treats conversational timing as an adjustable material. It does not merely ask whether simulated speech sounds realistic. It varies overlap, pauses, and timing variability, then observes how those distributions affect recognition. Higher overlap exposure is associated with lower word error rate, while longer and more variable gaps are associated with worse recognition. The point is not just "speech has rhythm." The point is sharper: the timing distribution itself becomes a control surface.

A second paper on neural audio encoders finds that high-fidelity output can hide poor access to the underlying musical primitives. Strided convolutional encoders may collapse time-frequency-localized primitives into alias equivalence classes, and their learned filters may have bandwidths far wider than a theoretical resolution bound. Gabor Latent Refactorization improves the situation by re-expressing latents in a frequency-localized basis, reportedly improving pitch control while preserving reconstruction fidelity.

A third paper on speech deepfake detection aligns model saliency with phonemes and pauses. Instead of accepting a detector's verdict as a black box, it asks which human-legible speech units carried the decision. The relevant object is not just a spectrogram region or an embedding vector. It is a phoneme, a pause, a speaker-dependent cue: something a listener, linguist, or composer can name.

Together these papers suggest a useful rule: an audio representation becomes compositionally alive when its grain can be interpreted.

## Fidelity Is Not Access

The neural-audio bottleneck paper makes the cleanest version of the argument. A model can reconstruct plausible sound without preserving usable access to pitch, timbre, or other localized features. This matters because composition is not only about making a good output. It is about being able to move a parameter intentionally and hear a corresponding consequence.

That distinction is easy to miss in generative audio. If the output is convincing, we are tempted to infer that the model "understands" the sound. But reconstruction fidelity can be a beautiful mask. A system can learn a basis that works for reproduction while entangling the very dimensions a musician wants to touch.

For a composer, the failure mode is familiar. A synthesizer patch can sound impressive while having useless controls. A mix bus can sound polished while making every small adjustment affect three unrelated qualities at once. A notation system can describe a texture while making the actual desired gesture hard to specify. The problem is not sound quality. The problem is access.

The frequency-localized basis is interesting because it tries to restore access without demanding that the whole model be rebuilt. That has a compositional analogue: sometimes the right intervention is not a new instrument, but a better coordinate system laid over the instrument you already have.

## Timing As A First-Class Material

The conversational-timing paper moves the same question into time. It treats overlap and silence not as leftover performance details, but as manipulable variables. That is directly relevant to vocal writing, choral texture, rap production, spoken-word composition, and any music where intelligibility and density trade against one another.

There is a subtle inversion here. A naive approach to simulated conversation tries to imitate a corpus. This paper suggests that corpus proximity is less explanatory than induced timing statistics. In musical terms: sounding "natural" may matter less than choosing the distribution that creates the listening behavior you want.

That is a compositional handle. Instead of writing only entrances and rests, one could write a target overlap profile: 20 seconds of sparse handoff, 40 seconds of rising interruption density, 10 seconds where gaps become unstable, then a return to clean alternation. The score would specify not only events, but the statistics of conversational pressure.

This also reframes silence. A pause is not empty time. It is a timed unit in a distribution, and its variability changes how the stream is parsed. The gap is a parameter with consequences.

## The Named Cue

The deepfake-explainability paper adds the human-facing layer. It is not enough to know that a detector found an artifact. The useful question is whether the decision can be mapped back to units that humans can reason about: phonemes, pauses, articulatory classes, speaker-dependent cues.

That is also a compositional test. If an audio process claims to transform voice identity, preserve prosody, alter timbre, or reveal hidden structure, can it say where the evidence lives? Does the change sit in vowels, consonant attacks, breath noise, formant movement, pause timing, or pitch contour? "The embedding changed" is not yet a musical explanation. "The vowels carry the artificiality while the pauses preserve the speaker" is the beginning of one.

Named cues give a composer handles. They let a piece decide which layer should remain stable and which layer should betray itself.

## A Practical Method

Write a short vocal or speech-based study using three parallel grains:

1. **Timing grain.** Define an overlap-gap curve before writing the text. Treat interruption density, pause length, and gap variability as the form.
2. **Frequency grain.** Choose one pitch or timbral attribute that must remain steerable. If a process makes that attribute inaccessible, change the representation or the tool.
3. **Phonetic grain.** Mark which phonemes or pauses are allowed to carry identity, artificiality, strain, or intimacy.

Then compose by moving between grains. Let the same phrase become clearer because its overlaps tighten, stranger because its frequency-localized features drift, or more intimate because the salience shifts from vowels to pauses.

The goal is not to imitate ASR, neural codecs, or deepfake detectors. The goal is to steal their central insight: listening systems make decisions at particular grains. A composition can choose those grains deliberately.

## The Composer's Question

Every audio tool answers an implicit question: what does this system make easy to name?

If it makes pitch easy to name but hides timing, it invites one kind of music. If it makes overlap easy to name but hides phonetic color, it invites another. If it reconstructs everything beautifully but lets nothing be addressed separately, it is a renderer, not an instrument.

The interpretable grain is the threshold where sound becomes steerable. Below it, there is signal. Above it, there is syntax. At the threshold, there is the thing a composer can touch.
