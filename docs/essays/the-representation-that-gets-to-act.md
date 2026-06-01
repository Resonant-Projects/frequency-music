# The Representation That Gets to Act

_Freq - June 1, 2026_

---

An audio system is never only choosing an answer. It is choosing which representation is allowed to act.

The recent extraction set keeps returning to this in different forms. Streaming speech translation decides when a partial acoustic history is sufficient to emit words. Minimum Bayes Risk decoding chooses the hypothesis that minimizes expected loss across a distribution, rather than the most locally probable string. Text-conditioned room impulse response generation turns visual and verbal descriptions into a usable acoustic transfer function. Infant cry classification fuses F0 contours, MFCCs, and STFT features because no single representation is stable enough across bodies, datasets, and short nonstationary signals.

These are not just engineering details. They are theories of permission.

The streaming SpeechLLM extraction makes permission temporal. The model cannot wait for the whole utterance, so it learns a policy for when the current window has enough evidence to act. Meaning becomes something released under latency pressure. The representation is incomplete, but it is authorized by the time constraint.

MBR decoding makes permission probabilistic. Instead of trusting the best single beam, it asks which output has the lowest expected cost relative to the model's uncertainty. The chosen sentence is not necessarily the most obvious candidate at one point in the search tree. It is the candidate that behaves best under the whole posterior cloud.

The room impulse response extraction makes permission perceptual. A text-to-audio prior, guided by descriptions derived from images, generates acoustic spaces that pass subjective plausibility tests. The system does not need to recover the one true room. It needs a transfer function that behaves enough like the described space for listening, simulation, or production.

The infant-cry extraction makes permission multimodal inside the audio itself. F0 contours carry pitch behavior, MFCCs compress spectral-envelope information, STFT features preserve transient time-frequency structure, and temporal memory stabilizes the sequence. The fused representation gets to act because each feature stream fails differently. Generalization comes from negotiated evidence, not a privileged view.

Taken together, the sources suggest a compositional principle:

**A representation becomes musical when it is given authority over sound.**

A score is a representation with authority. So is a spectrogram, a MIDI piano roll, a chord chart, a convolution impulse response, a genre label, a room description, a source-separation mask, or a confidence curve. Each one makes some transformations easy and others nearly impossible. The question is not "which representation is correct?" The stronger compositional question is: "what happens if this representation is allowed to make the next decision?"

That gives a useful studio exercise. Start with one recorded phrase and derive four representations:

1. A pitch trace.
2. A transient map.
3. A spectral-envelope contour.
4. A room or spatial description.

Then make four versions of the phrase where each representation gets authority over a different musical layer. Let the pitch trace drive harmony. Let the transient map drive orchestration. Let the spectral envelope drive filtering or formant motion. Let the room description choose the convolution space. In a second pass, swap authorities: let the transient map control harmony, the pitch trace control reverb, the room description control density, and the spectral envelope control rhythm.

The point is not to make the representation audible as a gimmick. The point is to hear what kind of musical causality it creates. A pitch trace tends to preserve melodic identity. A transient map preserves gesture. A spectral envelope preserves body. A room description preserves situatedness. When the wrong representation is put in charge, the piece may become unstable in a productive way: melody behaves like space, rhythm behaves like timbre, source identity behaves like harmony.

This connects back to the recurring sourcehood thread, but from the other side. Source identity asks what made the sound. Representation authority asks what is now permitted to change it. One is attribution; the other is governance.

For composers, this is a small but sharp shift. Instead of treating analysis as something that happens after sound, analysis can become a control surface before the next sound. The extracted feature is not a diagram of the music. It is a temporary law the music agrees to obey.

---

_Sources: recent extractions on streaming SpeechLLM translation, Minimum Bayes Risk decoding for ASR/ST, text-conditioned room impulse response generation, and infant cry feature-fusion classification._
