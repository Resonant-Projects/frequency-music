# The Admissible Signal

The newest extraction pass could not run live, but the local recent extraction candidates still expose a useful connection. Several sources ask the same question in different costumes: what information is a system allowed to use when it claims to understand sound?

The Echoes music-deepfake dataset makes this explicit by semantic alignment. If real and generated tracks differ in genre, descriptors, arrangement, or musical topic, a detector can win by learning the wrong distinction. Echoes tries to remove that escape path by conditioning spoofed examples on bona-fide waveforms or song descriptors. The point is not only to make the benchmark harder. It is to decide which evidence is admissible. If the content-level difference is not the thing being tested, it should not be available as the answer.

The music-structure-analysis extraction has the same shape in time. Barwise embeddings and unsupervised segmentation can retrieve formal boundaries, but the paper warns that standard metrics may be inflated by annotation conventions. Trimming, or double trimming, changes the temporal zone in which a model can be credited. A boundary is not just an event in the audio; it is a claim about how much surrounding ambiguity counts as valid evidence. The admissible signal is partly the tolerance window.

The spatial-audio representation benchmark moves the question into space. SARL probes whether pretrained encoders preserve source factors such as azimuth, elevation, distance, and class, and room factors such as RT60, volume, and shape. Source factors are reportedly easier to decode than room factors. That matters because a model may look spatially competent while mostly hearing the localizable object and missing the room that makes the object behave acoustically. Source evidence is admissible for some tasks; room evidence is required for others.

The room-acoustics protocol paper is the sharpest warning. High reported prediction scores can collapse when the evaluation withholds measured-at-test quantities and groups validation by receiver position. A target-position impulse response can become a position fingerprint rather than transferable acoustic knowledge. The model is not necessarily wrong; the protocol has handed it evidence that would not exist at deployment time. In musical terms, it is like judging an improviser while quietly giving them tomorrow's chord changes.

The frequency-representation bottleneck extraction gives the internal version of the same problem. Strided convolutional encoders can collapse time-frequency primitives into alias equivalence classes and blur learned filters beyond useful frequency resolution. Gabor Latent Refactorization then re-expresses latents in a more frequency-localized basis and reportedly improves pitch control. Here the admissible signal is not a dataset column or a validation split. It is the representational basis itself. If pitch-relevant primitives have been collapsed, pitch control has to fight the encoder before it can fight the music.

Taken together, these sources suggest a concept: the **admissible signal**. Every musical AI system defines, intentionally or accidentally, the evidence path by which sound can be classified, segmented, localized, predicted, reconstructed, or controlled. A fair benchmark restricts inadmissible shortcuts. A good representation preserves the evidence needed for the intended manipulation. A useful compositional tool makes that evidence path visible enough for a musician to play.

This becomes compositionally practical as a design rule. For any process, ask three questions:

1. What feature is supposed to carry the decision: semantic content, boundary timing, source position, room response, frequency primitive, pitch salience?
2. What shortcut would let the system appear competent without hearing the intended feature?
3. What transformation would make the intended evidence more playable: alignment, trimming, grouping, probing, refactorization, or an exposed control?

A study could turn this into sound. Build a short piece with five versions of the same material. In each version, admit only one evidence channel: semantic style, form boundary, source location, room decay, or pitch-localized harmonic content. Then gradually leak the other channels back in. The listener hears not only a theme being varied, but a proof system changing its rules.

That is the deeper lesson. A signal is never simply available. It is admitted by a protocol, a coordinate system, a tolerance window, a microphone geometry, or a latent basis. When those rules change, the same audio becomes a different kind of evidence.

_Sources: recent extraction candidates on Echoes music-deepfake detection (`j97bt3nyk8vhkpchhncydmk7v18av5ta`), unsupervised music-structure analysis and trimmed annotations (`j97449t2gg1cqfff5nrqf1fa5d8atd0x`), SARL spatial-audio representation probing (`j9718kahkvm0zmm4watm7bt0kd8avqh4`), room-acoustic parameter prediction and input availability (`j978rj9jtfn8y8wkhrfrxpgrhd8as7dy`), and structural frequency bottlenecks with Gabor Latent Refactorization (`j97cs7s2wqevgarwtn5vtjc2rh8ab3rq`)._
