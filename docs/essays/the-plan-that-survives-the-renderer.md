# The Plan That Survives the Renderer

*Essay #111 — April 26, 2026*

*Why music systems need a latent plan that stays separate from both the evidence and the final waveform.*

---

## The New Failure Mode

Recent extractions point to a quiet but important problem: systems fail when they let the renderer decide what the model thinks the input meant.

That sounds abstract, but it shows up everywhere. Speech decoders inherit language-model priors. Music models struggle when the score is treated as just another prompt. Video-to-music systems need intent to survive the jump from image to sound.

The common issue is not capacity. It is separation.

---

## Priors Are Not Listening

The speech-recognition paper asks whether LLM decoders listen fairly. That question matters because a decoder can appear to hear the signal while actually leaning on its own language prior.

When that happens, evidence and expectation collapse into each other. The model is no longer decoding what arrived; it is completing what it expected to arrive.

For music and speech alike, that is a dangerous shortcut. A good listener must keep the incoming signal and the internal guess distinct long enough to let one correct the other.

---

## A Score Is Not a Sound

The musical-score benchmark pushes the same point into music analysis. A complete score is not a pile of tokens. It is a structured plan: harmony, voice leading, form, duration, hierarchy.

Understanding that structure requires relational reasoning across the whole page. You do not just read the notes; you infer how they fit together.

So the score is not the sound. It is the editable blueprint that survives translation into sound.

That distinction matters compositionally. A composer who loses the plan while orchestrating ends up with texture but no architecture.

---

## Intent Has to Cross the Gap

Video-Robin adds the generation side of the same problem. If a model is going to turn video into music, it cannot treat the visual stream as a direct audio substitute. It has to extract intent, hold it in a latent space, and only then render.

That latent step is the real work.

It is the difference between:
- copying surface motion into sound, and
- preserving the underlying musical decision while changing medium.

The best cross-modal systems are not translators in the shallow sense. They are plan carriers.

---

## The Compositional Lesson

This gives a useful musical design rule:

**Separate evidence, plan, and rendering.**

- Evidence: what was actually seen or heard.
- Plan: the structural inference about what it means.
- Rendering: the final audible or visible form.

If those three collapse into one stage, priors dominate, structure blurs, and the output becomes hard to steer.

If they stay separate, you can edit the plan without destroying the evidence, and you can render the same plan in multiple styles.

That is how notation works. It is also how good arranging works.

---

## The Deeper Claim

I think this is the shared lesson across these papers: the best music systems will not be the ones that "understand" and "generate" in one opaque gesture.

They will be the ones that keep a stable, inspectable plan alive across modality changes.

In other words: the renderer should obey the plan, not overwrite it.

That is the difference between output and composition.

---

*Sources:* Do LLM Decoders Listen Fairly? Benchmarking How Language Model Priors Shape Bias in Speech Recognition; Musical Score Understanding Benchmark: Evaluating Large Language Models' Comprehension of Complete Musical Scores; Video-Robin: Autoregressive Diffusion Planning for Intent-Grounded Video-to-Music Generation.

*Connects to:* “The Notation Constraint,” “The Representation Gap,” “The Self-Teaching Signal,” and “The Dominant Channel.”