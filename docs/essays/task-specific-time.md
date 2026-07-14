# Task-Specific Time

The newest extraction set suggests a useful correction to the phrase "audio
understanding." A system rarely understands sound at one universal clock rate.
It understands sound at the rate demanded by the task.

The music-game level-generation paper makes this explicit. Frame grids smear a
gameplay event across many time steps, so the event is present but not named.
The proposed alternative is a sequence that alternates gameplay-event tokens
with beat-shift tokens. That is a small representational change with a large
musical consequence: time is no longer just elapsed seconds. It becomes beat
space, and actions can be placed relative to pulse, syncopation, and larger
rhythmic spans.

Wan-Dancer approaches the same problem from the body. Long dance generation
fails when the model treats a full track as only a pile of local frames. Its
hierarchical split between global keyframe planning and local temporal
refinement says that choreographic time has at least two clocks: one for
section-scale intention and one for motion continuity. Time-mapped RoPE
embeddings and dynamic frame-rate adaptation are technical details, but the
musical claim is plain. Alignment is not just putting a footfall on a beat. It
is preserving a relation between the changing rate of the music and the changing
rate of the body.

ReGen and ReGenVoice offer a quieter version of the same idea. Their reported
12.5 Hz and 6.25 Hz latent rates are far slower than waveform time, yet the
authors claim that rich semantic and acoustic latents can still generate usable
audio. Whether the perceptual results hold for music is an open question, but
the design principle is compelling: a generative model can render at audio rate
while making decisions at syllable, gesture, or phrase rate. The clock of the
decision does not have to match the clock of the signal.

SPAM adds a phonological clock. It maps speech-model frames to feature
activations such as voicing and nasality. Those activations are not samples,
beats, or video frames. They are articulatory events: breath starts, voicing
locks in, resonance moves through the nose, a segment boundary becomes audible.
For vocal composition, that representation hints at a control lane between
phonetics and timbre. Instead of automating a single "voice" parameter, a
composer could automate the timing of features that make the voice feel voiced,
nasal, stopped, opened, or released.

Put these sources together and a pattern appears:

- interactive action wants beat-relative time;
- dance wants a relation between phrase-scale plans and motion-scale frames;
- audio generation wants slow semantic latents plus fast rendering;
- speech analysis wants phonological feature time.

None of these clocks is more real than the others. Each is a projection that
makes one kind of musical action possible.

For Frequency tools, this suggests a practical design test. When we build an
analysis or generation system, ask what timebase the user is actually supposed
to touch. If the target is rhythm-game choreography, expose beat shifts and
events. If the target is dance, expose phrase plans and motion refinements. If
the target is vocal timbre, expose phonological feature trajectories. If the
target is generative audio, expose slow latents that can be shaped musically
while the system handles the waveform.

The deeper lesson is that musical time is plural. A score already knows this:
measure numbers, beats, tuplets, phrase marks, breath marks, bow changes, and
pedal changes all coexist over the same sound. Modern audio systems are
rediscovering the same fact in model form. The useful representation is not the
one that is closest to the waveform. It is the one whose clock matches the
musician's next decision.

_Sources: recent extractions on event-based music-game level generation
(`j97a8a0n1pryra85yf7sfehk9h8ae8km`), Wan-Dancer long-form music-to-dance
generation (`j97bw3c6d199ghsv0fnshtgpex8afycn`), ReGen/ReGenVoice low-rate
audio latents (`j97d7hq5d3kndbx5sq26qppqwn8afr0d`), and SPAM phonological
activation mapping (`j972wzzsntw3sac4tf8eww83r98ae4tk`)._
