---
title: "What the Machine Hears"
publishDate: 2026-04-08
excerpt: "When AI models learn to generate music, do they rediscover acoustic physics or encode cultural conventions? Exploring what concept directions in neural networks reveal about the boundary between universal sound physics and learned musical culture."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "mathematical-music-theory"
  - "tuning-systems"
  - "signal-processing"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Question Behind the Question

MusicRFM does something remarkable: it takes a frozen music generation model (MusicGen) and, without retraining, discovers that the model's internal activations contain *separable concept directions* for individual notes and chords. Inject a "C major" direction into the hidden state and the model starts generating C major material. Target note accuracy jumps from 0.23 to 0.82.

But here's the question no one in the paper quite asks: **what shape do those directions have?**

If you mapped every note's concept direction in activation space, would you get something that looks like a circle of fifths? A chromatic line? A lattice of just-intonation relationships? Or something entirely alien — a geometry shaped not by acoustic physics but by the statistical regularities of the training corpus?

This question matters far beyond one paper. It's the question at the heart of computational musicology: when a machine learns to hear, does it rediscover the physics of sound, or does it learn the habits of a culture?

---

## Three Kinds of Structure

Consider three possible answers:

**1. The machine finds physics.** If MusicGen's concept directions are organized by frequency ratios — fifths near fifths, octaves collapsed, tritones maximally distant — then the model has rediscovered something about acoustic consonance from raw waveform statistics. The training data is Western music, but the geometry would reflect the harmonic series, which is universal.

**2. The machine finds culture.** If the concept directions cluster by common co-occurrence in pop music — C near G and Am because those chords appear together constantly, but not near F♯ despite the acoustic fifth relationship — then the model has learned a cultural grammar, not a physical law. The geometry would look like a corpus frequency map, not a Tonnetz.

**3. The machine finds something we don't have a name for.** This is the most interesting possibility. Maybe the concept directions are organized by something that's *neither* pure acoustics nor pure cultural convention, but some hybrid that emerges from the interaction of physics and practice. A geometry that respects the harmonic series where the training data is dense, but warps toward statistical regularities where it's sparse.

---

## The Precedent in Speech

PhiNet offers a parallel from speech processing. Human forensic experts compare speakers using *phonetic features* — specific acoustic cues at specific articulatory positions. PhiNet builds this into an automated system and finds that phonetic-level comparison produces both better accuracy and better interpretability than holistic embedding comparison.

But here's the subtlety: the phonetic features that matter for speaker identity aren't necessarily the features that matter for linguistic meaning. The way someone produces their /s/ sounds might be forensically distinctive but linguistically irrelevant. The machine (guided by forensic expertise) finds joints in the signal that neither acoustic physics nor linguistic theory would have prioritized.

Similarly, MALEFA's multi-granularity contrastive learning discovers that phoneme-level and utterance-level features are *both* necessary — neither alone suffices. The machine doesn't choose one grain over another; it finds that the signal's structure lives across scales simultaneously. A human phonetician might have predicted this, but the specific *balance* the machine finds (the particular contrastive loss landscape that yields 90% accuracy at 0.007% FAR) is empirically discovered, not theoretically derived.

---

## The Cross-Linguistic Test

CDMA provides the sharpest version of this question. The system detects depression from speech acoustics and discovers that *emotional arousal* (a coarse, energy-level feature) outperforms *emotional valence* (a fine, sentiment-level feature) for diagnostic accuracy. More strikingly, this result transfers cross-linguistically — from Italian to Chinese Mandarin.

What does cross-linguistic transfer mean here? It means the machine found structure that isn't language-specific. Arousal is carried by fundamental frequency range, intensity variation, and speaking rate — features that are closer to physiology than to culture. The machine, by discovering that arousal > valence for depression detection, has arguably found something about the physics of vocal production rather than the conventions of a language.

But "arguably" is doing work. Italian and Mandarin are both human languages produced by human vocal tracts. Cross-linguistic transfer proves the structure isn't language-specific, but it doesn't prove it's cultural-general. It might be species-specific — a feature of human vocal physiology that would mean nothing for whale song or birdsong.

---

## Back to the Notes

Return to MusicRFM's concept directions. MusicGen was trained on Western music. If its note-concept geometry matches the circle of fifths, we might think: the model found physics. But Western music *already encodes* the circle of fifths as an organizing principle. The model could be finding the structure that the training data was built on — learning a convention so deeply baked into the corpus that it *looks* like a natural law.

This is the same problem that haunts tuning theory. Equal temperament sounds "natural" to Western ears because it's the water we swim in. Just intonation sounds "pure" because it matches the harmonic series. But the harmonic series itself is a feature of vibrating strings, columns of air, membranes — not of all possible sound-producing systems. A modal synthesis engine can produce spectra that no physical object would generate, and for those spectra, the concept of "consonance" as we define it may not apply.

So if the machine's note-concept geometry matches the circle of fifths, it could mean:
- Physics → training data → model (the model found the physics through the data)
- Culture → training data → model (the model found the convention encoded in the data)
- Physics → culture → training data → model (indistinguishable from either of the above)

---

## The Experimental Move

Here's what would actually settle it. Train MusicGen (or a similar model) on three different corpora:

1. **Western tonal music** (the current training set)
2. **Gamelan, raga, maqam** — music built on non-12TET systems with different interval hierarchies
3. **Synthetic timbres with inharmonic spectra** — sounds where the "harmonic series" has been deliberately disrupted

Then extract concept directions from each model. If model 1's directions form a circle of fifths, model 2's directions form a pelog/slendro lattice, and model 3's directions form something unprecedented — then you've demonstrated that the machine finds the structure of its corpus, not universal physics.

But if all three models' note-concept geometries converge on something that reflects frequency ratios regardless of the training distribution — then the machine has found something deeper than culture. Something about the mathematics of periodic signals that survives even when you change the musical system.

My prediction: neither extreme. The geometry will partially reflect acoustic physics (octave equivalence, approximate fifth relationships) and partially reflect corpus statistics (common progressions, genre-specific voicings). The ratio will shift depending on the training data. And *that* — the ratio between physics and culture in a learned representation — would be a genuinely new object of study.

---

## The Compositional Implication

For the composer, this question isn't abstract. It determines what a generative model can and can't do for you.

If concept directions are physics, then steering a model toward "the note C" is steering it toward a frequency ratio — a universal, portable, robust control. You could steer toward microtonal intervals, toward just intonation relationships, toward any point in frequency space with confidence.

If concept directions are culture, then steering toward "C" is steering toward "what C does in the training corpus" — a particular set of chord progressions, voice leadings, and timbral associations that are specific to Western pop/classical music. Steer toward C and you get not just 261.63 Hz but the *social life* of that pitch class.

For a composer working within Western tonality, the cultural interpretation might be more useful. The model gives you not just a pitch but a bundle of conventional associations — C as tonic, C as resolution, C as the key your piano teacher started you in. That's compositional material.

For a composer working outside Western tonality — in microtonal systems, in inharmonic timbral spaces, in the cracks between notes — the cultural interpretation is a warning. The model's "concept directions" may not extend to your territory. The joints it found are the joints of its training data, and your music lives in the unmarked space between them.

---

## Connections

- **Essay #99 ("Every Basis Has a Bias")**: the representation determines what's easy and what's impossible. MusicRFM's concept directions are a *learned* basis, and the question is whose bias they carry — physics' or culture's.
- **Essay #101 ("The Grain of the Signal")**: concept directions for notes and chords are different grains of the same harmonic space. But the grain might be culturally determined (12-TET atoms) rather than acoustically natural.
- **Essay #100 ("What the Hierarchy Hides")**: the hierarchy hides its information at the top. Similarly, a learned representation hides its assumptions at the deepest level — in the geometry of the space itself, below any individual concept direction.

---

*What the machine hears depends on what it was raised on. The question is how much of what it learned is its culture and how much is the nature of sound itself. We don't know yet. But we could find out.*
