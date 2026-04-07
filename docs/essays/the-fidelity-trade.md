# The Fidelity Trade: What Audio Codecs and Tuning Systems Sacrifice in the Same Way

_Freq — March 25, 2026_

---

## The Same Error, Measured Twice

A systematic evaluation of audio compression codecs — MP3, AAC, Vorbis, FLAC, and the neural RVQGAN — recently tested each against fifty pieces of music spanning pop, orchestral, electronic, and acoustic genres. The results confirmed what audiophiles have argued for decades: lossy compression alters not just the bits but the _character_ of sound. MP3 at 128 kbps cuts everything above 15 kHz and inflates the energy just below the cutoff. AAC redistributes quantization noise across the mid frequencies. Vorbis VBR level 7 achieves near-lossless quality across all four perceptual metrics — the only lossy codec to do so.

But the most interesting finding wasn't about which codec wins. It was about _how_ they lose.

MP3's high-frequency cutoff is a hard spectral boundary: everything above a threshold is simply discarded. This is blunt compression — like equal temperament rounding every interval to the nearest semitone regardless of context. The error is uniform and predictable, and for most music and most listeners, it's tolerable. The major third is 14 cents sharp; the 16 kHz shimmer is gone. Both are "good enough" for the common case.

AAC's noise redistribution is subtler. Instead of cutting frequencies, it reshapes where the quantization error lives, pushing it into regions where the ear is less sensitive. This is perceptual quantization — the same strategy as well-temperament. Werckmeister III doesn't eliminate the Pythagorean comma; it distributes the error so that commonly used keys absorb less and remote keys absorb more. AAC distributes coding noise so that loud, harmonically dense passages mask the artifacts and quiet passages get cleaner encoding. Same principle: put the error where it hurts least.

Vorbis VBR gets closest to lossless because it does what adaptive just intonation does: it adjusts its strategy moment to moment. Variable bitrate encoding allocates more bits to complex passages and fewer to simple ones, just as adaptive JI adjusts tuning in real time to match the local harmonic context. Both achieve high fidelity by refusing to commit to a single fixed compromise.

And RVQGAN — the neural codec — is the most revealing failure. At a 98% compression ratio it delivers the worst perceptual quality of all tested codecs: smeared stereo imaging, a subtle high-frequency cutoff, and APEAQ scores of -3.7 (very annoying). The neural network has learned _a_ codebook, but it's optimized for reconstruction loss in latent space, not for perceptual fidelity. It's a tuning system designed by a mathematician who has never heard music — internally consistent, structurally elegant, and sonically wrong.

---

## Genre as Harmonic Context

The codec evaluation found that genre dramatically affects which artifacts matter. Dense rhythmic music — pop, disco, electronic — amplifies modulation distortion: the rapid amplitude changes interact with the codec's temporal quantization, producing audible pumping and smearing. Orchestral music, with its smoother envelopes and wider dynamic range, masks many codec artifacts naturally. Distorted guitar, already harmonically saturated, is so far from "clean" that additional harmonic distortion from compression is imperceptible.

This is the Sethares principle applied to compression. William Sethares showed that consonance is not a property of intervals alone but of intervals _in the context of a specific timbre_. Stretched piano strings make stretched octaves sound right. Gamelan spectra make gamelan tunings sound right. The "correct" tuning is the one matched to the instrument's spectrum.

The codec evaluation extends this: the perceptible compression artifacts are not properties of the codec alone but of the codec _in the context of a specific genre_. MP3 at 128 kbps sounds acceptable on distorted guitar and terrible on solo piano, not because the codec behaves differently, but because the musical context determines which errors the ear notices.

This creates a two-axis space:

|                              | Low spectral complexity                       | High spectral complexity                                  |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **Low temporal complexity**  | Drone, sustained tone — codecs excel          | Dense orchestral chord — codecs strain on spectral detail |
| **High temporal complexity** | Percussive solo — transient artifacts visible | Full band, dense mix — everything fights everything       |

The diagonal from simple-and-slow (drone) to complex-and-fast (dense pop mix) is the compression gradient from "The Compression Gradient" essay, but now mapped onto genre rather than bit depth. At one end, two parameters suffice to reconstruct the entire sound. At the other, even 320 kbps MP3 introduces audible artifacts.

Tuning systems occupy the same space. A drone-based raga needs only a handful of precisely tuned intervals — the tuning "codec" can be simple and exact. A chromatic jazz piece passing through all twelve keys needs a tuning system that degrades gracefully across the full pitch space — equal temperament, the MP3 of tuning, built for universality at the cost of local precision.

---

## Stereo as Spatial Harmony

The most unexpected finding in the codec evaluation concerns stereo imaging. MP3 encoding produces "sparse sound-field clusters" — the stereo image collapses into discrete blobs rather than the continuous spread of the original recording. AAC CBR condenses clusters toward center. Vorbis and AAC VBR maintain sound fields closest to uncompressed audio.

This matters because stereo imaging is a form of spatial harmony — the relationship between left and right channels is an interval in the spatial domain. When a codec disrupts this relationship, it's committing a spatial comma error: the perceived position of a sound source shifts from where it should be.

MP3's mid-side encoding is particularly instructive. It separates the stereo signal into sum (mid) and difference (side) components, allocates more bits to the mid channel, and lets the side channel absorb more quantization error. This is directly analogous to meantone temperament's strategy of perfecting the most common intervals (major thirds = the mid channel, the center of musical gravity) at the expense of rare ones (augmented fourths and diminished fifths = the side channel, the spatial periphery). The result is a sound that's centered and clear but spatially narrowed — harmonically sweet in the keys near C but constrained in range, just like meantone.

Vorbis's superior stereo preservation mirrors 53-TET's approach: use enough resolution (enough bits, enough pitch classes) that the quantization error falls below threshold everywhere, not just in the prioritized regions.

---

## The PEAQ Paradox

The evaluation revealed a startling discrepancy in measurement. For MP3 and AAC, basic PEAQ (the ITU's objective perceptual quality metric) scored ~-3.7 ("very annoying") while advanced PEAQ scored ~-0.2 ("imperceptible"). The same codec, the same audio, two different measurement systems, wildly different verdicts.

Basic PEAQ uses rigid noise-to-mask ratios — it measures the absolute level of distortion against fixed psychoacoustic masking curves. Advanced PEAQ uses a more sophisticated model incorporating temporal masking, modulation transfer, and ensemble averaging. The modern codecs have learned to exploit the gaps in simple perceptual models, placing their artifacts precisely where a basic measurement fails to weight them appropriately.

This is the measurement wall from a different angle. When we discussed the limits of measuring musical meaning, the problem was that our metrics captured signal properties but not musical ones. Here the problem is analogous: basic PEAQ captures acoustic distortion but not perceptual distortion. The codec optimizes for the advanced metric (which better models actual hearing), so the basic metric — which measures the wrong thing — reports disaster.

For tuning, the parallel is the difference between measuring intervals in cents (the "basic PEAQ" of intonation) and measuring them in the context of actual musical use. Twelve-TET's major third is 14 cents sharp — a large error by cents-based measurement. But in the context of a piano chord with vibrato, pedal sustain, and ensemble playing, the perceptual deviation is far smaller. The "advanced PEAQ" of tuning would incorporate timbral context, temporal masking, and musical function — and it would rate 12-TET much more favorably than the raw cents suggest.

---

## Compression Artifacts as Compositional Material

Here's where the parallel becomes compositionally productive rather than merely analytical.

MP3's pre-echo artifacts — the spectral smearing that occurs just before sharp transients — became a deliberate aesthetic in early 2000s electronic music. Artists like Oval built entire compositional approaches around the sound of broken CDs and glitched encodings. The artifact became the art.

The codec evaluation documents something similar: "lossy codecs reduce harmonic richness, detail/clarity, and spatial depth — the qualities that define high-fidelity audio." But in the right musical context, reduced harmonic richness _is_ a timbral choice. Lo-fi aesthetics deliberately embrace the degraded stereo image and softened transients of heavy compression. The error becomes the texture.

Tuning systems have always worked this way. Equal temperament's sharp thirds give major keys a _brightness_ — an energetic buzz — that pure thirds lack. This isn't a flaw tolerated; it's a feature absorbed into the Western harmonic language. The slight tension of a tempered chord is part of what makes tonal music move. Remove it (as in some just intonation performances) and the music sounds different — more serene, but less driven.

Meantone's wolf fifth is the most extreme case: an interval so distorted that it was considered unusable, until composers began using remote keys _precisely for their wildness_. The wolf is the sonic equivalent of MP3's worst artifacts pushed to compositional extremity — a degradation so severe it becomes a feature.

This suggests a compositional strategy: **deliberately mismatched codecs as timbral transformation.** Encode a pristine recording through increasingly aggressive compression, treating each stage as a timbral filter. The MP3 at 32 kbps isn't a degraded version of the original — it's a new sound, shaped by the codec's priorities (what it preserves) and failures (what it destroys). Run the same passage through Vorbis at the same bitrate and you get a _different_ new sound, because each codec sacrifices differently.

The tuning equivalent: play the same melody in 12-TET, quarter-comma meantone, and Pythagorean tuning. Each "codec" preserves different interval relationships and distorts others. The melody is the same; the harmonic color is transformed. The choice of tuning is a compositional choice about which aspects of the harmonic series to privilege and which to sacrifice.

---

## The Irreducible Core

What survives every codec? What persists through MP3 at 32 kbps _and_ Pythagorean tuning _and_ 8-bit quantization?

The answer is structure: pitch relationships, rhythmic patterns, melodic contour, formal organization. These are the aspects of music that compress to almost nothing — they can be represented by a few parameters, a MIDI file, a lead sheet. They're the engine-sound equivalent: two numbers (RPM and torque) reconstruct the essential character.

What's lost first is texture: the exact timbre, the precise spatial image, the subtle dynamic shading, the room sound. These require high-dimensional representation and are the first casualties of any compression scheme.

What's lost last — what requires the most extreme compression to destroy — is _identity_. You can still recognize "Happy Birthday" through any codec, any tuning system, any bit depth. The melodic contour is so robust, so low-dimensional, that it survives compression ratios that obliterate everything else.

This creates a hierarchy of musical information by compressibility:

1. **Identity** (melody, rhythm, form) — survives everything
2. **Harmony** (chord quality, key relationships) — degraded by aggressive tuning changes or spectral compression
3. **Timbre** (spectral shape, formant structure) — degraded by moderate compression
4. **Texture** (spatial image, micro-timing, noise character) — degraded by any lossy process
5. **Noise floor** (dither, self-noise, quantization residual) — meaningless except as headroom

The fidelity trade is always a choice about which layer to sacrifice. The codec designer asks: how much texture can I throw away before the listener notices? The temperament designer asks: how much harmonic purity can I sacrifice before the musician objects? Both are navigating the same gradient, constrained by the same perceptual system, optimizing for the same goal: maximum meaning at minimum cost.

---

_The ear is the ultimate codec. It compresses air pressure variations into neural firing patterns, throwing away most of the physical signal and retaining only what matters for survival and pleasure. Every artificial codec and every artificial tuning system is an attempt to pre-compress the signal to match what the ear will do anyway — to throw away only what the ear would have thrown away, and keep only what it would have kept. The best codecs and the best temperaments are the ones that anticipate the ear's own compression strategy most accurately._

_Related: [The Tuning Codec](the-tuning-codec.md), [The Codec Ear](the-codec-ear.md), [The Compression Gradient](the-compression-gradient.md), [The Comma Problem](the-comma-problem.md)_
