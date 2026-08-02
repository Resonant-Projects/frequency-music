# The Relations That Survive

Three recent extractions point toward the same compositional problem from different sides: the musically important object is often not the value itself, but the relation that survives between values.

The spatial-audio phase paper makes the most physical version of the claim. In multichannel waveforms, the source says that spatial information can live in phase relationships between channels, and that magnitude-based metrics may barely move when that coherence collapses. That is a sharp warning. If each channel is reconstructed independently, the resulting audio may keep much of its spectral outline while losing the thing that made it spatially meaningful. The room, direction, and embodied geometry are not stored in one channel. They are stored between channels.

The Primaal pitch-uncertainty extraction makes a parallel claim about pitch. Its central idea is not that notes are mistuned, but that pitch may be organized as a distribution around scale-degree poles. The expressive parameter is the width of the distribution. A note name can still be useful as a gravitational center, but it is no longer the whole event. The event is the cloud: its center, spread, spectral causes, and perceptual ambiguity. Here too, the important musical fact is relational. A pitch is not simply a frequency; it is a patterned uncertainty around a pole.

MusicWeaver contributes the structural version. It treats long-form generation as a multilevel song program encoding form, motif recurrence, and bar-level attributes, then defines typed operations that preserve plan validity during edits. The interesting claim is not merely that a model can generate minutes of audio. It is that editing becomes musically trustworthy only when the system can protect relations across time: what counts as a return, what belongs to a section, what may change locally, and what must remain intact outside the edited span.

Put together, these sources suggest a useful rule for machine listening and composition:

**Do not ask only what changed. Ask which relations survived.**

That rule cuts across several familiar musical dimensions.

In spatial audio, the surviving relation may be inter-channel phase coherence. A left channel and right channel can each look plausible while their joint phase structure no longer points to a stable acoustic world.

In pitch organization, the surviving relation may be a distribution around a pole. A sequence can resist reduction to discrete notes while still sounding centered, modal, and intentional.

In musical form, the surviving relation may be recurrence under variation. A section can return without being copied; a motif can remain itself while its surface changes; an edit can be local only if it preserves the larger plan that gives the edit meaning.

This gives Freq a compact research target: build representations whose first-class objects are relations, not just labels or measurements. A scalar pitch estimate, a magnitude spectrogram, and a section tag all throw away something the ear may care about. The better representation keeps the pair, cloud, or path:

- channel pairs with phase coherence, not isolated channels;
- pitch distributions around poles, not only note labels;
- motif-return paths, not only section names;
- edit spans plus invariant surroundings, not only replacement audio.

The compositional payoff is immediate. Imagine a tool where a composer can decide which relations are protected during transformation. Preserve spatial coherence while changing timbre. Preserve a pitch pole while widening the distribution around it. Preserve motif identity while changing instrumentation. Preserve everything outside a local edit exactly enough that the musical world does not have to be rebuilt after every revision.

That is a different kind of control surface. It treats musical material less like a list of objects and more like a web of invariants. The knob is not only "more detune" or "change section B." It is "let this relation loosen" or "keep this relation fixed."

There is also a diagnostic lesson here. Many automated metrics fail because they measure the wrong residue. A magnitude metric can miss collapsed phase coherence. A discrete transcription can miss deliberately distributed pitch. A generation score can miss whether a return actually feels like a return. The common failure is relational blindness.

The next experiment should be deliberately small. Take one audio phrase and make three transformations:

1. Preserve the magnitude spectrum while disrupting inter-channel phase.
2. Preserve a modal pitch pole while widening pitch variance around it.
3. Preserve a motif's contour while changing its surface and register.

Then ask listeners what remains recognizable. If recognition follows the protected relation rather than the preserved surface, the representation is doing real musical work. It would mean that composition can be steered by invariants: not only by what sound is, but by what relation continues to hold while sound changes.

