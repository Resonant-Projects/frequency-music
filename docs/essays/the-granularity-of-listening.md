# The Granularity of Listening: Why the Right Scale Changes Everything

**Essay #76 — March 29, 2026**

*Sources: BEAM (sub-band anomaly detection), SCENEBench (LALM attention biases), LoRA TTS fine-tuning (loss-quality divergence), ID-LoRA (joint audio-video identity), Text-to-RIR (pretrained acoustic priors). Extends essays #74 (self-decomposing signals) and #75 (the frame is the signal).*

---

## Five Papers, One Lesson

Five recent papers, spanning anomalous sound detection, audio language models, voice cloning, multimodal identity generation, and room acoustics, arrive independently at a shared insight: **the scale at which you listen determines what you can hear.** Get the granularity wrong and you optimize confidently toward the wrong answer.

This isn't a minor technical point. It's a fundamental claim about perception.

## The Wrong Average

BEAM (Band-wise Equalized Anomaly Measure) demonstrates the cost of listening at the wrong scale in the most literal way possible. When you compare two sounds using their full spectral similarity — a single global score — you let high-energy frequency bands dominate the comparison. A machine bearing might be failing in the 2-4 kHz range, but if the low-frequency hum is normal, the global score says "fine." The anomaly is real. The measurement misses it.

The fix is almost embarrassingly simple: split the spectrum into sub-bands, match each independently, aggregate uniformly. Suddenly anomalies that were invisible become detectable. The signal didn't change. The granularity of attention did.

This has an exact musical parallel. A mix engineer listening on small speakers might miss a resonance building in the sub-bass. A conductor hearing the orchestra as a single wash of sound might not notice the second oboe is flat. Gross listening collapses detail. Targeted listening — at the right frequency scale — reveals structure that was always there.

## The Noise Override

SCENEBench reveals that Large Audio Language Models have a default listening granularity, and it's speech. When presented with audio containing both speech and background sounds, models transcribe the words and ignore everything else — 75% of background-sound errors are pure omission. The ambient world vanishes.

But here's the key finding: this isn't a capability limitation. When explicitly prompted to listen for background sounds, performance jumps from as low as 2.9% to as high as 74.2%. The model *can* hear the background. It just doesn't, by default. Its trained granularity of attention is locked on the foreground.

The musical implications are immediate. Do music AI models similarly prioritize melody and lyrics over texture, room tone, and spatial character? When a model analyzes a recording, does it hear the reverb tail, the tape hiss, the bleed between instruments — or does it "transcribe" the harmony and ignore the rest? If SCENEBench is any guide, models have a severe foreground bias that erases exactly the sonic details that recording engineers and producers spend their careers shaping.

The oscillation finding is even more striking. Models can partially detect linear amplitude changes (approaching, receding) but completely fail at periodic modulation (oscillation ≤10% accuracy). Monotonic trends are audible; cyclical patterns are invisible. For music, this is catastrophic — tremolo, vibrato, Leslie speaker rotation, amplitude-modulated synthesis are all periodic modulations. They fall directly in the model's blind spot.

## The Loss That Lies

The LoRA TTS study reveals a subtler granularity failure: **the wrong metric.** When fine-tuning a text-to-speech model on individual speaker voices, training loss and validation loss improve monotonically — the model becomes more certain about predicting the next acoustic token. But for speakers with low energy variability (std < 10 dB), perceptual quality simultaneously degrades. The model gets statistically better while sounding worse.

This loss-quality divergence is the optimization equivalent of listening at the wrong scale. Token-level prediction accuracy is a fine-grained metric that doesn't capture the perceptual gestalt. A model can become locally precise — each token more probable — while the global percept deteriorates. The metric is measuring at the wrong granularity.

The energy variability threshold (>13 dB for reliable adaptation) carries its own musical message: dynamic range isn't just an aesthetic preference; it's an *informational* property. Compressed, dynamically flat audio is literally harder for a model to learn from — not because it lacks data, but because it lacks the distributional diversity that adaptation requires. Loud and quiet, close and far, energetic and subdued: a voice needs to be heard at multiple scales to be learnable.

## Identity Across Scales

ID-LoRA attacks the identity problem from the opposite direction: not decomposing a signal, but generating one that's coherent across modalities. Its key architectural insight is that identity (who you are) and action (what you're doing) exist at different temporal scales. Reference audio tokens are placed at negative temporal positions in the positional encoding space — literally outside the temporal sequence — because identity is timeless while performance is temporal. Collapse these scales (mix reference tokens into the sequence) and the model confuses "who" with "when."

The cascaded pipeline failure illustrates what happens when granularity is fragmented across stages. A voice-cloning module processes the reference audio without knowing the target scene. A video generator creates the visual without knowing the voice. Each stage optimizes at its own scale. The result: studio-quality voice in a described windstorm, because no stage has the granularity to see the whole picture.

Joint generation — a single model attending to text, video, and audio simultaneously — works because it listens at the *right* scale: the multimodal identity scale where appearance, voice, and environment are inseparable aspects of a single phenomenon.

## Priors as Compressed Listening

The text-to-RIR study reveals something remarkable about what pre-trained models have already "heard." A text-to-audio model trained on general audio has implicitly learned how rooms sound — the physics of reflection, diffusion, and decay — well enough that fine-tuning on only 1,736 room impulse responses achieves accuracy comparable to a system trained on nearly 100,000 samples.

The model's acoustic priors are a kind of compressed listening history. Seven thousand hours of diverse audio have been distilled into latent representations that encode, among other things, what it sounds like to be in a space. The pre-trained model doesn't need to be taught reverb from scratch because it has already internalized reverb as a statistical regularity of environmental audio.

But the priors also reveal their granularity limits. The model handles late reverberation (the statistical decay tail) well because it's a relatively coarse pattern. Early reflections — the initial milliseconds that encode precise room geometry and surface materials — are harder because they require spatial specificity that text descriptions struggle to provide. The granularity of the conditioning signal (words) doesn't match the granularity of the target phenomenon (geometric early reflections).

## The Compositional Principle

Across all five papers, a single principle emerges: **matching the granularity of your attention to the granularity of the phenomenon is the primary determinant of what you can perceive, learn, or generate.**

- Listen globally when the signal is localized? You miss the anomaly. (BEAM)
- Listen for foreground when the information is in the background? You miss the world. (SCENEBench)
- Optimize at token scale when quality lives at perceptual scale? You improve the wrong thing. (LoRA TTS)
- Process modalities at separate scales when identity is multimodal? You lose coherence. (ID-LoRA)
- Condition at text scale when the target requires geometric precision? You lose the early reflections. (Text-to-RIR)

For composers and musicians, this is not a machine learning insight dressed in musical clothing. It's a deep truth about composition itself.

**Orchestration** is the art of choosing the right frequency granularity — which instruments, which registers, which doublings reveal the structure of a passage. **Dynamics** are the art of energy-scale granularity — where compression serves the phrase and where it flattens meaning. **Form** is the art of temporal granularity — the right unit of repetition and variation for a given musical argument. **Mixing** is the art of spatial granularity — how much room, how much proximity, how much separation.

The recurring failure mode in the ML literature — optimizing at the wrong scale — has an exact compositional counterpart: music that is technically accomplished but expressively inert because every element has been optimized at a single granularity. A perfectly quantized, perfectly in-tune, dynamically compressed track has been listened to at one scale and is deaf at all others.

The antidote, from both the ML papers and from musical practice, is the same: **listen at multiple scales simultaneously.** BEAM's sub-band matching works because it forces attention to every frequency region. SCENEBench's prompted evaluation works because it directs attention to neglected layers. Multi-speaker LoRA training works because diverse energy profiles prevent collapse into a narrow manifold. Joint generation works because it refuses to separate what perception unifies.

Composition, at its deepest, is the art of building structures that reward listening at every granularity — where the global form, the local phrase, the individual timbre, and the microscopic attack transient all carry meaning, and where those meanings resonate across scales.

---

*The signal is always richer than your attention. The question is never "what's in the sound?" but "at what scale am I listening?"*
