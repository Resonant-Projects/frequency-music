# The Input Contract

**Essay #105** - August 21, 2026

---

Every musical system makes a bargain with its inputs.

Sometimes the bargain is explicit: a model is allowed to see a target impulse response, a source-separated stem, a degraded speech waveform, or a browser microphone stream. Sometimes it is hidden inside the evaluation protocol. Either way, the resulting musical intelligence is not just a property of the algorithm. It is a property of the contract: what evidence is available, when it is available, and whether that evidence is allowed to stand for the thing being claimed.

The recent extractions make this unusually clear. They are nominally about different domains: room-acoustic prediction, mixing-style transfer, guitar string classification, universal speech enhancement, and speech recognition benchmarks. But each one is really asking the same compositional question:

What can a system know from the signal it is permitted to hear?

## The Room That Cheats

The room-acoustics protocol paper is the cleanest warning. Machine-learning models predicting ISO 3382-1 room-acoustic parameters can look strong when validation rows are split casually and test-time inputs include measurements from the target position. Under that setup, reported mean performance reaches around R2 = 0.81 for core parameters.

But when the test is changed to match deployment, the result changes sharply. Hold out receiver positions as positions, and restrict inputs to source-receiver geometry plus environmental state: the reported R2 range falls to 0.09-0.57.

That is not a small tuning detail. It changes the object of knowledge.

A target-position impulse response can behave like a room fingerprint. It may identify where the listener is, not teach a transferable acoustic law. The model can seem to know the hall while actually recognizing the coordinate. The input contract has smuggled the answer into the test.

For composers, this matters because spatial tools are seductive. A system that predicts reverberation time, clarity, or sound strength can become an orchestration assistant only if it knows the room in the same way the performance will know it. If the system requires a measurement at the exact seat it is supposed to predict, then it is not a predictive instrument. It is an interpolation instrument. That can still be useful, but it is a different instrument.

## The Stem That Becomes Editable

StemFX makes the opposite bargain. It does not pretend a stereo mixture contains all the control a mix engineer needs. It makes source-separated stems part of the contract, then represents mixing style as variable-length FX chains on each stem.

That is musically honest. Mixing style is not only spectral outcome. It is a sequence of decisions: level, spatialization, effect choice, effect order, and parameterization. By predicting tokenized chains on pseudo-stems, StemFX moves style from an after-the-fact descriptor into an editable coordinate system.

There is risk here too. Pseudo-stems inherit source-separation artifacts, and a model may learn the style of separation as much as the style of mixing. But the contract is at least legible. If the input is stem-level, then the output can be stem-level. A composer can ask for a chain, inspect it, replace a compressor, move a reverb, or make the model's proposal into a starting point rather than an opaque verdict.

This is the practical difference between prediction and instrumentation. A prediction says, "this is probably the style." An instrument says, "here are the handles by which this style can be changed."

## The Guitar's Hidden Source

Fretiq adds a smaller, elegant case. On electric guitar, the same pitch can be played on different strings and frets. Untrained listeners may find the timbral differences hard to hear, but a browser-native classifier can still recover string identity from engineered spectral features, especially MFCCs, band energies, and spectral statistics.

Here the input contract is charmingly strict: monophonic electric-guitar audio, one instrument, one player, no hexaphonic pickup, no fretboard sensor, no camera, no multi-microphone array. The system is forced to answer from ordinary audio.

The result is not perfect: shuffled frame validation is much higher than held-out free-play performance. But that gap is the useful part. It names the difference between a controlled coordinate and actual playing. In the lab, the string trace is clean enough to classify. In free play, gesture, dynamics, transitions, and player behavior disturb the coordinate.

Compositionally, that suggests a playable parameter: source ambiguity. A guitarist can write passages where pitch identity is stable but string identity becomes the changing layer. The same note can carry different physical histories. A classifier can expose that hidden layer, but the music can also make it unstable on purpose.

## The Voice Split In Two

UniPASE makes a different separation. Its pipeline turns degraded waveforms into phonetic representations, then into acoustic representations, then through a vocoder to 16 kHz waveform reconstruction before conversion to 48 kHz and resampling.

The important split is phonetic versus acoustic. The model tries to preserve linguistic content while minimizing hallucinated words, then restore acoustic detail around that content.

That is not merely an engineering architecture. It is a theory of voice: first protect what was said, then rebuild how it sounded. The danger is that the two layers are not independent in music. Sung vowels, breath, growl, register breaks, consonant timing, and expressive noise all live in the border zone between linguistic content and acoustic detail. A speech enhancer optimized to avoid linguistic hallucination may still hallucinate musical identity by smoothing away the performance's fragile evidence.

This creates a useful compositional inversion. Instead of minimizing hallucination, a vocal instrument might expose it as a dial: preserve words while allowing timbral invention, preserve timbre while allowing phonetic drift, or let the phonetic and acoustic layers disagree.

## The Benchmark's Social Ear

GigaSpeechBench widens the same question to populations. It tests ASR and speech translation across languages, dialects, accents, specialized terminology, and speaker ages. The benchmark's claim is not just that models fail more under difficult conditions. It is that common evaluations have not been listening to enough kinds of voices.

That is an input-contract failure at social scale.

If a system only hears a narrow distribution during evaluation, then robustness claims are claims about that distribution, not about speech. Accent, dialect, age, vocabulary, and recording domain are not noise around a universal signal. They are part of the signal's real geometry.

For music, the parallel is direct. A model trained on polished studio norms may treat local vocal production, older voices, child voices, regional phrasing, or culturally specific prosody as error. The more universal the tool claims to be, the more carefully its input contract has to name whose sound counts.

## A Rule For Tools

The shared rule is simple:

An audio model is only as musical as its input contract is honest.

If it sees target-position evidence, call it interpolation. If it sees stems, expose stem-level controls. If it sees only monophonic audio, measure how the result survives free playing, not just shuffled frames. If it protects phonetic content, ask what acoustic identity it may flatten. If it claims robust speech understanding, test the voices that usually sit outside the center.

This becomes a compositional method:

- write one layer that can be inferred only from ordinary audio
- write another that requires hidden source knowledge
- make a spatial passage that changes depending on whether the listener position was measured or predicted
- design a vocal process whose phonetic and acoustic identities can be separated, recombined, or made to contradict each other
- treat evaluation protocol as part of the score

The lovely thing is that this turns a dry machine-learning concern into musical material. Input availability, validation split, source separation, microphone constraint, and corpus coverage are not only audit terms. They are forms of listening.

Every instrument asks for evidence. Every model decides what counts. The composer can accept that contract, break it, or write the contract itself into the music.

---

_Sources: room-acoustic input-availability extraction (`j97679y1jf7cnhkg7f2v6t2mz18b0wvf`), StemFX mixing-style extraction (`j972b99xapwke0nsrs9mydqez58b2v83`), Fretiq browser guitar-string extraction (`j976hka8k1xqgt9rbagkz562e18b12er`), UniPASE speech-enhancement extraction (`j974dj9b7efc9g420nm765sw298ayfbj`), and GigaSpeechBench extraction (`j977a50mq9hqrg3jm67wj0b8es8b187g`). Connects to [The Admissible Signal](the-admissible-signal.md), [The Evidence Carrier](the-evidence-carrier.md), [The Test-Time Instrument](the-test-time-instrument.md), [The Degrees Of Freedom That Remain](the-degrees-of-freedom-that-remain.md), and [The Coordinate You Choose](the-coordinate-you-choose.md)._
