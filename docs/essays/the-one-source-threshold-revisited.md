# The One-Source Threshold, Revisited

A surprising amount of recent audio research is organized around a small question:

When is a sound still one thing?

FSD50K-Solo asks it at the dataset level. Open audio corpora are full of useful recordings, but many are not clean examples of a single event. A dog bark may carry traffic. A bell may carry a room. A scrape may be braided with speech. The paper's answer is to synthesize clean single-class events, build controlled mixtures, and train a classifier to filter multi-source samples. The result is a machine-curated subset whose value depends on drawing a boundary between single-source evidence and contaminated evidence.

SR-CorrNet asks the same question inside the mixture. Instead of curating examples before training, it treats overlapping speakers, noise, and reverberation as a field of spatio-spectro-temporal correlations. Some correlations are source-bearing; others belong to the room, interference, or shared acoustic circumstance. Its separation-reconstruction strategy moves speaker disentanglement earlier in the architecture, which means the model must commit to source identity before the final output layer has resolved every detail.

The anomalous sound detection paper asks the question by removing a label. Standard benchmarks often assume that the monitored machine identity is known at test time. But if recordings from multiple machines are merged, the detector has to discover whether an acoustic event belongs to a particular machine before it can decide whether that event is anomalous. The important result is not just that performance drops. It is that the drop is strongly tied to implicit machine identification. Anomaly is not heard in isolation. It is heard against a source identity.

Streaming SpeechLLM adds time pressure. The model does not merely decide what the speech means; it decides whether it has heard enough audio to translate. This is another one-source threshold, but stretched across time. A partial utterance is not yet a stable object. Too little context and the model risks attaching words to the wrong future. Too much waiting and the translation stops being usable.

These systems differ in purpose, but they share a hidden operation: they convert continuous acoustic ambiguity into an actionable unit. A source becomes clean enough to train on. A speaker becomes separate enough to reconstruct. A machine becomes identifiable enough to monitor. An utterance becomes complete enough to translate.

That operation matters for music because musical sourcehood is often deliberately unstable.

A bowed cymbal can begin as a gesture, become a room tone, then harden into a recognizable object. A distorted guitar chord can behave like one source to a listener and many sources to a spectral analyzer. A string quartet can fuse into a single harmonic body, then split back into four agents with one entrance. Reverberation can be nuisance, evidence, glue, or counterpoint depending on the frame.

The compositional question is not simply how to separate sources. It is how to place a sound near the threshold where separation is almost possible.

One practical exercise would be to compose three versions of the same texture:

1. A clean single-source version that a classifier should accept.
2. A fused version that a listener still hears as one musical body.
3. A borderline version that a separation model tries to pull apart.

The interesting material is the third version. It reveals which features make source identity operational: common onset, harmonic alignment, spatial position, spectral continuity, repeated envelope shape, or learned timbral expectation. A composer could treat those features as knobs, not just measurements.

Another exercise would reverse the anomaly-detection protocol. Give a model or listener several related sound-makers without labels, then introduce a small deviation. If the source identity is uncertain, the deviation may not register as wrong. If the identity locks in, the same deviation becomes expressive, alarming, or funny. In musical terms, wrongness depends on attribution. A note is not out of tune until the listener knows what system it belongs to.

The deeper link is that source identity is not a fact added after listening. It is one of the conditions that makes listening possible.

This suggests a useful term: the **one-source threshold**. It is the point at which an acoustic field becomes actionable as a single object for a particular task. The threshold is not universal. Dataset curation, source separation, anomaly detection, translation, and musical listening each draw it differently. Each threshold preserves some differences and discards others.

For composition, that is the gift. A piece can move the threshold itself. It can make one sound become many, make many sounds behave as one, or hold the listener in the charged interval where both readings remain available.

That charged interval is not a failure of perception. It is a musical resource.

_Sources: recent extractions on FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), machine identity in anomalous sound detection (`j9741717c5306g0134yg8tgtb986qgdn`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
