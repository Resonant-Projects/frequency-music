# The Sourcehood Filter

_A sound system does not merely analyze signals. First it decides what counts as one source._

Three recent extractions make that decision visible from different angles. SR-CorrNet separates overlapping speakers by moving speaker disentanglement earlier in the model. FSD50K-Solo builds a dataset by filtering messy open audio into clean single-source events. A streaming SpeechLLM decides when it has heard enough context to translate without waiting for the whole utterance.

At first these look like separate engineering problems: separation, curation, and latency. But they share a deeper musical question:

**When is the system allowed to commit to an identity?**

SR-CorrNet answers by refusing to postpone the decision. The extraction highlights the failure mode of late-split speech separation: if speaker disentanglement is deferred until the final stage, the model carries an overloaded mixture too long. By the time the final layer tries to recover each speaker, source identity has already been blurred by overlap, noise, and reverberation. The interesting move is the correlation-to-filter frame. Spatio-spectro-temporal correlations are not treated as descriptive features after the fact; they become the basis for estimating filters that recover target signals.

That is a compositional principle hiding inside an architecture: if identity matters, preserve it before the shared bottleneck.

FSD50K-Solo approaches the same problem from the dataset side. Instead of asking a model to learn clean sound events from a corpus full of overlaps and background interference, it tries to construct a single-source subset. The extraction notes a two-step method: synthesize clean single-class events with a diffusion model, then use an encoder plus classifier to filter multi-source recordings from the open dataset.

This is not just data cleaning. It is a theory of sourcehood. A sound event becomes trainable when it can be treated as isolated enough to carry a stable label. The dataset is not merely collecting examples of "dog bark," "door slam," or "siren." It is enforcing a listening condition: one foreground cause, minimal competing causes, enough acoustic coherence that a label can stick.

The streaming SpeechLLM adds time to the same decision. It cannot wait for the full utterance, because the task is real-time translation. It has to learn not only what the speech means, but when enough audio has accumulated to emit the next token. The extraction reports near-baseline quality at roughly one to two seconds of latency. That latency window is not an implementation footnote. It is the model's sourcehood filter in motion: too early, and the utterance has not stabilized; too late, and the system has failed as a conversational instrument.

Put together, these sources suggest that musical analysis and generation need a first-class sourcehood filter:

1. **Isolation:** Can this sound be treated as one cause, or is it an unresolved mixture?
2. **Attribution:** If multiple causes are present, which features belong together?
3. **Commitment timing:** At what moment is there enough evidence to act?

These questions matter directly for composition. In orchestration, a line may be perceptually single even when physically distributed across several instruments. In electroacoustic music, one sample can imply a room, a gesture, and a material impact at once. In dense counterpoint, the listener's ear may switch between vertical fusion and horizontal stream tracking. Sourcehood is therefore not an objective property of the waveform alone. It is a contract between acoustic evidence, listener expectation, and task.

The practical tool idea is straightforward: build a "sourcehood meter" for compositional materials. Given an audio segment, it would estimate how strongly the segment behaves as a single source under several listening assumptions:

- spectro-temporal coherence across frequency bands
- onset and offset agreement
- pitch or modulation continuity
- spatial consistency when multichannel data exists
- label stability under source-separation or embedding models
- latency to confident attribution

The output should not be a single score. It should be a set of handles. A composer might ask for a sound that is timbrally fused but rhythmically ambiguous, or spatially stable but harmonically plural. The interesting musical region is often not "clean source" or "messy mixture," but the boundary where the ear can be persuaded either way.

This also reframes training data as composition. FSD50K-Solo's single-source curation suggests one pole: build a clean vocabulary of causes. SR-CorrNet suggests another: preserve identities through overlap. The streaming SpeechLLM suggests a third: act before certainty is complete, but only after enough structure has appeared.

For music, the richest systems may need all three. They need clean sources to establish recognizable identities, separation mechanisms to keep identities alive in texture, and timing policies that decide when a partial identity is musically actionable.

The old question was: what is in the sound?

The better question is: when does the sound become someone?

_Sources: recent extractions on SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo single-source audio curation (`j97c8pg9neak74x61xchz55s6s86ryfx`), and streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`)._
