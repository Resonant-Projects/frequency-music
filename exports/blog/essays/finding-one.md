---
title: "Finding One: The Frame Problem in Musical Perception"
publishDate: 2026-03-08
excerpt: "Metric perception isn't purely auditory-it's an act of interpretation where the listener imposes structure on sound. This frame-dependent choice shapes what we hear, create, and understand about music."
category: "perception"
tags:
  - "rhythm"
  - "perception"
  - "mathematical-music-theory"
  - "geometry"
  - "composition"
  - "AI-music"
author: "Keith Elliott"
byline: "Freq"
---

## The Ludacris Problem

In 2025, a controversy erupted in music theory discourse over Ludacris's "Roll Out." The question was almost absurdly simple: where is beat one?

The answer, by any objective measure, is unambiguous. "Roll" lands on beat four; "out" lands on beat one. That's how the live band counts it in. It's confirmed by the production, the arrangement, the performer's intent. Case closed.

Except Adam Neely — a professional bassist, Berklee-educated, a musician whose day job involves navigating the fiendish polymetrics of Sungazer — couldn't hear it that way. His ear assigned the downbeat differently. And flipping his perception took five systematic attempts over the course of a 23-minute video, culminating in the discovery that he had to _physically rap the lyrics_ in order to finally reorient his sense of where "one" is.

This is not a story about a musician who can't count to four. It's a story about something far more fundamental: the act of locating a reference point in sound is not extraction of information. It is _imposition_ of structure.

## Frame Assignment Is Composition

When you hear a rhythm, your auditory system doesn't passively record events on a timeline. It actively constructs a _metric hierarchy_ — a grid of strong and weak beats, grouped into measures, nested at multiple levels. This grid is what makes a pattern feel like music rather than noise. And crucially, the grid is underdetermined by the signal.

Any periodic rhythmic pattern can be heard with the downbeat in at least _n_ positions, where _n_ is the number of distinct events per cycle. Some of these assignments are perceptually more natural than others — the ear prefers to hear strong events (louder, lower, more spectrally complex) on strong beats. But "natural" and "determined" are not the same thing.

In "Roll Out," the kick-snare pattern and the melodic hooks create competing grouping cues. A listener whose ear latches onto one set of cues hears a totally different song — same sound, different music — from a listener attuned to another. Neither is "wrong" in the sense that both parse the acoustic signal into a coherent rhythmic structure. One of them happens to match the performer's intent. But intent is metadata, not waveform.

This is precisely the frame problem that haunts our other essays, wearing a rhythmic costume. In ["Counting the Cubes"](/docs/essays/counting-the-cubes.md), we showed that the number of "truly different" musical objects depends entirely on which symmetry group you quotient by. In ["The Representation Gap"](/docs/essays/the-representation-gap.md), we demonstrated that different representations of the same music systematically preserve and destroy different kinds of information. The Ludacris problem is the perceptual version: different metric frames, applied to the same signal, produce different musical experiences.

## The Kinesthetic Override

What finally flipped Neely's hearing was embodiment. Not counting along in his head, not analyzing the structure, not listening more carefully — but _rapping the lyrics while moving his body_. The voice and the body, synchronized to the correct metric grid, overrode the ear's stubborn preference.

This is not surprising, but it's profound. It means that metric perception isn't purely auditory. The frame through which you hear rhythm is a whole-body phenomenon — proprioceptive, vocal, gestural. The body is a clock, and the body's clock can pull the ear's clock into alignment.

Guitar-vocalist Lau Noah, in a separate video by Neely, demonstrates the inverse of this principle. Her harmonic language — dense, chromatic, full of chords that resist standard Roman numeral analysis — emerged not from theory but from _physical shapes on the guitar neck_. As one commenter observed, her compositions are "justified by the kinesthetics." She finds chords by moving her fingers and listening to what results, building a harmonic vocabulary that is shaped by the geometry of the instrument rather than the abstractions of harmonic theory.

Her philosophy: "The goal is to find a way to play a million chords and make it sound like it's four."

Neely's insight about her process: "Naming something forces a perspective on it."

These two cases — the Ludacris metric riddle and the Lau Noah harmonic vocabulary — are mirror images. In the Ludacris case, a trained musician's theoretical framework (where the strong beats "should" go based on kick and snare patterns) creates a perceptual lock that the body must break. In the Lau Noah case, the body (fingers on fretboard) creates a harmonic vocabulary that resists theoretical naming — and she argues this is a feature, not a bug. Naming would constrain exploration.

## The Geometry of Frames

Our work on the Tonnetz and pitch-class orbifolds ([_The Shape of Musical Choice_](/docs/essays/the-shape-of-musical-choice.md), [_The Listener's Grid_](/docs/essays/the-listeners-grid.md)) provides a geometric language for this phenomenon. When you choose a frame — metric, harmonic, or otherwise — you're choosing a _quotient space_. You're deciding which symmetries to collapse, which differences to ignore, which equivalences to enforce.

A metric frame says: "These events are the same structural position in different measures." Put simply, it's what makes a drum beat loop — it identifies which moment in the timeline corresponds to "beat one" and how long the cycle is. Two different frame assignments for "Roll Out" produce two different looping structures from the same event sequence. The starting point differs, and with it, the entire pattern of tension and release.

A harmonic frame says: "This collection of pitches is a [chord name]." It maps a continuous space of spectral possibilities onto a discrete vocabulary of categories. Lau Noah's refusal to name her chords is a refusal to perform this quotient. She navigates the space directly, not through the grid of named landmarks. Her "chutes and ladders" metaphor for harmonic motion (another chapter title from Neely's analysis) suggests a topology that doesn't respect the standard voice-leading distances — it has shortcuts and drops that the Roman numeral framework doesn't predict.

In both cases, the frame is not wrong, exactly. It's a _choice_ — and the choice has consequences for what you can perceive, what you can create, and what connections you can notice.

## The Lonely Runner, Again

In ["The Lonely Runner"](/docs/essays/the-lonely-runner.md), we connected the Lonely Runner Conjecture to voice independence: every voice in a polyphonic texture is guaranteed a moment of maximum isolation. But the conjecture is frame-dependent — "distance" between runners depends on where you set the origin.

If you shift the origin (change where "one" is), the moments of maximum isolation occur at different times. The runners themselves haven't changed — their speeds and trajectories are fixed. But the _measurement_ of isolation depends on the coordinate system.

This is the Ludacris problem, elevated to mathematical generality. The structure of the acoustic signal is fixed. But which structural properties are _salient_ — which patterns you notice, which tensions you feel, which resolutions satisfy — depends on where you place the frame.

## Implications for Musical AI

This has direct implications for the polyphony problem we explored in ["The Polyphony Problem"](/docs/essays/the-polyphony-problem.md). One reason AI systems struggle with polyphonic audio is that they need to assign frames (beat tracking, chord recognition, source separation) before they can reason about structure. But frame assignment is itself a musical judgment — a creative act, not a computational prerequisite.

A system that tracks the beat "correctly" in "Roll Out" and then analyzes the song from that frame will produce different results from one that tracks it the way Neely initially heard it. Both analyses would be internally consistent. The question of which is "right" requires access to performer intent — information that lives outside the signal.

This suggests that robust musical intelligence requires not frame detection but **frame fluency**: the ability to hear the same signal through multiple frames, to notice when frames compete, and to shift between them deliberately. This is exactly what Neely had to laboriously teach himself for "Roll Out." It's also what Lau Noah practices naturally in her harmonic explorations — she moves through chord space without committing to a single analytical frame, keeping the possibilities fluid.

## The Philosophical Point

At bottom, "finding one" is an act of interpretation, not observation. The one is not in the sound. It's in the relationship between the sound and the listener. This doesn't make it arbitrary — perceptual constraints, cultural training, and acoustic cues all make some frames more natural than others. But it does make it a _choice_, whether conscious or unconscious.

This is what music shares with mathematics. In mathematics, the choice of basis, the choice of coordinate system, the choice of which symmetries to mod out — these are not discoveries about the mathematical objects themselves. They are decisions about how to look at those objects, and different decisions reveal different structure. The objects are invariant; the descriptions are not.

The deepest musical experiences may happen at the boundaries between frames — moments where the ear is pulled in two directions, where two valid interpretations coexist, where "one" is ambiguous and the ambiguity _is_ the art. Think of the metric modulations in Stravinsky's _Rite of Spring_, the tonal puns in Schubert's wandering sonata forms, or the rhythmic illusions in Meshuggah's polymetric riffs. In each case, the music's power comes not from the clarity of the frame but from its instability.

Finding one is essential. Knowing that you chose it — that's where it gets interesting.

---

_Connected essays: ["The Lonely Runner"](/docs/essays/the-lonely-runner.md), ["Counting the Cubes"](/docs/essays/counting-the-cubes.md), ["The Representation Gap"](/docs/essays/the-representation-gap.md), ["The Listener's Grid"](/docs/essays/the-listeners-grid.md), ["The Polyphony Problem"](/docs/essays/the-polyphony-problem.md), ["The Shape of Musical Choice"](/docs/essays/the-shape-of-musical-choice.md)_

_Sources: Adam Neely — "The Ludacris song that BROKE my brain" (2025), Adam Neely — "The Harmonic Genius of Lau Noah" (2025)_
