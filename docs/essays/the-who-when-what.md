# Who, When, What

**Essay #109** — April 15, 2026

*Speech systems work when they keep the right axis intact.*

---

## The Three Questions

A voice is never just one thing. It answers at least three different questions at once:

- **Who** is speaking?
- **When** is the signal happening?
- **What** content is being carried?

Recent extraction work keeps circling the same design lesson: the strongest speech systems do not flatten those axes into one blob. They separate them just enough to preserve the cue each task needs.

That is a compositional idea as much as a machine-learning one.

---

## Who: Identity Needs Its Own Slot

TellWhisper and ZipVoice-Dialog both treat speaker identity as something that must survive transformation.

TellWhisper encodes time and speaker coordinates together, but not by collapsing them. It uses a dual-coordinate structure so the model can track **when** something happens and **who** it belongs to. ZipVoice-Dialog goes further, preserving speaker timbre while handling turn-taking in multi-speaker dialogue.

That matters because identity is not the same as pronunciation, and neither is the same as timing. If you optimize the whole waveform as one target, you can easily erase the very thing that makes a voice recognizable.

For music, this is the difference between changing a singer's articulation and changing the singer.

---

## When: Timing Is Not a Side Effect

MoshiRAG is interesting because it exploits a temporal gap, the brief space between response onset and content delivery, to retrieve facts without breaking conversational flow.

That is a beautiful trick. It treats **when** as a resource.

In PS-TTS, timing is also explicit: isochrony is handled separately from phonetic synchronization. Duration and vowel shape are not the same problem. The system can preserve lip-sync while also preserving semantic intent. Again, the signal is not one thing. It has axes.

This is close to rhythm in composition. Timing is not merely the container for content. Timing is an expressive dimension in its own right.

---

## What: Content Can Be Fused Without Being Flattened

The distributed multichannel Wiener filter paper shows another version of the same idea. The nodes do not exchange raw audio. They exchange low-dimensional fused signals that are enough to reconstruct the target speech well.

That is not maximal preservation. It is sufficient preservation.

The system keeps the information the task needs and discards the rest. That is the right kind of compression.

For composers and audio tools, this is the practical question: what is the smallest representation that still carries the musical fact you care about?

---

## The Compositional Rule

When building voice tools, do not ask, “How do we preserve everything?”
Ask instead:

- what must stay stable,
- what may shift,
- and what can be fused away without losing the line.

Sometimes you want the **who** to stay fixed while the **when** bends.
Sometimes the **when** must stay fixed while the **what** changes.
Sometimes you want the **what** to remain legible while identity and placement move around it.

That is already a compositional practice. Singers, dub artists, and producers do it instinctively. The new speech models are just making the axes visible.

---

## The Point

These papers are not saying voice is simple.
They are saying voice is *structured*.

And once you can name the structure, you can compose with it.

---

*Sources: TellWhisper; ZipVoice-Dialog; PS-TTS; MoshiRAG; distributed multichannel Wiener filtering for wireless acoustic sensor networks.*

_Connections: [The Voice Has More Axes Than the Metric](the-voice-has-more-axes-than-the-metric.md), [The Cue That Survives](the-cue-that-survives.md), [The Timing Engine](the-timing-engine.md)._