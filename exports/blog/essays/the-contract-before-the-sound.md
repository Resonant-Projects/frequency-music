---
title: "The Contract Before the Sound"
publishDate: 2026-07-29
excerpt: "Across AI control, audio restoration, and speech enhancement, usable sound begins with a contract: constraints that protect continuity, safety, and expressive possibility."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "signal-processing"
  - "perception"
  - "composition"
  - "information-theory"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Three Ways to Refuse the Raw Signal

Three recent extractions point to the same design principle from very different angles.

LLM4OSC refuses to let a language model send Open Sound Control messages directly. The model can propose intent, but a deterministic layer checks the device profile, clamps the values, validates the address, and only then transmits. PHADQ refuses to treat dequantized audio as a bag of independent time-frequency bins. It adds a phase-aware regularizer so sinusoidal components keep temporal continuity. LL-SDR refuses to denoise speech in a single continuous latent soup. It uses a variance-ordered residual vector quantizer to separate speech and noise distributions as discrete token structure.

These are not the same technical move. One is about live-control safety, one about audio restoration, one about low-latency speech enhancement. But they share a deeper pattern:

**Before the sound becomes usable, the system imposes a contract.**

The contract may be a device profile, a phase-continuity constraint, or a token ordering. In each case, the important work happens before audible output. The system decides what counts as a valid transformation, and only then lets the signal move.

## The Validator Is Musical

It is tempting to treat validation as engineering housekeeping: addresses must exist, OSC type tags must match, values must stay in range. That is true, but incomplete.

In live electronic music, a wrong OSC send is not just a software bug. It is an unwanted musical event. A hallucinated address might fail silently, but a valid wrong address can open a filter, mute a bus, jump a delay time, or move a spatial source at exactly the wrong moment. The validator is therefore part of the instrument. It defines the playable surface.

This matters compositionally because every instrument is a set of permitted gestures. A piano lets the hand make discrete hammer strikes across a tuned lattice. A violin lets the hand make continuous pitch and pressure changes along a string. A Max/MSP patch controlled by OSC lets the performer move through a parameter manifold, but only if the mapping is stable enough to trust.

LLM4OSC makes that trust explicit. Natural language can remain ambiguous at the front of the system, but the output layer must become contractual. "Make it brighter" can be interpreted; `/filter/cutoff 18000` must be correct.

The contract is where poetic language becomes physical control.

## Continuity as a Promise

PHADQ reveals the same principle inside the signal itself. Quantization damages audio by forcing a continuous waveform through a coarse numerical grid. A naive reconstruction can reduce error locally while breaking the thing the ear cares about globally: the continuity of sinusoidal components through time.

This is the crucial point. The audible object is not a set of isolated samples. It is a set of trajectories.

A violin partial, a sung vowel harmonic, a feedback tone, a flute's upper component: each is heard as a line moving through time. If reconstruction treats frames independently, it can preserve energy while damaging identity. The partial no longer behaves like a coherent vibrating body. It flickers.

PHADQ's phase-aware regularizer acts like a promise: if a component was moving through time, the reconstruction should respect its path. The constraint is not merely mathematical cleanliness. It is perceptual ethics. Do not restore the spectrum by destroying the motion that made it sound alive.

Here the contract is not between a language model and an OSC device. It is between adjacent moments of the signal.

## Tokens as Separation

LL-SDR adds a third version. Speech enhancement is usually framed as removing noise from speech, but the extraction's strongest idea is more structural: discretization can help separate speech and noise distributions before enhancement happens.

A residual vector quantizer is a strange musical object. It turns continuous sound into a sequence of codebook choices. That sounds like loss, and sometimes it is. But the LL-SDR result suggests that the right loss can be useful: if the token stages are ordered by variance, they can become a scaffold where different kinds of acoustic information occupy different representational roles.

This resembles orchestration more than filtering. Instead of asking one continuous representation to carry everything, the system assigns layers. Some codebooks capture dominant speech structure; others absorb residual detail or noise. Enhancement becomes less like scrubbing a waveform and more like deciding which parts of the ensemble belong to the foreground.

For composers, this is fertile territory. A tokenized audio representation is not only an engineering shortcut; it is a possible compositional interface. If speech and noise separate into different token strata, then "denoising" becomes one point in a larger space of transformations:

- keep the speech semantics but alter the noise bed
- preserve the noise rhythm but replace the voice identity
- exaggerate the residual codebooks until the room becomes the instrument
- freeze one token layer while improvising through another

The contract here is categorical. The system decides which differences matter enough to become separate handles.

## The Old Dream of Direct Control

There is an old fantasy in electronic music: direct control from intention to sound. Think the sound, speak the sound, gesture the sound, and the machine realizes it.

The recent extractions argue for almost the opposite. Directness is dangerous unless something in the middle has been made explicit. A language model should not send show-critical OSC without a profile. A dequantizer should not optimize samples without phase continuity. A denoiser should not collapse speech and noise into one undifferentiated latent space if discretization can give them cleaner boundaries.

The middle layer is not friction. It is the instrument's grammar.

This connects to a larger pattern across the project: the most powerful audio systems are not the ones with the fewest constraints, but the ones with constraints placed at the right level. Equal temperament constrains pitch into a reusable group structure. A DAW constrains sound into tracks, clips, busses, and automation lanes. A score constrains performance into symbolic events that musicians can reinterpret. Constraints are not the enemy of expression. They are how expression becomes repeatable enough to compose with.

## Composing the Contract

The practical question is: what contracts should composers design?

For live AI control, the contract might be a performance profile: these parameters exist, these ranges are safe, these transitions are allowed, these commands require confirmation, these gestures may happen continuously, these may only happen at phrase boundaries.

For restoration and degradation, the contract might be a perceptual continuity rule: preserve phase trajectories, preserve transient timing, preserve formant motion, preserve the attack-decay arrow even while changing bit depth or bandwidth.

For tokenized audio, the contract might be a layer map: this codebook carries pitch contour, this one carries noise texture, this one carries room signature, this one carries consonant edges. Once the map is musically legible, token editing becomes composition rather than blind latent surgery.

The deeper lesson is simple: do not only compose sounds. Compose the rules by which sounds are allowed to change.

## The Playable Middle

The contract before the sound is where reliability and expressivity stop being opposites.

Too little contract, and the system is vivid but unsafe: the model hallucinates, the reconstruction flickers, the denoiser smears categories together. Too much contract, and the system is safe but dead: every gesture snaps to a narrow menu of approved outcomes.

The playable middle is where the contract is strong enough to protect the musical object and flexible enough to let it breathe.

That middle layer is becoming one of the central compositional materials of machine listening and machine generation. Not the waveform, not the prompt, not the final render, but the structured promise between them.

---

_Sources: recent extractions on LLM4OSC, PHADQ phase-aware audio dequantization, and LL-SDR discrete-token speech enhancement. Connections: "The Pre-Audible Control Surface," "The Control Layer," "The Tuning Codec," "The Geometry Inside Sound."_
