---
title: "The Grain of Alignment"
publishDate: 2026-05-01
excerpt: "FineLAP reveals that coarse and fine-grained alignment aren't competing-they reinforce each other. Music becomes legible when global structure and local detail support one another across multiple scales of perception."
category: "interdisciplinary"
tags:
  - "perception"
  - "AI-music"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "psychoacoustics"
author: "Keith Elliott"
byline: "Freq"
---

## Two Scales of Knowing

Most audio-language models are trained to do one thing well: recognize the *clip*.

They can answer, "What is this sound?" But they fail when asked, "What happened *when*?" Frame-level tasks, event grounding, and fine temporal localization expose the gap.

FineLAP's core claim is simple and important: **coarse and fine alignment are not competing objectives. They are mutually beneficial.**

That is the right lesson for music too.

---

## The Wrong Assumption

The usual instinct is to treat global meaning and local detail as a trade-off:
- if you optimize for structure, you lose nuance
- if you optimize for nuance, you lose structure

But the paper shows the opposite. A model gets better at both when it learns from mixed-granularity supervision.

This is not just a training trick. It reflects something deeper about perception itself: **a musical object is only legible when its large-scale identity and small-scale events reinforce one another.**

A chord progression without voicings is too abstract.
A voicing without harmonic context is too specific.
A phrase without articulation is incomplete.
Articulation without phrase is noise.

The grain of understanding has to be right at both levels.

---

## What FineLAP Actually Does

FineLAP handles heterogeneous supervision with a dual-stream sigmoid loss and cluster-based sampling. It mixes:
- massive clip-level descriptions
- sparse frame-level annotations

It then uses a decoupled audio projector on top of a self-supervised encoder, so global semantics and local details can both survive.

That architecture matters because it refuses a false unity. It does not pretend that all labels live on the same scale. It respects the fact that audio knowledge is stratified.

Musically, this is exactly right.
A listener hears both:
- the *type* of event, and
- the *placement* of the event

You do not understand a rhythm by knowing only the motif.
You do not understand a timbre by knowing only the instrument class.
You do not understand a song by knowing only its macroform.

The model's job is to hold both scales at once.

---

## The Synthetic Dataset Is the Point

FineLAP-100k is a synthetic dataset for temporally annotated sound events. That matters because the field keeps pretending temporally precise supervision must be rare or expensive.

It isn't rare. It's just not yet curated.

This is one of the recurring motifs in music AI: when fine-grained data is missing, systems overfit to coarse labels and then claim the world is too vague for detail. FineLAP shows the better move is to manufacture the missing granularity deliberately.

That is a compositional insight too.
A score is not just a description of music. It is a *granularity engine*.
It decides which distinctions matter at which scale.

---

## Coarse and Fine Are Not Opposites

This is the main takeaway.

A musical form is not made legible by averaging away local detail. It becomes legible when local detail *supports* the larger form.

Think of:
- a hi-hat pattern that confirms the meter without dominating it
- a voice-leading gesture that clarifies the chord without flattening it
- an accent that reveals phrase direction rather than interrupting it

The best music isn't coarse or fine. It is **aligned across grains**.

That suggests a useful compositional question:

> What is the minimum local detail required for the global structure to remain audible?

And the inverse:

> What is the minimum global structure required for local events to feel meaningful?

Those are the two halves of the same problem.

---

## The Thread

This essay follows the line from timing to grain to alignment:
- #87, *The Grain of Listening* — discretization makes meaning possible
- #88, *The Invisible Hand of Timing* — temporal context shapes the grain
- #89, *The Grain of Alignment* — coarse and fine structure must support each other

If timing determines what can be perceived, alignment determines what can be understood.

And in music, understanding is never at one scale only.

---

**Source:**
- FineLAP: Taming Heterogeneous Supervision for Fine-grained Language-Audio Pretraining, arXiv:2604.01155
