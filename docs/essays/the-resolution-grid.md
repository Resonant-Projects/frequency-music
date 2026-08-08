# The Resolution Grid

_Freq - August 8, 2026_

---

## Not One Signal

A musical signal is measured through grids. The grid may be temporal, as in low-frequency amplitude modulation. It may be perceptual, as in Bark-scale critical bands. It may be relational, as in phase-aware stem embeddings. It may be semantic, as in watermarks that survive codec damage but fail under voice conversion. Each grid decides what counts as a stable feature and what can be blurred away.

The recent extraction set keeps returning to this point from different directions. Rhythm formant analysis treats speech rhythm as a low-frequency modulation spectrum. Bark24-style dynamics treats the audible spectrum through the ear's critical-band partition. StreamMark hides information in complex-domain audio so that it survives benign transformations but breaks when identity changes. PHALAR argues that pitch and phase equivariance help learned representations track musical coherence. MSU-Bench shows that score understanding changes when the same music moves between ABC text and visual notation. Even the ice-phase source says the same thing physically: possible structures are not enough; the realized phase depends on the path and the accessible resolution of the system under pressure.

The compositional clue is simple: before transforming a sound, choose the grid on which its identity must remain legible.

## Rhythm Has A Spectrum

Rhythm formant analysis is useful because it refuses to treat rhythm as only a sequence of symbolic durations. It asks what low-frequency amplitude modulations are present in speech, roughly the region where syllabic pulse, stress grouping, and phrase energy live. In the extraction, rhythm-only features classify related languages at about 84-85% accuracy, and the fusion of modulation features with MFCCs reaches 93.96%.

That is a strong hint for music. A groove can be changed at the event level while its modulation spectrum remains recognizable. The kick pattern may vary, the exact onset grid may loosen, and the instrumentation may change, yet the same slow energy contour can still tell the listener "this is the same rhythmic body." Conversely, quantizing or flattening the modulation envelope can make the written rhythm remain while the living rhythm disappears.

So one resolution grid is macro-temporal: mean modulation frequency, dominant peaks, and dispersion. A composer could write variation by protecting those values while changing surface events.

## The Ear Has Bands

The Bark-scale extraction gives a second grid. The ear does not divide frequency space into equal-width bins, and it does not necessarily care about the crossover points chosen by a standard multiband compressor. Critical bands are perceptual regions where masking and frequency resolution become musically consequential.

This matters because many transformations preserve spectrum in the wrong coordinate system. A mix can be mathematically balanced and perceptually crowded. A timbre can show neat partials and still mask the line that matters. A dense chord can be orchestrated so that every note exists but only some bands carry separable information.

If rhythm formants are a temporal resolution grid, Bark bands are a perceptual spectral grid. They ask which bands should breathe together, which should remain independent, and where masking is allowed to become glue rather than mud.

## Phase Is A Relation

PHALAR adds the third grid: relation. Phase is easy to discard when music is represented as pitch labels, chord symbols, or magnitude spectra. But a phase-aware representation can retain timing, interference, and coherence cues that symbolic representations flatten. The extraction's most compositional claim is that phase information correlates with human judgments of musical coherence better than semantic baselines.

That suggests a different kind of counterpoint. Instead of asking only whether two stems share harmonic material, ask whether their phase-sensitive behavior makes them belong to the same scene. Attacks line up or refuse to. Low frequencies reinforce or hollow each other. Microtiming creates a shared pocket or a productive friction.

This is not a mystical property. It is a resolution grid for relations. Some musical identities are carried less by objects than by alignments between objects.

## Fragile Meaning

StreamMark gives the boundary case. Its watermark can survive compression and noise while falling toward chance recovery after semantic or identity-changing transformations. That is exactly the distinction a composer needs: some changes damage the carrier without damaging the apparent surface; others damage the apparent surface while preserving the carrier.

A hidden melodic trace that survives reverb but vanishes under pitch shifting is not just a technical trick. It is a compositional diagnosis. It says which transformations count as benign under the chosen grid and which cross the identity boundary.

The ice phases make the same idea physical. Water under pressure does not realize every mathematically possible lattice. It lands in nearby accessible phases, and the route changes the result. A musical transformation also lands in the nearest available form under its chosen representation. The grid is part of the path.

## A Practical Protocol

Compose a 45-60 second study with one recognizable motif, one groove, and one timbral scene. Then make three variations:

1. **Modulation-preserving variation**: change the surface rhythm while keeping the low-frequency amplitude modulation profile close to the reference.
2. **Band-preserving variation**: change instrumentation or voicing while preserving Bark-band energy balance and masking relationships.
3. **Phase-preserving variation**: change pitch material or register while preserving attack alignment, microtiming pocket, and phase-sensitive low-frequency relations.

Blind-listen to the reference and the variations. Rate two things separately: surface difference and same-piece identity. The interesting result is not the most similar version. It is the version that changes boldly while still reading as the same musical object. That version reveals the grid that was carrying identity.

## Writing With Grids

This gives a useful rule:

> A transformation is only radical on the grid it damages.

Change notes while preserving modulation, and the rhythm-body may survive. Change spectrum while preserving critical-band separability, and the mix identity may survive. Change timbre while preserving phase relations, and the ensemble scene may survive. But damage the load-bearing grid and even a small edit can feel like a different piece.

For composition, the point is not to obey one grid. The point is to choose. A piece can move from modulation identity to spectral identity to phase identity as its form unfolds. It can let one grid dissolve while another takes over. It can make the listener feel continuity before they can name what survived.

That is where the research becomes musical. The question "what does the system measure?" becomes "what does the piece ask the listener to keep?"

---

_Sources: rhythm formant analysis extraction on low-frequency amplitude modulation in speech; Bark24 extraction on Bark-scale critical bands; StreamMark extraction on semi-fragile audio watermarking; PHALAR extraction on pitch- and phase-equivariant musical audio representations; MSU-Bench extraction on score modality gaps; Quanta ice-phase extraction on accessible metastable structures. Connects to: [The Translation Loss](/docs/essays/the-translation-loss.md), [The Voice Vector](/docs/essays/the-voice-vector.md), [The Codec Ear](/docs/essays/the-codec-ear.md), and [Every Basis Has a Bias](/docs/essays/every-basis-has-a-bias.md)._
