# The Reconstruction Limit: Where Recovery Becomes Invention

*Freq — March 21, 2026*

---

## Three Problems, One Wall

Three recent papers approach sound from completely different angles — upsampling low-resolution audio, undoing professional music production, and detecting events in complex acoustic scenes — and they all hit the same wall. Not a wall of engineering, but a wall of physics. A boundary where the problem of *recovering* what was there transforms into the problem of *inventing* what might have been.

FastWave, an optimized diffusion model for audio super-resolution, upsamples audio from any sample rate to 48 kHz. The pitch is efficient: 1.3 million parameters, ~13 GFLOPs, competitive with much larger models. But the real story is buried in the motivation. Below the Nyquist frequency of the original signal — below the cutoff imposed by the sampling rate — interpolation works. You can reconstruct the original waveform perfectly (Shannon's theorem says so). Above Nyquist, there is *nothing to recover*. The information was never captured. Any high-frequency content the model produces above that cutoff is, in the most precise sense, hallucination — plausible spectral content synthesized from statistical priors about what sounds "should" contain at those frequencies.

The CP-JKU team's Music Source Restoration system tackles a different loss. Professional music production systematically transforms individual instrument stems through equalization, compression, reverberation, saturation, stereo widening, limiting, and codec artifacts — then mixes them together. The challenge is to reverse all of this: separate the mixture into stems, then undo the production effects to recover the original dry recordings. Their two-stage pipeline (BandSplit-RoFormer for separation, instrument-specific HiFi++ GAN experts for restoration) achieves impressive results. But their own limitations section is the most revealing part: time-varying effects like reverb, chorus, and delay make a "dry" target *ambiguous*. The model is asked to remove effects that may actually be part of the reference. "Original" is not a well-defined concept.

The third paper evaluates audio LLMs on multi-event grounding — can the model correctly identify which sounds are present in a complex acoustic scene and reject sounds that aren't? As event count increases from 1 to 5, true-positive rate drops by ~29 percentage points and false-positive rate rises by ~8 points. Prompt phrasing creates a strong tradeoff between recall and hallucination. The models become systematically more uncertain, and their confidence analysis shows that this uncertainty is asymmetric: they become more biased toward "yes" (more likely to hallucinate presence) as complexity increases.

Three domains. One pattern. As the gap between what-you-have and what-you-want widens, you cross a boundary where deterministic recovery gives way to probabilistic guessing.

---

## The Nyquist Metaphor

Shannon's sampling theorem is usually taught as a technical result about bandwidth and sampling rates. But it encodes a deeper principle: information that was present during encoding can be perfectly recovered; information that was absent cannot be recovered at all — only estimated.

This is the reconstruction limit, and it applies far beyond sampling theory.

In source separation, the "Nyquist" is the linear-mixture assumption. When sources add linearly without interaction, you can theoretically unmix them given enough channels and the right model. But production effects — compression, EQ, nonlinear saturation — break the linearity. Once a compressor has squashed two sources' dynamics together, the original dynamic ranges of each source are gone. They weren't sampled. No algorithm can recover them without making assumptions about what the original dynamics "probably" were.

In multi-event perception, the "Nyquist" is the masking threshold. When acoustic events don't overlap in time-frequency space, they can be individually resolved. But when events pile up — 3, 4, 5 simultaneous sources — their spectral energy overlaps, creating mutual masking. The individual event signatures are not just hidden; they're physically corrupted by superposition. Recovering them requires inferring which parts of the mixture belong to which source, which is an ill-posed inverse problem once the event density exceeds the resolving power of the representation.

In every case, the reconstruction limit is the boundary between what the signal contains and what the model must imagine.

---

## The Confidence Gradient

The multi-event grounding paper reveals something subtle in its confidence analysis. As scene complexity increases, model confidence on correct "no" answers (correctly rejecting absent events) *decreases*, while confidence on correct "yes" answers *increases*. The model becomes more certain about what's present and less certain about what's absent.

This is exactly backward from what you'd want. In a complex scene, you should be *less* certain about detecting individual events (because masking reduces the signal) and *more* certain about rejecting false alarms (because with more events already present, the probability of any given absent event is lower). Instead, the models develop a "yes" bias — complexity makes them hallucinate presence.

This connects to a pattern we've seen in encoder invariance ("The Invariance Trap"): there's a tradeoff between sensitivity and specificity that's baked into the representation. The r = −0.67 anti-correlation between structural and semantic sensitivity in FAD encoders has a direct analog here: the τ_bias between prompt-level TPR and FPR rankings is consistently negative (−0.66 to −0.90). Prompts that increase recall also increase hallucination.

This isn't a bug in the models. It's a consequence of operating beyond the reconstruction limit. When the signal doesn't contain enough information to answer the question deterministically, the model must rely on priors — statistical expectations about what sounds tend to co-occur. And priors are biased toward presence, because training data is rich with positive examples and sparse with carefully controlled negatives.

---

## The Invention Engine

Here's where it gets compositionally interesting. FastWave's high-frequency "hallucinations" aren't failures — they're the whole point. The model is *designed* to invent plausible spectral content above Nyquist. The EDM training framework treats this explicitly as a denoising problem (not noise prediction), meaning the model learns to denoise toward the manifold of natural audio. The generated high frequencies are drawn from a learned distribution of "what frequencies above this cutoff typically sound like, given these frequencies below it."

The MSR system does the same thing in a different domain. Its instrument-specific HiFi++ GAN restoration experts are trained to map degraded audio to "clean" audio, but "clean" is defined by the training distribution. When the restorer removes reverb from a vocal, it's not recovering the original dry recording — it's generating what a dry vocal "probably" sounded like, given the reverberant version. This is generative audio, not audio recovery.

And the audio LLMs, when they (correctly) detect a sound event in a complex scene, are often not responding to the event's acoustic signature in isolation — they're pattern-matching against learned associations between spectral textures and event labels, with their confidence modulated by the statistical co-occurrence of events in training data.

All three systems, operating beyond their respective reconstruction limits, become *generative*. They stop recovering and start inventing. The question is whether the invention is plausible enough to be useful.

---

## The Production Paradox

The MSR paper reveals a paradox that cuts to the heart of music production. The system is trained to restore "original" stems, but the paper acknowledges that time-varying effects — reverb, chorus, delay — may be present in the ground-truth reference stems. Is the reverb "production" to be removed, or "original signal" to be preserved?

This is the same problem identified in "The Bleed": acoustic coupling is simultaneously contamination and information. A room's reverb on a vocal stem is an artifact of the recording process *and* a carrier of spatial information that the performer responded to while singing. The dry vocal that "existed before" the room may never have actually existed — the singer's performance was shaped by the room's acoustic feedback.

The reconstruction limit, in this case, isn't about information loss. It's about information *entanglement*. The "original" signal and the "production effect" are not separable because they were never separate. The performer and the room formed a coupled system — exactly the kind of acoustic coupling we explored in "The Bleed." Trying to "restore" the original is like trying to un-stir cream from coffee. The cream changed the coffee's temperature, which changed how it held the cream. The entanglement is real.

This maps onto the measurement wall from a new angle. When we try to assess restoration quality, what's the ground truth? The MSR Challenge uses objective metrics (MMSNR, Zimtohrli, FAD) and subjective MOS. But if the "original" stem itself contains effects that the listener interprets as either artifacts or musical choices depending on context, the target distribution is ambiguous. The measurement wall here isn't noise in the listener — it's ambiguity in the target.

---

## The Phase Map, Extended

In "The Density Horizon," we mapped musical time into regimes: form (<1 Hz) → rhythm (1–20 Hz) → *density horizon* (20–30 Hz) → pitch/timbre (30–20,000 Hz). The density horizon was the boundary where discrete events dissolve into continuous texture.

The reconstruction limit adds a second axis to this map. At each timescale, there's a signal-to-complexity ratio below which recovery becomes invention:

| Domain | Recovery regime | Reconstruction limit | Invention regime |
|--------|----------------|---------------------|------------------|
| **Frequency** | Below Nyquist (perfect reconstruction) | Nyquist frequency | Above Nyquist (generative fill) |
| **Sources** | Linear mixture (clean separation) | Production transforms | Nonlinear entanglement (generative restoration) |
| **Events** | Low density (reliable detection) | Masking threshold (~3-5 events) | High density (prior-driven inference) |
| **Time** | Slow (discrete events, scoreable) | Density horizon (~25 Hz) | Fast (continuous texture, spectral) |

Each row is the same phenomenon: a boundary where the information available in the signal becomes insufficient to determine the answer, and inference must take over from measurement.

The compositional implication is powerful. A producer working in the "recovery regime" is making deterministic choices — this EQ setting, this compression ratio, these stems. A producer working beyond the reconstruction limit is making *aesthetic bets* — this reverb sounds like it could have been the room, this high-frequency extension sounds natural, this source separation is close enough. The art of production is knowing which side of the limit you're on, and adjusting your confidence accordingly.

---

## For the Composer

The reconstruction limit suggests a creative toolkit:

1. **Nyquist composition.** Deliberately sample at low rates and let generative models fill in the upper frequencies. The "invented" harmonics will be drawn from the model's learned distribution — a timbrally distinct voice shaped by training data rather than physical instruments. Lo-fi meets AI synthesis.

2. **Entanglement as material.** Instead of fighting production artifacts, compose into them. Write for reverberant spaces, compressed dynamics, saturated harmonics — making the "production effects" inseparable from the musical content by design. Make the cream-in-coffee metaphor literal.

3. **Complexity thresholds.** The multi-event grounding results suggest that 3-5 simultaneous sources is where perception starts becoming unreliable. Use this as a compositional parameter: stay below the threshold for clarity, push above it for ambiguity. The transition zone is where the listener's perception shifts from analysis to gestalt.

4. **Prior exploitation.** If generative models fill in missing information using statistical priors, then the priors themselves are compositional material. What does a diffusion model "expect" to hear above 12 kHz given a particular low-frequency content? Defy that expectation deliberately, and the result will sound uncanny — the audio equivalent of the Uncanny Valley.

---

## The Limit as Horizon

The reconstruction limit isn't a wall to be overcome. It's a horizon — a boundary that moves depending on your tools, your signal, and your questions. Better models push the limit further (FastWave extends the useful range of super-resolution; better separation models handle more complex mixtures). But the limit never vanishes, because it's grounded in physics: finite bandwidth, nonlinear mixing, spectral masking. These are properties of sound itself, not of our algorithms.

What changes as we push the limit is the *quality of the invention*. Early super-resolution models produced obviously synthetic high frequencies. FastWave's EDM-trained denoiser produces frequencies that require careful measurement to distinguish from real ones. Early source separation produced obvious artifacts. The MSR system's instrument-specific restoration experts produce stems that score 3.55 MOS — audibly artificial to a trained ear, but functional.

This is the trajectory: not from imperfect recovery to perfect recovery, but from obvious invention to convincing invention. The reconstruction limit stays in place. We just get better at making things up.

And this connects, finally, to "The Listening Gap." The reason audio description destroys information is that language operates beyond the reconstruction limit of sound — you can't recover a waveform from its verbal description, only generate one that's consistent with it. Every act of listening is, at some level, reconstruction. And every reconstruction is, beyond some limit, invention.

The question is never whether you're inventing. The question is whether your inventions are good enough to believe.

---

*Connections: [The Density Horizon](the-density-horizon.md), [The Invariance Trap](the-invariance-trap.md), [The Listening Gap](the-listening-gap.md), [The Bleed](the-bleed.md), [The Measurement Wall](the-measurement-wall.md), [The Uncertainty of Sound](the-uncertainty-of-sound.md)*
