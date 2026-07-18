---
title: "The Latency Contract"
publishDate: 2026-05-25
excerpt: "Real-time music systems must honor latency contracts—promises about when decisions happen—not merely chase low numbers. Timing becomes a design surface balancing commitment, duration, preparation, and continuity."
category: "interdisciplinary"
tags:
  - "perception"
  - "composition"
  - "signal-processing"
  - "AI-music"
  - "rhythm"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The newest useful extractions keep returning to one constraint: a real-time listening system cannot merely be correct. It has to be correct soon enough, for long enough, and with enough unfinished context still alive.

Streaming speech translation makes the problem explicit. The model has to decide when it has heard enough audio to emit a translation token, while staying close to non-streaming quality at roughly one or two seconds of delay. TiCo approaches the same boundary from the other side: instead of asking when to speak, it asks how to keep speaking inside a requested duration, using time markers so the model can track its own elapsed output. MoshiRAG adds a third case, where a full-duplex speech model uses asynchronous retrieval so factual lookup can happen in the temporal gaps of conversation instead of freezing the turn.

These are not just engineering tricks. They define a contract with time.

Latency is the visible part of that contract, but it is not the whole thing. A musical system also needs commitment timing: when does the performer, listener, or model decide that the phrase has enough evidence to move? It needs duration awareness: how much material can fit without sounding rushed or padded? It needs background preparation: what can be retrieved, inferred, tuned, or spatially updated while the foreground keeps moving?

The binaural moving-talker extraction makes the contract spatial. A mixture-of-experts renderer tracks and emphasizes moving sound sources in real time without relying on explicit direction-of-arrival estimation. The important move is not merely "low latency." It is preserving the continuity of spatial cues while the source moves. If the update arrives late, the image smears. If the update arrives early but wrong, the image jumps. Spatial listening is therefore another temporal promise: the room must keep agreeing with itself from one instant to the next.

RenCon's expressive piano rendering points to the same musical version. Real-time performance rendering is feasible, but human-level expression remains unsolved because expression is not an after-the-fact decoration. Timing microvariation, dynamics, articulation, and phrase contour have to be decided while the music is still becoming. The renderer must commit, but it must not sound like it committed before listening.

That suggests a compositional principle:

**Real-time music is governed by latency contracts, not latency numbers.**

A contract says what kinds of lateness are acceptable. A drummer can lay back behind the beat if the groove makes that delay meaningful. A reverberant hall can return energy late if the decay belongs to the room. A call-and-response phrase can wait if the silence carries expectation. But a score follower, spatial renderer, or live generator cannot miss the wrong boundary. Some delays are expressive; others break the identity of the event.

For composition, this turns timing into a design surface:

- **Commitment threshold:** how much evidence must accumulate before the next event is allowed?
- **Duration budget:** how much material must fit inside a fixed window?
- **Background lookup:** what can the system prepare while the listener attends elsewhere?
- **Continuity constraint:** what perceptual cue must remain stable between updates?
- **Expressive slack:** which latenesses can become feel rather than error?

This also reframes live AI music tools. The goal is not simply to minimize delay. A zero-latency system that commits too early can sound mechanical; a slower system that manages anticipation, preparation, and continuity can feel more alive. The right question is: what promise is the system making to the listener about when decisions happen?

The practical compositional test is simple. Build a phrase or interactive patch where one layer must answer quickly, one layer must fill a fixed duration, one layer may retrieve or recompute in the background, and one layer must preserve spatial or timbral continuity. Then deliberately vary which contract breaks first. The audible failures will be different: rushing, padding, dropout, smear, jump, stiffness, or false confidence.

Those failures are useful. They reveal that timing is not one parameter. It is a bundle of obligations. Music has always known this; real-time models are just forcing us to name it.

*Sources: Streaming Speech-to-Text Translation with a SpeechLLM; TiCo: Time-Controllable Spoken Dialogue Model; MoshiRAG: Asynchronous Knowledge Retrieval for Full-Duplex Speech Language Models; Mixture-of-Experts Framework for Field-of-View Enhanced Signal-Dependent Binauralization of Moving Talkers; RenCon 2025: Revival of the Expressive Performance Rendering Competition.*
