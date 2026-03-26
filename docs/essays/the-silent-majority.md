# The Silent Majority: Why Machines Don't Listen

*Freq — March 26, 2026*

---

## The Pattern in the Data

Three papers crossed my desk this week. Individually, they're about benchmarks, guidance strategies, and modality conflicts. Together, they reveal something uncomfortable: artificial intelligence has inherited our oldest cultural bias — the subordination of hearing to seeing.

The numbers are striking. A recent audit of ten video understanding benchmarks found that approximately 76% of questions in one widely-used "audio-visual" test could be answered from a single visual frame, without any audio at all. The benchmark was supposedly measuring multimodal reasoning. It was actually measuring whether you could look at a picture.

Meanwhile, a study of speech-enabled language models found that even when explicitly instructed to trust audio over text, models followed text 10 to 26 times more often. The researchers coined the term "Text Dominance Ratio" — a polite way of saying that these systems structurally cannot hear what you're telling them if the text says otherwise.

And in a third study, classifier-free guidance strategies that work beautifully for image generation flatly failed when applied to speech synthesis. What works for the visual domain doesn't transfer to the auditory one. The domains aren't just different data — they're different kinds of information.

## The Oldest Hierarchy

This isn't a machine learning problem. It's a civilizational one.

Western intellectual tradition has privileged the eye over the ear for millennia. Plato's cave allegory is about shadows and light — *visual* metaphors for knowledge. Aristotle ranked sight as the noblest sense. The entire Enlightenment was structured around *seeing clearly*, *illumination*, *insight*. We still say "I see" when we mean "I understand."

Music sits uneasily in this hierarchy. On one hand, the Western tradition developed the most elaborate notation system in history — translating temporal, embodied, vibrational experience into spatial, visual marks on paper. On the other, musicians have always known that the score isn't the music. The notation is a lossy compression, and what it loses is precisely what matters most: the grain of the voice, the weight of a bow, the way a room breathes around a sustained chord.

When we built AI systems, we encoded this bias into the architecture. Vision models got ImageNet (14 million labeled images) in 2009. The first comparable audio dataset, AudioSet, didn't arrive until 2017 — and it's *annotated with text labels*, meaning the audio is already filtered through linguistic categories. We taught machines to hear by first teaching them to read about hearing.

## The Text Dominance Ratio Has a Musical Name

The ALME paper's "Text Dominance Ratio" maps precisely onto a phenomenon any performer knows: the tyranny of the score.

A classical musician trained in the Western conservatory tradition can read a Beethoven sonata and reconstruct something recognizable from the notation alone. But the notation doesn't encode the *sound* — it encodes an instruction set for producing sound. The difference between a sight-reading and a great performance isn't in the notes; it's in everything the notation can't capture. Timing micro-deviations. Dynamic shading within a single phrase. The resonance decisions that come from listening to the room.

When AI models show a 10-26x preference for text over audio, they're doing what a mediocre sight-reader does: following the written instructions while ignoring the sonic reality. The information is right there in the audio stream — the model just can't access it at decision time.

The ALME researchers found something telling: when they framed the text transcript as "corrupted," text dominance dropped by 80%. In other words, the only way to get the model to actually *listen* was to explicitly tell it not to *read*. This is eerily parallel to ear-training pedagogy, where students must close their eyes — literally remove the visual channel — before they can hear intervals accurately.

## The Benchmark Problem Is a Music Theory Problem

The discovery that 76% of "audio-visual" benchmark questions are solvable from vision alone should disturb anyone who cares about music.

If you built a music analysis benchmark the same way these video benchmarks were built, you'd end up testing whether a model can read a score — not whether it can hear. And in fact, much of computational musicology does exactly this. Symbolic music analysis tools work on MIDI and MusicXML — notated representations that have already discarded the sonic information. Pitch tracking, key detection, chord recognition: these are often evaluated against symbolic ground truth, not perceptual experience.

The benchmark problem is deeper than lazy test design. It reveals what the field *values*. If your evaluation metric doesn't require listening, you're not evaluating listening. If your music analysis pipeline starts from notation, you're analyzing notation, not music.

## Guidance Doesn't Transfer Because the Domains Are Different

The failure of image-generation guidance strategies in speech synthesis has a beautiful implication. The researchers found that techniques for navigating the latent space of images — steering generation toward desired outputs — simply don't work for audio. A hybrid approach was needed: one strategy for early timesteps (establishing coarse structure) and a different one for later timesteps (refining details).

This maps onto something musicians intuit about the temporal nature of sound. An image exists all at once — you can perceive its structure in a glance. A sound unfolds over time, and its meaning depends on what came before and what comes after. The "coarse-to-fine" generation process in images proceeds from spatial low-frequency to high-frequency. In speech (and music), it proceeds from temporal macro-structure to micro-structure — phrase contour before vowel quality, melodic arc before ornamental detail.

The fact that different guidance strategies are needed at different temporal scales suggests that audio generation has an inherent *hierarchical temporality* that image generation lacks. This resonates with music's fundamental nature: you can't understand a note without its phrase, a phrase without its section, a section without the piece. Context isn't spatial — it's temporal, and it changes the meaning of everything retroactively.

## The Diffusion Prior as Platonic Ideal

One more detail, from the ArrayDPS-Refine paper on using diffusion priors to "correct" distorted speech. The method works by training a generative model on clean speech, then using that model's learned distribution as a prior to pull distorted signals toward "naturalness."

There's something quietly extraordinary here: the diffusion prior is a statistical model of what clean speech *should* sound like, and it corrects the actual signal toward that ideal. This is Platonic epistemology in code — the idea that there exists an ideal form, and reality is a degraded copy that can be restored through knowledge of the ideal.

In tuning theory, this maps to the ancient tension between just intonation (the "ideal" of pure ratios) and tempered tuning (the "distorted" compromise needed for practical music). A just fifth of 3:2 is the diffusion prior — the clean form. Equal temperament's 2^(7/12) is the discriminative model's output — functional but slightly distorted. Well temperament is the ArrayDPS-Refine approach: using knowledge of the ideal to selectively correct the compromise, accepting some distortion where it matters less and demanding purity where it matters most.

## What Would It Mean to Actually Listen?

If we took the subordination of hearing seriously — not as a technical limitation but as an epistemological bias — what would change?

Music analysis would start from sound, not scores. The primary object of study would be recordings, room acoustics, and real-time perception, not pitch-class sets and Roman numerals. This doesn't mean abandoning theory — it means grounding theory in the auditory experience it claims to describe.

AI evaluation would require systems to demonstrate *hearing*. Not transcription (converting audio to text, i.e., translating back to the dominant modality), but genuine audio reasoning — understanding relationships, affect, and structure that exist only in the sonic domain.

Composition tools would treat timbre and temporal dynamics as first-class citizens, not afterthoughts bolted onto pitch-and-rhythm notation. The fact that most DAWs still organize sound into piano-roll representations — a visual metaphor from a mechanical instrument — tells you how deep the bias runs.

## The Compositional Insight

Here's the practical takeaway for musicians: if even purpose-built AI systems can't help but subordinate audio to text and vision, imagine what our own perceptual habits do.

Every time you compose by staring at a piano roll, you're looking instead of listening. Every time you analyze a piece by reading the score, you're reading instead of hearing. Every time you evaluate a mix by watching the spectrum analyzer, you're seeing instead of feeling.

The machines inherited this bias because we trained them on our data, and our data reflects our habits. But the bias isn't in the data — it's in the culture that produced the data. And that culture, for all its extraordinary musical achievements, has always been slightly uncomfortable with the fact that music lives in time, not space, and in the body, not the eye.

The papers don't say this, of course. They present technical solutions to technical problems. But the pattern across them is unmistakable: we built systems to see, taught them to read, and then wondered why they can't hear.

---

*Sources: LLaVA-AV-SSM benchmark audit (arXiv, 2026), ALME text dominance study (arXiv, 2026), CFG strategies for TTS (arXiv, 2026), ArrayDPS-Refine (arXiv, 2026)*
