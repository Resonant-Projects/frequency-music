# The Proof Burden of Sound

_Essay #183 - July 3, 2026_

## The Question

When does a listening system owe proof?

The recent extraction set looks, at first, like two unrelated clusters. One cluster is practical audio machine learning: SR-CorrNet separates overlapping speakers, FSD50K-Solo curates single-source sound events, and streaming SpeechLLM decides when enough audio has arrived to translate. Another source, from proof complexity and cryptography, asks what happens when something may be true but any proof would be too long to write down.

The bridge is sharper than it first appears: every listening system carries a proof burden. It must decide whether a sound is one source or many, whether an event belongs to this machine or that machine, whether a partial utterance is stable enough to translate, whether a voice has remained itself through noise and reverberation. The system may never possess complete proof. It only has operational evidence.

## Effective Proof Is Not Absolute Proof

The proof-complexity extraction describes mathematical statements that may be provable in principle but not in practice. If the shortest proof is too long to ever produce, the statement becomes effectively unknowable. In cryptographic terms, a flaw that cannot be proven or exploited can behave like no flaw at all.

Audio systems live with an analogous constraint. A model may be able, in principle, to infer the exact sources in a mixture, the exact room contribution, or the exact identity of a machine or speaker. But if the evidence required is not present soon enough, cleanly enough, or cheaply enough, that identity is operationally unavailable.

That distinction matters for music. A chord may have an elegant theoretical interpretation that no listener can establish in time. A timbral blend may contain separable instrumental traces that the ear cannot bind before the next event arrives. A meter may be formally implied but perceptually unproven. The structure exists, but its proof is too late.

## Separation Has a Proof Cost

SR-CorrNet makes the proof burden architectural. Late-split speech-separation systems defer speaker disentanglement to the final stage, creating a bottleneck. The model improves by using spatio-spectro-temporal correlations earlier, turning mixed observations into filters for target recovery.

In other words, the system cannot wait to prove source identity at the end. It has to preserve the evidence while the evidence is still usable.

That is also an orchestration principle. If two instruments share register, onset, spectral envelope, and spatial position, their separate identities may be theoretically recoverable but perceptually expensive. If the composer wants the listener to prove two sources, the piece must pay the proof cost with redundant cues: staggered attacks, contrasting envelopes, spatial separation, registral distance, or divergent pitch motion.

If the composer withholds those cues, the blend is not a failure. It is a deliberate increase in proof complexity.

## Curation Decides What Counts as Proof

FSD50K-Solo approaches the same burden from the data side. Its premise is that a useful single-source dataset cannot simply assume source purity. It must construct a procedure that decides which recordings count as single-source enough for training.

That phrase, "enough for training," is the key. Single-source audio is not a metaphysical category. It is a thresholded claim under an evaluation regime. The proof standard depends on the task.

Composition can use the same idea. A sound can be single enough for melody, mixed enough for texture, identifiable enough for memory, and ambiguous enough for harmony. Sourcehood is not one value. It is a set of proof standards imposed by different musical functions.

## Streaming Commits Before Completion

The streaming SpeechLLM extraction adds time pressure. The model must translate before the utterance is complete. It learns when sufficient context has arrived, aiming for low latency without losing too much quality.

This is proof under deadline. The model does not get to say, "wait until all evidence arrives." It must decide when the present evidence is good enough to become public action.

Musical listening is full of these deadlines. A downbeat must become believable before the body can move with it. A modulation must become plausible before its resolution feels earned. A solo line must become identifiable before its return can register as memory. The proof burden is not only how much evidence exists; it is whether the evidence arrives before the musical decision expires.

## A Compositional Parameter

This suggests a useful parameter: **proof burden**.

Low proof burden means the listener can establish a claim quickly. The source is clear, the pulse is redundant, the timbre is distinct, the harmonic function is conventional, the spatial cue is stable.

High proof burden means the claim requires more evidence than the current texture readily provides. The source is masked, the pulse is underdetermined, the timbre is hybrid, the harmony has multiple readings, the room smears identity, or the phrase delays its confirming cue.

A composer can move proof burden over time:

- lower it to make a gesture snap into focus
- raise it to suspend identity
- shift it from pitch to timbre, or from timbre to rhythm
- make one layer provable while another remains effectively unknowable
- let a late proof retroactively reorganize what the listener thought they heard

The proof-complexity analogy keeps the idea precise. Ambiguity is not just mood. It is a measurable mismatch between a claim and the evidence available to establish it.

## Why It Matters

The useful lesson across these sources is that listening is not only classification. It is evidence management.

A system may know something in principle and still fail to act on it. It may act successfully without complete proof. It may hide uncertainty by choosing an evaluation protocol that makes identity available in advance. It may become more musical, or more robust, by admitting that certainty has a cost.

For Frequency Music, this points toward tools that estimate not only what a passage contains, but how hard its claims are to prove in time. A proof-burden view could compare source identity, meter, tonal center, phrase function, and timbral category as separate evidence curves.

The compositional question becomes wonderfully concrete:

What does the music ask the listener to prove, and how much evidence does it give them before the moment passes?

---

_Sources: recent extractions on SR-CorrNet (`j9707xjeskqasppyj6nw1v99vs86sw9a`), FSD50K-Solo (`j97c8pg9neak74x61xchz55s6s86ryfx`), streaming SpeechLLM (`j976ynszeyaxehsqvje6nx8mms86s4wx`), and proof complexity / effective zero-knowledge (`j97651ph1ys6ctg5xdr9b7nr0986rcwp`). Connections: proof burden, sourcehood, operational evidence, source separation, latency, perceptual ambiguity, orchestration._
