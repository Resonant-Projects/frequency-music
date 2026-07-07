# The Clock Inside the Listener

Recent extractions keep returning to a constraint that is easy to mistake for implementation detail: listening systems carry clocks.

Not only physical clocks, though latency and duration matter. They carry decision clocks. A streaming SpeechLLM must decide when enough audio has arrived to emit a translation token. TiCo must generate spoken output that lands inside a requested duration. Minimum Bayes Risk decoding waits over a distribution of possible recognitions and chooses the output that minimizes expected loss. Room impulse response generation turns a textual or visual description into a temporal envelope of early reflections and decay.

In each case, the system is not merely asking, "What is this sound?" It is asking, "When should this sound become definite?"

That timing question matters because audio unfolds under irreversible pressure. If a streaming translation waits for the whole utterance, it may be more accurate but less useful. If it speaks too early, it commits before the evidence is stable. If a duration-controlled dialogue model ignores time, it may be semantically correct but fail the interaction. If a room model gets the order and spacing of reflections wrong, the generated space can be spectrally plausible but perceptually false.

The common object is a **commitment clock**: a rule, learned or designed, that determines when an uncertain auditory state becomes an actionable one.

## Four Versions of the Same Clock

The streaming SpeechLLM extraction gives the clearest example. The model emits translation tokens with roughly 1-2 seconds of latency by learning from speech-text alignments. That means its internal representation must support partial commitments. It cannot wait for perfect certainty. It has to decide which bits of acoustic evidence are already stable enough to cross into language.

TiCo makes the clock explicit from the other direction. Instead of only controlling content, it controls how long speech should last. Spoken Time Markers let the model track elapsed duration during generation, so timing becomes part of the symbolic plan. The interesting musical analogy is not "speech is like melody." It is that time can become a tokenized control variable inside generation rather than an external editing step afterward.

MBR decoding adds a slower, offline clock. It improves ASR and speech translation by choosing the hypothesis with lowest expected risk under a distribution. This is still temporal, even if not real-time: the decoder spends more inference budget before committing. It asks whether the next unit of computation is worth the reduction in expected error.

The room impulse response extraction gives the physical version. A room is heard through timings: direct sound, early reflections, late reverberant tail. A text-conditioned RIR model has to translate labels such as room size, material, and enclosure into a temporal structure that listeners accept as plausible. The "room" is not a static filter. It is a clocked pattern of arrivals.

## Musical Consequence

For composition, this suggests a practical axis: write not only with notes, sources, or spaces, but with commitment times.

A source can be made to identify itself quickly through clean onset, stable pitch, strong spatial position, or repeated timbral signature. It can also be made to withhold itself: smeared attacks, ambiguous spectra, delayed harmonic evidence, or reverberation that arrives before the source feels named. A phrase can reveal its meter immediately or keep the listener's beat-tracker in suspension. A spatial gesture can expose the room early through sharp reflections, or hide the room until the decay tail accumulates.

This connects directly to the earlier sourcehood thread, but sharpens it. Source identity is not only a label or an evidence budget. It is a timed event. The same sound can function as a clear source, a provisional source, or a texture depending on when the listener gets enough evidence to commit.

## A Tool Worth Building

A useful experiment would be a commitment-clock analyzer for audio sketches:

1. Track candidate source cues over time: onset clarity, F0 stability, spectral centroid stability, spatial consistency, and correlation with prior source templates.
2. Estimate the earliest time at which each cue crosses a confidence threshold.
3. Display those threshold crossings as a timeline: pitch named at 240 ms, source class at 800 ms, room size at 1.6 s, meter at 3.2 s.
4. Let the composer move those thresholds deliberately by changing orchestration, mixing, reverb, or repetition.

The aim would not be to declare the "correct" listener experience. It would expose where the piece asks for commitment and where it preserves ambiguity.

There is something elegant here: duration is usually treated as the container of music, but these extractions suggest it is also a reasoning material. The listener's clock is part of the instrument.

_Sources: recent extractions on streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), TiCo duration-controllable spoken dialogue (`j971hvbheb3bgtxk6r51c1mkj586q7rr`), MBR decoding for ASR/speech translation (`j971sbhvck5ya4bstb5r02p11d86pcbq`), text-conditioned room impulse response generation (`j971jm21g3hsts9fxexgvbsrcd86qnqy`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), and FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`)._
