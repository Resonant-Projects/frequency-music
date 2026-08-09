---
title: "The Evidence Carrier"
publishDate: 2026-08-09
excerpt: "A sound’s identity depends on the evidence carrying it. Explore how voice, pitch, timbre, room, and timing can shift while musical objects remain recognizably intact."
category: "interdisciplinary"
tags:
  - "perception"
  - "psychoacoustics"
  - "signal-processing"
  - "acoustics"
  - "AI-music"
  - "composition"
author: "Keith Elliott"
byline: "Freq"
---

## The Sound Is Not The Evidence

The recent extraction cluster has been circling one idea from different angles: a sound is not identical to the evidence by which a system recognizes it. Voice, pitch, room, authenticity, and musical form all depend on carriers, and the carrier can change while the apparent object stays partly intact.

That sounds abstract until the examples line up. A voice-conversion system can preserve speaker identity while damaging phonetic fidelity. A phone recognizer can preserve linguistic content while ignoring the body behind it. A benchmark can appear to test deepfake detection while actually rewarding genre mismatch. A room model can appear to learn acoustics while relying on a target-position impulse response. A tone can keep its nominal pitch while moving pitch authority from a fundamental to upper partials or noisy spectral evidence.

The same correction keeps appearing: ask not only what the musical object is, but which evidence carrier is doing the work.

## Voice Shows The Split

The voice-between-domains cluster is the cleanest demonstration. Phonetic posteriorgrams, pitch contours, timbre conditioning, turn-taking prosody, and vocal/background stems are all different carriers for what a listener may call "the same voice."

None of them is sufficient alone. Phone content can tell us what was said without telling us who said it. Timbre can preserve identity while the words blur. Pitch contour can carry melody or prosody while the lexical surface changes. Turn-taking can make a voice feel socially present even when its acoustic color is synthetic. The stem boundary can decide whether the voice behaves like an isolated overdub or like a relation inside an accompaniment.

For composition, this means vocal identity is not a single knob. It is a bundle of evidence paths. A useful vocal instrument should let the composer decide which carrier bears identity in a given passage: body, vowel, contour, timing, room, or mix relation.

## Fairness Is Carrier Control

The fair-test cluster gives the evaluation version of the same claim. A benchmark becomes unfair when it lets the wrong carrier solve the task.

Echoes tries to remove semantic mismatch so a detector cannot win by hearing genre or prompt differences instead of generation traces. Structure-analysis trimming narrows the temporal carrier so loose annotation windows do not become accidental answers. Room-acoustics validation withholds target-position impulse responses because a measured response can function as a location fingerprint rather than evidence of transferable room understanding. Spatial-audio probing asks which variables an encoder actually carries: source identity, location, distance, or room shape.

The practical definition becomes sharp:

> A fair test controls the evidence carrier.

It does not merely hide labels or increase dataset size. It decides which cues are legitimate for the question and which cues are shortcuts from a different question.

## Tone Makes Evidence Audible

The plastic-tone cluster turns this into a studio handle. Pitch strength is not pitch height; it is the authority with which spectral evidence declares a pitch. Inharmonicity is not one thing; noise-related inharmonicity and discrete-partial interaction carry different kinds of evidence. A harmonic complex tone can remain one source while distributing pitch salience across several partials.

That makes tone a miniature evidence economy. The fundamental may carry the note. Then an upper partial may start to imply a second line. Then noise may weaken the pitch without erasing register. Then a developmental or production process may shift which region of the spectrum the listener trusts.

This is why "make it more tonal" is too blunt. The better instruction is: move the evidence. Give the pitch to the fundamental, the upper partial, the envelope, the residue after filtering, or the interaction between layers.

## A Compositional Exercise

Write a short piece around one phrase sung over one sustained low tone.

First, make a version where every carrier agrees: clear words, stable singer identity, centered pitch, dry vocal stem, strong fundamental, and obvious phrase boundary. Then make four versions where one carrier is reassigned:

1. Preserve the singer's identity but replace the words with phone-like non-lexical syllables.
2. Preserve the pitch contour but move identity into a different timbre or speaker.
3. Preserve the nominal bass pitch but shift pitch authority into upper partials.
4. Preserve the musical form but blur the boundary cue with reverb, overlap, or delayed response.

The listener should feel a controlled uncertainty: the object is still there, but the evidence for it has moved. That uncertainty is not a defect. It is the musical surface of the carrier changing.

## The Research Handle

This connection suggests a useful design principle for music tools and evaluations:

Name the carrier before trusting the identity.

For tools, expose carriers as controls: phone content, pitch contour, spectral salience, room fingerprint, stem boundary, timing relation, annotation window, uncertainty interval. For evaluations, restrict carriers to match the intended claim. For composition, deliberately move identity between carriers and listen for what survives.

The deeper pattern is wonderfully practical. A musical object is not only a note, voice, source, room, section, or song. It is also the path by which that object becomes knowable.

Change the path, and the music changes without necessarily changing its name.

---

_Sources: voice-between-domains essay and extractions (`j97e60hzvdd4v5pvvab4dv4jed8av6vz`, `j977bjx4mn520e8ebrmvjvnrw58agpf6`, `j97d5cc9xwxhv524jre9q1r36s8at5bn`, `j97f7yq3rv85mv7jkhvy1r0fbx8arevy`), fair-test essay and extractions (`j97bt3nyk8vhkpchhncydmk7v18av5ta`, `j97679y1jf7cnhkg7f2v6t2mz18b0wvf`, `j97449t2gg1cqfff5nrqf1fa5d8atd0x`, `j9718kahkvm0zmm4watm7bt0kd8avqh4`), and plastic-tone essay and extractions (`j978yxjgnckm2px83ae5dqwgq18ajxwm`, `j9762aqawbwmrwvhgfwrns5m398aj4d3`). Connects to: [The Voice Between Domains](/docs/essays/the-voice-between-domains.md), [The Fair Test](/docs/essays/the-fair-test.md), [The Plastic Tone](/docs/essays/the-plastic-tone.md), and [The Resolution Grid](/docs/essays/the-resolution-grid.md)._
