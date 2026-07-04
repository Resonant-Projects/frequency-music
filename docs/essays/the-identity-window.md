# The Identity Window

_Essay #147 - July 4, 2026_

## The Question

How long does a sound system get before it has to know what made the sound?

The recent extraction set keeps circling source identity, but the more interesting variable is not identity alone. It is the window in which identity must become usable.

SR-CorrNet frames speech separation as a correlation-to-filter problem. The model does not merely label speakers after the fact; it has to preserve spatio-spectro-temporal correlations early enough that they can shape the filters that recover target signals. The architectural critique is temporal: if disentanglement waits until the final stage, the representation has already lost too much.

FSD50K-Solo moves the same problem into dataset construction. A single-source event is not simply discovered. It is synthesized, filtered, and validated so later models can learn from cleaner identity evidence. The identity window is widened by editorial labor: the corpus gives the learner more time and less interference than the world usually permits.

Streaming SpeechLLM work makes the window explicit. Translation has to begin before the utterance is complete, so the model learns both what to say and when enough audio context has arrived. This is source identity's cousin: a system must decide when evidence has become sufficient, not perfect.

Anomalous sound detection adds the deployment warning. Benchmarks often assume machine identity is known at test time. When that name is withheld and recordings from multiple machines are merged, performance drops expose how much the detector depended on prior attribution. The identity window collapses: the model has to identify the source and detect the anomaly in the same listening act.

## Separation As Timing

Source separation is usually described spatially or spectrally: one source here, another source there; one band shaped this way, another band shaped that way. The extractions suggest a complementary description:

separation is a timed commitment.

A listener or model gathers evidence from onset, F0 contour, spectral envelope, modulation, room response, and continuation. At some point it commits to a source hypothesis. That commitment can be early and fragile, late and robust, or deliberately suspended.

This matters musically because many compositional effects live in the gap between first evidence and stable attribution. A bowed cymbal can begin as noise and later become gesture. A voice can enter as vowel color before becoming person. A reverberant attack can lose its body, then regain it when a pitch contour or repeated transient supplies continuity.

The practical parameter is not simply "ambiguous" versus "clear." It is:

- how much time the listener needs before sourcehood stabilizes
- how much interference the source can survive before identity breaks
- whether musical function depends on early or late attribution

Those are compositional controls.

## A Studio Exercise

Build a phrase in three versions.

In the first, make source identity immediate: dry sound, clear attack, stable register, repeated timbral evidence.

In the second, delay identity: blur the attack, expose only partial spectrum, withhold the characteristic transient until later, or let another source shadow the same contour.

In the third, make identity retroactive: the listener cannot confidently bind the opening sound until a later event reveals what the earlier sound must have been.

This is not just orchestration. It is proof timing. The sound offers evidence, and the piece decides when that evidence becomes enough.

## The Claim

The identity window is the time between acoustic arrival and usable source attribution.

For machine listening, it is a robustness problem. For composition, it is a form-bearing parameter. A system that separates too late loses information. A system that commits too early risks false binding. A piece can use both failures deliberately.

The new bridge is simple and useful:

source identity is not a label attached to sound; it is a decision made under time pressure.

That makes the compositional question sharper:

When should this sound become someone?

---

_Connections: source identity, identity latency, speech separation, single-source audio, streaming inference, anomalous sound detection, source attribution, spectro-temporal correlation, F0 contour, domain shift._
