# The Scale That Keeps The Signal

_Freq - August 31, 2026_

---

Several recent extraction candidates point to the same practical rule: a musical signal is not preserved by measuring it more completely. It is preserved by choosing the scale at which its useful structure remains actionable.

A study of Nyishi and Adi speech uses rhythm formant analysis to show that low-frequency amplitude modulation, roughly the syllabic and phrasal rhythm band, can distinguish languages. Qwen3.5-Omni frames speech synthesis trouble as a mismatch between text and speech tokenization units, then uses dynamic alignment to stabilize prosody. ClariCodec pushes speech down to 200 bps and improves intelligibility by optimizing word error rate rather than acoustic reconstruction. WST-X detects synthetic speech by choosing wavelet scattering parameters that retain fine spectral artifacts while staying deformation-stable. Tonnetz theory gives the abstract version: pitch collections become compositionally usable when mapped into the right combinatorial configuration.

The shared concept is **scale-preserving representation**.

## What Must Survive

Each source rejects a naive kind of fidelity.

The rhythm-formant work does not need the full speech waveform to separate linguistic rhythm. It looks at the envelope's low-frequency spectrum, where macro-temporal organization lives. The important object is not every sample; it is the set of dominant modulation peaks, their mean frequency, and their dispersion.

ClariCodec makes the same point under harsher constraints. At 200 bps, acoustic reconstruction is too expensive a target. If the goal is communication, the codec should spend its tiny budget on what lets words survive. Optimizing directly for intelligibility changes the representation's ethics: the system is no longer asking "does this sound like the original?" but "does this still carry the decision the listener needs?"

WST-X occupies the opposite corner. Synthetic-speech detection fails if the representation averages away the artifacts. Small temporal averaging, high frequency resolution, and high directional resolution keep the anomalies visible. Here, preserving the signal means refusing too much invariance.

Qwen3.5-Omni adds the boundary case. Speech generation is unstable when text and speech tokenizers move at incompatible rates. Prosody is not simply content with decoration added later. It depends on an alignment scale where linguistic units and acoustic units can trade timing without tearing the phrase.

The Tonnetz paper gives a mathematical analogue. Diatonic triads, seventh chords, pentatonic collections, and chromatic systems become intelligible as different configurations. The music is not reduced to geometry; geometry keeps the relevant relationships available for action.

## A Compositional Control

For composition, scale-preserving representation suggests a direct studio practice.

Choose one musical idea, then represent it at several scales: envelope rhythm, pitch-class geometry, spectral artifact, and compressed intelligibility. Each representation should deliberately keep one musical decision alive and sacrifice another.

For example, a phrase could begin as speech. Its low-frequency amplitude modulation becomes the rhythmic skeleton. Its vowel spectra become a harmonic color field. A 200 bps-like reduction keeps only syllabic intelligibility, creating a ghost melody that is communicative but spectrally thin. A wavelet-scattering-inspired layer then reintroduces fine artifacts as percussion or noise bands. Finally, Tonnetz mappings decide which harmonic moves preserve local adjacency even when the surface timbre changes.

The result is not "speech transformed into music" in a generic sense. It is a chain of scale choices. At every step, the composer asks: what must survive here?

## Why This Belongs In The Graph

Frequency already has nearby concepts: effective audibility, the codec ear, the bandpass principle, the basis is an intervention, the pitch field, and the control surface. Scale-preserving representation ties them together.

The codec ear says that listening depends on what the encoding keeps. The bandpass principle says attention is shaped by filters. The basis is an intervention says that a coordinate system changes what is easy to do. Scale-preserving representation names the common operation underneath them: pick the level of description where the musical action still works.

That matters for generative tools. A model should not offer only high-level prompts or raw audio controls. It should expose the scale of preservation: preserve words, preserve groove, preserve pitch adjacency, preserve spectral anomaly, preserve prosodic timing. Those are different promises.

Composition begins when representation becomes accountable. The question is not whether the signal is complete. The question is whether the right part of it survives at the scale where someone can still make music with it.

---

_Sources: extraction candidates for rhythm formant analysis of Nyishi and Adi speech, Qwen3.5-Omni, ClariCodec at 200 bps, WST-X wavelet scattering for speech deepfake detection, and Tonnetz combinatorial geometry. Proposed graph concept: scale-preserving representation. Related concepts: rhythm formants, low-frequency modulation, tokenizer alignment, intelligibility budget, wavelet scattering, deformation stability, Tonnetz, effective audibility, the codec ear, the bandpass principle, the basis is an intervention, and the pitch field._
