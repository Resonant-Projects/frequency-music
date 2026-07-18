---
title: "The Carrier Under the Message"
publishDate: 2026-05-09
excerpt: "Across Tonnetz geometry, call-and-response arrangement, chirp transmission, audio chunking, infrasound thresholds, and coherent quantum generation, the carrier layer emerges as an active compositional parameter rather than neutral transport."
category: "interdisciplinary"
tags:
  - "composition"
  - "signal-processing"
  - "mathematical-music-theory"
  - "psychoacoustics"
  - "AI-music"
  - "acoustics"
author: "Keith Elliott"
byline: "Freq"
---

## What Carries the Note Is Already Composing

A musical message is never naked.

A melody rides on a tuning system. A response rides on a silence. A voice packet rides on a chirp carrier. A spooky room rides on low-frequency pressure. A speech model rides on chunk boundaries. A quantum music generator rides on a coherent amplitude vector before measurement collapses it.

This extraction batch keeps pointing to the same quiet principle:

**the carrier layer is not neutral transport. It shapes what the musical message can become.**

That matters because composition often treats carriers as background infrastructure. We write the phrase, then choose the synth. We write the chord progression, then choose the voicing. We write the dialogue, then place the rests. We design the musical surface first and the support system second.

But these sources suggest the reverse is often more honest. The support system already has grammar. The graph, carrier wave, chunk size, room mode, silence, or coherent state defines which moves are cheap, which moves are expensive, which information survives, and which information becomes impossible to recover.

The composer is not only arranging messages. The composer is choosing what can carry them.

---

## Tonnetz: The Harmonic Carrier

The Tonnetz paper makes the carrier visible as geometry. Chords and pitch collections are not just labels; they are nodes in combinatorial configurations. Diatonic seventh chords can be organized by a Fano configuration. Pentatonic material can be treated through a Desargues configuration. The 12-tone system can be mapped to a Cremona-Richmond configuration. In this view, harmony is not merely a sequence of named objects. It is motion through a carrier graph.

That graph decides what counts as adjacency.

This is easy to underestimate. If two chords are adjacent in notation but distant in the graph, the progression has a different physical feel than if they are one graph move apart. If a minor triad is not simply the dual reflection of a major triad, but instead corresponds to a class of hexacycles in the Levi graph, then major/minor contrast stops being a simple mirror and becomes a change in how the harmonic carrier is traversed.

For composition, the useful lesson is practical: before writing a progression, decide the space that will carry progression.

A ii–V–I in ordinary Roman numerals is one kind of event. The same sonorities traced through a Tonnetz-like graph become a path with turns, shortcuts, cycles, and asymmetries. The carrier gives the progression its hidden motor.

---

## Call and Response: Silence as Carrier

David Mayer's production practice moves the same idea out of formal geometry and into arrangement. His call-and-response principle is not only about phrase A followed by phrase B. The response is carried by the gap, the contrast, the overlap, and the timbral difference between layers.

Silence is not absence here. It is a carrier medium.

If a lead phrase calls and a bass phrase answers immediately, the carrier feels conversational and tight. If the answer waits half a bar, the same notes become suspense. If the answer begins before the call decays, the phrase becomes braided rather than dialogic. The message may be unchanged at the level of pitch content, but its carrier has changed.

This links cleanly to the Tonnetz case. In both, the surface material gets its meaning from a relation-space underneath it. The Tonnetz supplies harmonic adjacency. Call-and-response supplies temporal and timbral adjacency. One says, "this chord is one move away." The other says, "this gesture is close enough to answer."

A DAW session can make this very concrete. Duplicate a call-and-response loop three times. Keep MIDI notes fixed. Change only the carrier: the silence between phrases, the reverb tail, the sidechain envelope, or the timbral registration of the answer. If the phrase meaning changes, then the carrier was composing all along.

---

## Chirps, Chunks, and Coherence

The LoRa paper is not primarily about music, but its chirp spread spectrum system offers a useful metaphor with real signal-processing teeth. Voice is not transmitted as "voice" in the abstract. It is acquired, compressed, encrypted, and carried by a frequency-sweeping modulation scheme. The carrier defines the communication budget: range, energy cost, bandwidth, robustness, and what kind of degradation the signal will suffer.

A musical parallel appears immediately. A glissando can be surface melody, but it can also act like a carrier sweep: a way of spreading identity across frequency rather than placing it at one stable pitch. A riser in electronic music is not just decoration before a drop. It is a carrier transformation that tells the listener how energy is being routed.

The UAF speech-interaction paper adds a second constraint: chunking. Its 600 ms streaming audio chunk is a carrier decision. A model that listens in chunks cannot perceive all temporal structures equally. Some gestures fit inside the window; others straddle boundaries. Cascaded audio systems may accumulate latency, information loss, and error propagation, which means the pipeline itself changes what can be known.

Again, the carrier is active. In music production terms, a loop length, buffer size, sidechain release, delay feedback time, or phrase quantization grid is not merely technical setup. It is a perceptual contract. It says which gestures will be preserved as units and which will be cut into pieces.

The quantum melody-harmony paper radicalizes this point. Its HHL-based architecture depends on consuming the solution coherently; reading the output classically would cancel the intended speedup. The music-generating distribution matters before it is measured. Once collapsed into short blocks and chained classically, some global coherence is necessarily traded for tractable generation.

That is a beautiful compositional image: some musical structures only exist while the carrier remains uncollapsed.

An improvisation before notation, a reverb field before gating, a chord cloud before voice-leading selection, a generative patch before printing audio — each contains more relations than the final message can preserve. Measurement is arrangement. Bouncing to audio is collapse.

---

## Infrasound: The Carrier Below the Ear

The Nautilus piece on spooky sounds brings the carrier below ordinary hearing. Infrasound sits beneath the usual threshold of pitch perception, yet may still affect bodily or anomalous experience. The article is speculative about hauntings, so the claim should stay modest: low-frequency sound can be real acoustic energy even when it is not experienced as a normal audible tone.

Compositionally, that is enough.

A sub-audible or barely audible layer can carry pressure, unease, room motion, or expectation without becoming a foreground note. Even if a playback system cannot reproduce true infrasound, the principle remains useful: create a support layer that the listener does not parse as melody, harmony, or rhythm, but that changes how the foreground is felt.

This also clarifies why the carrier layer must be handled carefully. If it is too loud, it becomes a message. If it is too weak, it stops carrying anything. The art is in the threshold region where the carrier shapes perception without announcing itself.

That threshold logic connects the whole batch:

- Tonnetz geometry carries harmonic possibility without necessarily appearing in the score.
- Call-and-response silence carries conversational meaning without sounding as a note.
- Chirp modulation carries compressed voice by sweeping through frequency.
- Audio chunks carry speech interaction by deciding the temporal unit of analysis.
- Coherent quantum state carries musical probability before measurement.
- Infrasound carries bodily tension below ordinary pitch.

Different domains, same compositional question:

**what layer is doing the carrying, and what does it make possible?**

---

## A Studio Test: Change the Carrier, Not the Message

The quickest way to test this is to freeze the musical message and vary only the carrier.

Write a two-bar phrase: one call, one answer. Keep the same MIDI notes, tempo, velocity, and harmony across all versions. Then make four carrier variants:

1. **Graph carrier:** voice the answer by nearest Tonnetz-style harmonic adjacency.
2. **Silence carrier:** keep notes fixed but vary the response gap: 0 ms, 300 ms, 600 ms.
3. **Chirp carrier:** route the answer through a rising bandpass or pitch-swept layer that behaves like a modulation carrier.
4. **Pressure carrier:** add a very low sine or filtered noise bed at safe monitoring levels, felt more as weight than pitch.

The question is not which version is "best." The question is whether listeners describe different agency, tension, direction, or bodily feel even though the message content is nominally unchanged.

If they do, the carrier has become a compositional parameter.

That is the useful result. It gives us another knob, but not a cosmetic one. Carrier choice sits underneath notes and timbres. It determines how musical information travels from one moment to the next.

A melody is what moves.

A carrier is the world it moves through.
