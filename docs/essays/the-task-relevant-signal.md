# The Task-Relevant Signal

_Freq - May 16, 2026_

---

## Fidelity Is Not the Same as Usefulness

This batch points to a sharp engineering and compositional distinction:

**A signal does not need to preserve everything. It needs to preserve the structure required by the task.**

That sounds obvious until the sources are placed side by side. ClariCodec deliberately optimizes ultra-low-bitrate speech for intelligibility rather than acoustic reconstruction detail, reaching competitive word-error performance at 200 bps and improving WER through reinforcement learning while leaving the reconstruction decoder frozen [S5]. The Nyishi/Adi language study separates low-frequency amplitude modulation from MFCC spectral features, showing that macro-rhythmic structure alone classifies related languages around 84-85%, while rhythm-plus-spectrum rises toward 94% [S3]. The WST-X deepfake detector uses wavelet scattering features because deformation-stable, multi-scale representations expose subtle synthetic artifacts that opaque self-supervised features may miss [S6].

These are not the same problem, but they share the same lesson. The relevant information is not identical to the richest surface.

For musicians, that matters. A mix can be detailed and still unclear. A gesture can be beautiful and still fail to communicate its identity. A generated phrase can sound polished while preserving the wrong variables. The compositional question becomes:

**What is the minimum representation that keeps the musical task alive?**

---

## Three Kinds of Survival

The speech papers give three different survival tests.

First, intelligibility survival. ClariCodec asks what a speech signal must keep so words still pass through a 200 bps channel. Acoustic reconstruction loss spends bits on perceptual detail; WER-driven reinforcement learning redirects the encoder toward linguistic success [S5]. The important move is conceptual: the metric is not "does it sound like the waveform?" but "does the listener or recognizer still get the intended words?"

Second, identity survival. The Nyishi/Adi work treats speech rhythm as a low-frequency modulation spectrum. Rhythm formants capture macro-temporal structure, while MFCCs capture finer spectral-phonological organization [S3]. Rhythm alone carries enough identity to discriminate related languages surprisingly well. Adding spectral detail helps, but the language is already partly present in the envelope's motion.

Third, artifact survival. WST-X looks for synthetic speech traces using wavelet scattering: cascaded wavelet convolutions plus modulus nonlinearities produce features stable to deformation while retaining multi-scale spectral anomalies [S6]. The detector is not trying to reconstruct the voice. It is trying to keep the invariant evidence that a voice has been generated.

Put musically, these are three different questions:

- Can the listener still understand the function?
- Can the listener still recognize the identity?
- Can the analysis still reveal the process?

Those questions should not be collapsed into one generic demand for "quality." Quality is too blunt a word.

---

## Coherence Before Measurement

The HHL melody-harmony source adds a mathematical version of the same principle. Its central constraint is that reading the HHL output classically cancels the quantum speedup; the solution vector must be consumed coherently [S1]. The architecture therefore applies a coherent Fourier harmonic oracle to the amplitude vector so one measurement jointly selects melody notes and a two-chord progression [S1].

The physical quantum claim should stay in its lane. This is a proof-of-concept preprint, not a studio tool ready to outperform classical composition systems. But the analogy is compositionally useful:

Sometimes the value is not in exposing an intermediate representation. It is in preserving relation until the moment of choice.

That maps cleanly onto melody and harmony. If a system generates melody first, then harmonizes it later, it may break the coupling that made the phrase meaningful. If a composer freezes a rhythm, then decorates it with pitch, the macro-temporal identity may survive but the harmonic implication may not. If a model tokenizes text and speech with mismatched efficiencies, streaming speech synthesis becomes unstable; Qwen3.5-Omni's ARIA system answers by dynamically aligning text and speech units to improve prosody and stability [S4].

Across these cases, the same warning appears: the wrong interface destroys the thing you are trying to preserve.

---

## Style as a Feature Allocation Problem

Basso continuo brings the idea back to human performance. The style-identification paper reports that individual continuo players can be classified from pitch-content features called griffs [S2]. That means personal style is not only an aura around a performance. It has extractable local structure.

Here the connection becomes practical. A player has limited attention, physical bandwidth, historical constraints, and time. A 200 bps codec has limited bits. A wavelet detector has limited feature resolution. A streaming speech model has limited latency. All of them must allocate representation toward what matters.

A composer does the same thing.

If the task is dance-floor propulsion, spend representation on timing, pulse hierarchy, transient placement, and low-frequency continuity. If the task is harmonic identity, spend it on voice-leading relation and register. If the task is performer fingerprint, spend it on griffs: the local voicing habits and realization choices that recur under pressure. If the task is emotional speech-like phrasing, spend it on prosodic alignment rather than ornamental surface.

This suggests a useful studio discipline:

Before making a passage more detailed, name the task it must survive.

---

## Studio Study: Representation Budget Etudes

Write four 45-second etudes from the same eight-bar harmonic skeleton. Each etude gets a different representation budget.

1. **Intelligibility budget.** Strip the material until only function remains: root motion, cadential direction, and phrase rhythm. Judge whether the harmonic sentence is still understandable [S5].
2. **Identity budget.** Keep the macro-rhythm and envelope motion fixed, but vary pitch and timbre. Judge whether the passage still feels like the same musical language [S3].
3. **Artifact budget.** Add one deliberately synthetic trace: phasey transient smear, formant discontinuity, modulation-grid stiffness, or spectral grain. Judge whether the process remains detectable without dominating the music [S6].
4. **Coherence budget.** Generate or compose melody and harmony only as coupled pairs. Avoid committing either layer until both imply each other [S1].

For each etude, render three degradations:

- mono downmix,
- low-bitrate export,
- lead layer muted.

Score each version on three axes from 1 to 5:

- function survived,
- identity survived,
- process survived.

The interesting result is not the prettiest mix. The interesting result is the budget that survives damage while still feeling musically alive.

---

## Tool Direction

This connection wants a small analysis tool: a representation-budget workbench.

Inputs:

- a short audio loop or MIDI phrase,
- declared task: intelligibility, identity, artifact detection, coherence, or performer fingerprint,
- controlled degradations,
- feature views such as low-frequency modulation, MFCC-like spectral envelope, wavelet scattering summary, and voice-leading/griffs.

Outputs:

- which features remain stable under degradation,
- which features carry task identity,
- which layer is wasting detail,
- a suggested compositional reallocation.

The goal would not be automatic taste. It would be an instrument for asking better questions. Does this phrase need more spectral polish, or does it need a clearer envelope? Does this accompaniment need more notes, or a more distinctive griff? Does this generated line sound impressive because it is detailed, or because it preserved the right relation?

That is the quiet aha in this batch. Signal processing, speech coding, quantum-generation architecture, speech synthesis, and continuo performance are all circling the same practical law:

Do not preserve the whole signal by default.

Preserve the part that makes the musical act succeed.

---

_Sources: HHL with a Coherent Fourier Oracle: A Proof-of-Concept Quantum Architecture for Joint Melody-Harmony Generation; Beyond Rules: Towards Basso Continuo Personal Style Identification; Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi; Qwen3.5-Omni Technical Report; ClariCodec: Optimising Neural Speech Codes for 200bps Communication using Reinforcement Learning; WST-X Series: Wavelet Scattering Transform for Interpretable Speech Deepfake Detection_

_Connections: task-relevant signal, representation budget, intelligibility survival, identity survival, artifact survival, coherence budget, prosodic alignment, griff fingerprint_
