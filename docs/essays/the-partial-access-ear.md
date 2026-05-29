# The Partial-Access Ear

_The listener almost never receives the whole system. Music happens in the gap between what is available and what must be inferred._

Several recent extractions circle the same problem from different directions: what can a system know when access is partial?

The streaming SpeechLLM paper makes partial access temporal. The model must translate before the utterance is complete, learning not only what to say but when enough acoustic context has arrived. Its knowledge is deliberately unfinished. Waiting would improve certainty, but waiting too long destroys the usefulness of the system.

The anomalous sound detection paper makes partial access contextual. Standard benchmarks assume the machine identity is known, but realistic monitoring may withhold that identity. Once the label is removed, performance depends on whether the model can infer the hidden source from the sound itself. The missing coordinate was doing work.

The anesthesia source, though only partially extracted, points to a more unsettling version of the same idea. If auditory learning can persist below conscious awareness, then access is partial on both sides: the sound reaches the body, but not necessarily the narrating mind. Hearing may continue even when reportable listening drops away.

Proof complexity gives the abstraction. Some truths may be provable in principle but inaccessible in practice because the proof is too long to ever write down. Operationally, such truths behave like unknowns. A structure can exist and still be unavailable to the system that needs to act.

That suggests a useful compositional principle:

**design for partial access, not total revelation.**

A piece can decide which coordinates are available to which listener, model, performer, or instrument. Source identity might be hidden while timbral behavior remains exposed. Metric pulse might reach the body before the conscious ear names it. Harmonic direction might be formally present but require a proof too long for real-time listening. A room response might reveal spatial geometry only after the direct sound has already made the source seem close.

This reframes musical ambiguity. Ambiguity is not only a lack of information. It is a distribution of access. One layer may be obvious to the body, another to analysis, another to memory, another to a machine listener, and another to nobody in real time.

The practical handles are simple:

- withhold source labels while preserving source signatures
- delay decisive harmonic evidence beyond the listener's action window
- let unconscious or bodily cues carry structure before explicit recognition
- make a formal pattern verifiable after the fact but hard to discover during playback
- use room, masking, or overlap to make the same event available at different resolutions

The compositional payoff is not obscurity for its own sake. It is layered listening. A partial-access piece can be clear in one channel and opaque in another, immediate in the body and delayed in the intellect, obvious to memory and unavailable to first hearing.

The question becomes:

**who gets access to which part of the sound, and when?**

_Sources: recent extractions on streaming SpeechLLM translation (`j976ynszeyaxehsqvje6nx8mms86s4wx`), anomalous sound detection without known machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), unconscious auditory perception under anesthesia (`j974gtwmrad9zxbdz7787858m586pwp7`), and proof complexity / effective unprovability (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`)._
