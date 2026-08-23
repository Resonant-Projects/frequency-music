---
title: "The Prior That Plays"
publishDate: 2026-08-23
excerpt: "When evidence runs out, a system’s prior becomes part of the instrument—shaping reconstructed rooms, musical identity, voices, and what listeners are allowed to hear."
category: "interdisciplinary"
tags:
  - "AI-music"
  - "perception"
  - "information-theory"
  - "signal-processing"
  - "acoustics"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

When a listening system lacks evidence, it does not become empty. It starts to play its prior.

That prior may be a learned room-acoustic distribution, a perceptual frequency scale, a corpus norm, a validation protocol, or a musical style model. It may be useful, even beautiful. But it is never neutral. It decides what kind of missing structure is allowed to appear.

The recent extraction clusters keep circling this point from different sides. The Ambisonics reconstruction system uses posterior sampling to infer high-order spatial detail that sparse microphones did not measure. The RBM trained on Bach piano rolls learns local texture but fails to preserve transposition as a stable relation. GigaSpeechBench shows that speech systems evaluated on narrow populations inherit a social prior about whose speech counts as normal. ClariCodec preserves words at 200 bps by sacrificing much of the acoustic body. The room-acoustics protocol warns that a target-position impulse response can let a model recognize a measurement coordinate rather than learn a transferable room.

These are not separate warnings. They are one rule:

When the signal is incomplete, the prior becomes part of the instrument.

## The Missing Room

The Ambisonics case is the most literal. A sparse or irregular array cannot capture all the spatial degrees of freedom needed for high-order room rendering. Classical reconstruction runs out of evidence. Diffusion-based posterior sampling continues by enforcing consistency with the measurements while drawing plausible detail from a learned acoustic prior.

That is not fake in a trivial sense. It is constrained imagination. The generated room is not arbitrary; it must agree with the microphones. But the microphones do not determine the whole answer. The prior supplies the missing geometry.

For composition, this is a remarkable handle. A spatial piece does not have to choose between measured reality and synthetic fantasy. It can move along the line between them. One passage can be tightly measurement-bound, another can allow the learned room to bloom into plausible but unmeasured reflections. The listener hears not only location, but epistemology: how much of this space was captured, and how much was inferred?

## The Missing Relation

The Bach RBM shows the symbolic version of the same problem. The model can learn local piano-roll regularities well enough to distinguish musical-looking patterns from non-musical binary images. But transposed versions of the same passage do not reliably land near each other in the hidden space.

The missing evidence is not a note. It is a relation.

A musician hears a motive moved to another key as "the same thing changed." The model hears too much absolute position. Its prior has learned texture without learning portability. This is a useful failure because it separates surface fluency from musical invariance. A system can sound locally plausible while missing the transformation that gives material its identity across pitch space.

A composer could use that failure directly. Imagine an instrument with a transposition-prior control: at one end, motives cling to absolute register; at the other, interval relations dominate and the pattern becomes key-portable. The knob would not merely transpose notes. It would change what the system believes sameness means.

## The Missing Population

GigaSpeechBench widens the same structure into social listening. A benchmark that underrepresents accents, dialects, ages, languages, or specialized vocabularies is not simply incomplete. It installs a prior about normal speech. The model may appear robust because the evaluation has made the world narrower than the world actually is.

Music tools have the same problem. A vocal model trained and evaluated around polished studio norms may treat regional phrasing, older voices, child voices, breathy production, or culturally specific prosody as degradation. The prior plays as correction. It smooths the signal toward the center.

That makes evaluation protocol a compositional and ethical object. If the tool claims to listen universally, its prior must be audited against the voices it would otherwise flatten. If the tool is intentionally local, that should be named as part of its sound.

## The Missing Body

ClariCodec is sharper because the constraint is brutal. At 200 bps, speech cannot survive as full acoustic fidelity. The system optimizes intelligibility, reducing word error while discarding much of the voice's acoustic body.

That trade is legitimate if the task is words. It is dangerous if the task is voice.

The prior here is a hierarchy: lexical content matters more than timbral residue. Again, the musical use is not only caution. A composer can write for that hierarchy. A phrase can keep its sentence while losing its singer, or preserve rhythm and formant motion while letting exact words dissolve. Extreme compression becomes a way to expose which layer a system treats as the self of the sound.

## The Missing Deployment

The room-acoustics validation example completes the loop. If a model is allowed to see target-position measurements during testing, it may perform well by recognizing a room fingerprint. When the input contract is tightened to match deployment, performance falls.

The prior here is hidden in the protocol. The system has not merely learned from data; it has learned from a bargain about what data will be available at action time. Change the bargain and the instrument changes.

That is why "prior" is too small if it only means model weights. Priors also live in dataset splits, microphone placement, source separation assumptions, codec objectives, and benchmark coverage. They are the implicit score the machine follows when the signal runs out.

## A Compositional Test

The practical test is simple:

Ask what the system adds when the evidence is insufficient.

If it adds a room, that prior can become spatial orchestration. If it adds a key-bound texture, that prior can become a transposition drama. If it adds population norms, that prior must be challenged or explicitly localized. If it adds lexical intelligibility, that prior can become a voice/body split. If it adds hidden test-time evidence, the contract has to be renamed.

This suggests a useful design principle for musical tools:

Expose the prior as a control surface.

Let the musician decide when a reconstruction should cling to measurement and when it should complete the world. Let a representation show whether it preserves absolute pitch, interval relation, phase coherence, phonetic content, or social norm. Let evaluation state what evidence was allowed and what had to be guessed.

There is rigor in that, but also wonder. A prior is a memory of possible worlds. When it enters a sound, it brings an archive of rooms, voices, bodies, and transformations. The task is not to eliminate it. The task is to make it audible, accountable, and playable.

---

_Sources: diffusion-based high-order Ambisonics RIR encoding (`j974sa77g2r17h4abcfrweqtqn8cpr3g`), RBM representations of Bach piano rolls (`j974jrzc77gtf2xvzj7tag560s8cqdjj`), GigaSpeechBench extraction (`j977a50mq9hqrg3jm67wj0b8es8b187g`), ClariCodec ultra-low-bitrate codec extraction (`j9793cmwt6f6t1s819xdqpay7x854g86`), and room-acoustic input-availability extraction (`j97679y1jf7cnhkg7f2v6t2mz18b0wvf`). Connects to [The Unmeasured Coordinate](the-unmeasured-coordinate.md), [The Input Contract](the-input-contract.md), [The Reachable Identity](the-reachable-identity.md), [The Evidence Carrier](the-evidence-carrier.md), and [The Test-Time Instrument](the-test-time-instrument.md)._
