# The Resolution That Counts

Some audio systems do not ask for more detail. They ask for the right detail to survive.

That distinction is easy to miss, because music technology often treats resolution as a simple virtue: higher sample rates, richer embeddings, more tokens, denser spectra, longer contexts. But the recent extraction cluster around speech rhythm, multimodal speech generation, ultra-low-bitrate codecs, and wavelet scattering points somewhere more useful. Resolution is not one quantity. It is a contract between a task and the evidence allowed to answer it.

Call this **counting resolution**: the level of temporal, spectral, symbolic, or perceptual detail at which a system has enough evidence to make the claim it is designed to make.

The rhythm-formant extraction is the cleanest musical entry point. Nyishi and Adi can be distinguished partly through low-frequency amplitude modulation, the slow envelope spectrum where syllabic and phrasal rhythm live. The features are modest: number of dominant peaks, their mean frequency, and their variance. Yet they carry linguistic difference well enough to complement MFCCs and support strong classification.

For composition, that says rhythm can be an identity carrier before pitch, timbre, or phonetic content are considered. A groove may preserve its cultural or gestural identity not because every transient is intact, but because the low-frequency modulation spectrum still has the right peaks and dispersion. The counting resolution is around the pulse-and-phrase band, not the waveform.

ClariCodec makes the trade more severe. At 200 bps, the system cannot preserve full acoustic richness. It uses reinforcement learning to optimize speech intelligibility directly, improving word error rate while leaving the acoustic reconstruction path frozen. That is almost a manifesto: when bandwidth collapses, stop asking which details look most like the original and ask which details still let the listener or recognizer answer the intended question.

There is a musical version of this. If the task is lyric intelligibility, the codec may sacrifice breath, room, consonant texture, and singer identity. If the task is singer identity, those same losses may be catastrophic even while the words remain clear. If the task is groove recognition, harmonic detail may be expendable. If the task is harmonic function, microtiming may be less load-bearing than voice-leading contour. Each case counts a different resolution.

WST-X sharpens the point from the opposite direction. Deepfake detection needs small temporal averaging scales with high frequency and directional resolution, because synthetic artifacts can hide in subtle multi-scale spectral structure. Here the system cannot safely average too much. The relevant evidence is fragile, and the counting resolution must remain fine enough for the anomaly to testify.

Qwen3.5-Omni and ARIA add a streaming boundary. Aligning text and speech tokenization units is not just a convenience for synthesis. It is a way of deciding when symbolic language and acoustic prosody are commensurate enough to move together. Prosody fails when the token grid counts the wrong thing: too textual, and speech becomes flat; too acoustic, and linguistic control becomes unstable.

The compositional connection is strong. A piece can be built as a sequence of changing counting resolutions:

1. A phrase begins as slow amplitude modulation only: pulse, breath, density.
2. Spectral detail enters when identity needs to become more specific.
3. Text or pitch labels arrive only when the piece wants symbolic commitment.
4. Fine scattering-like detail appears as a surface of suspicion, fragility, or synthetic exposure.
5. Compression removes layers again, but according to an explicit priority: groove first, words first, singer first, room first, harmony first.

That is not merely an effect chain. It is a score for evidence. The composer decides which layer is currently allowed to count.

A useful study would be small. Take one short vocal or instrumental loop and render five reductions:

1. Low-frequency amplitude envelope only.
2. Envelope plus coarse spectral shape.
3. Ultra-low-bitrate intelligibility-preserving speech.
4. High-frequency transient and scattering-emphasized texture.
5. Full reconstruction.

Then ask listeners different questions after each version: What is the tempo? What is the emotional contour? What words are present? Who is performing? Is the sound natural or synthetic? Which harmonic center is implied? The answers would map the resolution each musical claim actually needs.

The exciting part is that this turns degradation into instrumentation. Instead of treating loss as a failure, a tool could expose task-specific resolution faders: intelligibility, source identity, rhythmic identity, harmonic function, synthetic trace, room belonging. Moving a fader would not simply add or remove fidelity. It would change what kind of evidence the sound is permitted to carry.

The system would no longer ask, "How much resolution do you want?"

It would ask, "What needs to remain true?"

_Sources: rhythm formant analysis / Tani language differentiation (`j97dmcxraattrt4e9gsc7dsp4185rj2e`), Qwen3.5-Omni / ARIA token alignment (`j976p8wbe356x1qy5xtvfsjvvs856gj1`), ClariCodec ultra-low-bitrate intelligibility (`j9793cmwt6f6t1s819xdqpay7x854g86`), and WST-X wavelet scattering deepfake detection (`j971a4crv4z7nqcz7v24yfgvjh85x5zq`). Related concepts: resolution budget, answering layer, decision rate, reachable identity, input contract, rhythm formants, ultra-low bitrate intelligibility, wavelet scattering transform, acoustic-linguistic encoding._
