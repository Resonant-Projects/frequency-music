# The Decision Moves Upstream

The newest extraction batch has a quiet technical theme: the important decision is happening earlier than expected.

SR-CorrNet says this explicitly. Late-split speech-separation systems wait until the final stage to disentangle speakers, and that delay creates an information bottleneck. By the time the model decides who is who, the representation may already have compressed away the evidence needed to separate them. The paper's answer is to move separation upstream: extract coarse source structure from the mixture, then reconstruct speaker-discriminative features through later refinement.

FSD50K-Solo moves a different decision upstream. Instead of training on open audio first and discovering later that many labels are contaminated by background events, it asks at corpus-construction time whether a recording is single-source enough to keep. The dataset is not a passive container. It is an early listening instrument that filters the world before learning begins.

The streaming SpeechLLM makes the same move in time. A non-streaming system can wait for the full utterance, then translate. A live system has to decide when enough acoustic context has arrived. Its core task is not only "what should the output token be?" but "is now the right moment to emit it?" Translation quality depends on the policy that decides when evidence has become actionable.

These are three versions of one principle:

**A system's musical intelligence depends on where it places the first irreversible decision.**

That decision might be architectural, as in early source separation. It might be curatorial, as in single-source dataset filtering. It might be temporal, as in streaming translation. In every case, the downstream result is shaped by an upstream commitment about what counts as enough evidence.

Composition has the same structure. A canon fails if the listener cannot bind notes into continuing voices early enough. A timbral fusion works when the ear stops assigning partials to separate causes. A live electronic system feels responsive when it acts before the gesture is over, but not before the gesture has declared itself. The art is not only choosing the sound. It is choosing where the listening process must commit.

This suggests a practical control surface for Frequency tools: expose **decision position** as a compositional parameter.

- Move source attribution earlier to clarify counterpoint, instrument identity, or conversational turn-taking.
- Move it later to produce fusion, ambiguity, masking, or spectral cloud.
- Move action timing earlier to create risk, anticipation, and interactive immediacy.
- Move it later to create stability, confirmation, and delayed recognition.
- Move curation earlier to build clean models of sourcehood before deliberately contaminating them.

For a musician, the question becomes wonderfully concrete: what would this passage sound like if the listener had to decide sooner? What would change if the system were forced to wait?

The recent batch gives a rigorous technical backbone for that compositional intuition. SR-CorrNet shows that late decisions can lose recoverable source evidence. FSD50K-Solo shows that a corpus can encode a theory of source purity before training begins. Streaming SpeechLLM shows that action timing is a learned part of the task, not an implementation detail.

The connection to earlier notes on sufficiency is clear, but this is the next refinement: sufficiency is not just a threshold. It has a location. Put the threshold upstream and the whole musical world downstream changes shape.

_Sources: SR-CorrNet extraction (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo extraction (`j97c8pg9neak74x61xchz55s6s86ryfx`), and streaming SpeechLLM extraction (`j976ynszeyaxehsqvje6nx8mms86s4wx`). Connections: sufficiency threshold, source attribution under mixture, streaming inference, early separation, corpus curation, perceptual commitment._
