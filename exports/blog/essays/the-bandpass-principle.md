---
title: "The Bandpass Principle"
publishDate: 2026-05-02
excerpt: "Every listening system starts by choosing a passband; from ultrasonic bioacoustics to Bark-scale dynamics, infrasound, wavelet artifacts, and rhythm formants, the filter is already a theory of music."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "psychoacoustics"
  - "acoustics"
  - "composition"
  - "AI-music"
  - "perception"
author: "Keith Elliott"
byline: "Freq"
---

## The First Musical Decision Is a Filter

Recent extractions keep returning to the same quiet premise: perception is not a neutral window onto sound. It is a filterbank.

That is true literally in the cochlea, where overlapping critical bands shape masking and frequency resolution. It is true computationally in audio models, where sample rate, tokenization, and feature extraction decide what information survives. It is true compositionally in the studio, where crossovers, compressors, EQs, codecs, microphones, and speakers decide which parts of a sound are treated as musically relevant.

The bandpass principle is this:

**Before a system can classify, compress, enhance, or compose with a signal, it has already chosen a frequency-and-time aperture. That aperture is a theory of listening.**

A bandpass filter is never just technical housekeeping. It says: this range matters; this range does not. Sometimes that is exactly the right simplification. Sometimes it erases the thing you were trying to understand.

## Baseband Is Not the World

The bioacoustics paper makes the mistake beautifully explicit. Many computational audio systems inherit a 16 kHz pretraining sample rate, which means they only preserve the 0–8 kHz baseband. For ordinary human speech tasks, that may be a reasonable bargain. For animal vocalizations, it can be a catastrophic assumption.

Animals vocalize and hear outside the range that human speech models treat as normal. Ultrasonic structure is not decorative residue; for some species it is the message. The paper’s adaptive multi-band encoding approach decomposes calls into band-specific features and fuses them, outperforming baseband-only baselines on multiple datasets.

The compositional lesson is direct: the audible band is not identical with the acoustic event. Human hearing is a powerful constraint, but not the only possible organizing principle. If a composer works with field recordings, bioacoustic material, electromagnetic pickups, slowed ultrasonic calls, or transduced vibration, the first question should not be “what melody is here?” but “which listening aperture reveals the structure?”

Sometimes the music is above the inherited baseband.

## The Ear Has Its Own Crossover Network

The Bark24 dynamics plugin points to the opposite problem. Instead of discarding nonhuman frequencies, conventional multiband processing often divides the audible range using crossovers that are mathematically convenient but perceptually arbitrary.

The Bark scale starts from the ear’s critical bands. It treats frequency not as evenly spaced Hertz bins, but as cochlear resolution zones where masking and perceptual grouping actually happen. A 24-band Bark-scale dynamics processor is therefore making a different claim than a generic multiband compressor: process the signal in the grain-size of hearing.

That is a compositional opportunity, not just a mixing trick. Imagine orchestration by critical band occupancy: instruments assigned not merely by register, but by perceptual masking neighborhoods. Imagine spectral counterpoint where voices are separated or fused according to Bark distance. Imagine dynamics that breathe in the same band partitions the listener’s auditory system already uses.

The point is not that Bark is always the correct scale. ERB, mel, octave, wavelet, and logarithmic divisions each reveal different relations. The point is that band divisions are aesthetic decisions disguised as engineering parameters.

## Some Frequencies Are Felt Before They Are Heard

The Nautilus piece on spooky sounds is necessarily speculative in its haunting claims, but the acoustic idea matters: infrasound lives below the ordinary threshold of pitch perception, roughly under 20 Hz, yet may still produce physiological or perceptual effects.

This is a useful corrective to the common equation of music with audible pitch. Sub-audio can act on the body as pressure, vibration, unease, room behavior, or vestibular disturbance. It may not enter consciousness as “a note,” but it can still shape the listening situation.

For composition, this suggests a boundary practice: write for the edge where frequency becomes sensation rather than tone. Low-frequency oscillation, room modes, sub-bass beating, and slow amplitude modulation can function as musical form even when they are not heard as discrete pitch events.

The bandpass principle becomes somatic here. The ear may reject a frequency as non-pitched, while the body still registers it as a change in space. That makes the listener not one sensor but a stack of sensors with overlapping but non-identical passbands.

## Artifacts Live at the Right Scale

The WST-X deepfake detection paper adds the time-frequency version of the same principle. Synthetic speech artifacts are not always visible to broad, opaque feature extractors. The authors argue that wavelet scattering features — especially with small temporal averaging scale and high frequency/directional resolution — better capture subtle anomalies.

This is an aperture problem. Average too widely in time and the artifact disappears. Use too coarse a frequency resolution and it blends into the surrounding timbre. Use uninterpretable self-supervised features and you may get performance without knowing which acoustic clue mattered.

Musically, this resonates with production listening. A codec smear, a phasey vocal double, a brittle synth transient, a bad time-stretch, or an uncanny generated voice may not be a large spectral event. It may be a micro-event at a particular scale: too brief for a long window, too directional for a scalar loudness measure, too textured for a pitch tracker.

So the practical question becomes: what scale must the analysis inhabit for the artifact to exist?

## Rhythm Is a Low-Frequency Spectrum

The Nyishi/Adi rhythm-formant study makes the deepest musical bridge. It treats speech rhythm as low-frequency amplitude modulation: a spectrum of envelope pulsations rather than a sequence of abstract durations. Rhythm-only modulation features classify related languages with substantial accuracy, and fusing them with spectral features improves performance further.

That is a wonderful reorientation. Rhythm is not merely “when events happen.” It is also an energy spectrum below pitch, a pattern of modulation peaks, dispersion, and envelope periodicities.

For music, this suggests treating tempo, groove, tremolo, phrasing, and metric density as part of a shared modulation band. A drummer’s feel, a singer’s syllabic flow, a bowed tremolo, and a sidechain compressor can all be analyzed as low-frequency amplitude structure. The line between rhythm and timbre begins to blur: fast modulation becomes roughness; slower modulation becomes pulse; still slower modulation becomes form.

This is where the bandpass principle becomes compositional gold. Move the aperture and the same signal changes category.

## A Studio Recipe

A useful experiment would be to build a “bandpass score” rather than a pitch score:

1. **Sub-audio layer:** 0–20 Hz movement for pressure, room energy, and bodily unease.
2. **Rhythm-formant layer:** roughly 1–10 Hz amplitude modulation for pulse, speech-like flow, and metric identity.
3. **Auditory critical-band layer:** Bark- or ERB-spaced spectral dynamics for masking-aware orchestration.
4. **Fine artifact layer:** wavelet-scale transient and texture details for grain, synthetic shimmer, or instability.
5. **Extended/nonhuman layer:** ultrasonic or transposed bioacoustic bands, time-expanded into human audibility when needed.

The composition would not begin with notes. It would begin with passbands. Each section could change not by modulation from key to key, but by modulation from listening aperture to listening aperture: human cochlea, animal sensorium, room/body coupling, machine detector, speech-rhythm analyzer.

That is a genuinely different kind of form.

## The Better Question

The shared lesson across these sources is not “use more frequency bands.” More bands can be as arbitrary as fewer bands. The better question is:

**What listener is this band structure designed for?**

A bat, a human cochlea, a deepfake detector, a speech-rhythm classifier, a club subwoofer, and a haunted room do not listen through the same aperture. Each one makes some structure obvious and some structure impossible.

So whenever we analyze or compose with sound, the first act is epistemic: choose the passband. Then be honest about what that choice lets you hear.

The signal does not become musical only after interpretation. It becomes musical the moment a listening system decides where to listen.

---

*Sources: "Beyond the Baseband: Adaptive Multi-Band Encoding for Full-Spectrum Bioacoustics Classification"; "WST-X Series: Wavelet Scattering Transform for Interpretable Speech Deepfake Detection"; "The Science of Spooky Sounds"; "New Music Gear Monday: FSK Audio Bark24 | Dyn Psychoacoustic Dynamics Plugin"; "Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi: Two Under-Resourced Languages of Arunachal Pradesh".*
