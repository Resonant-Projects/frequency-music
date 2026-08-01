---
title: "Against Dominance: Three Strategies for Making Models Listen"
publishDate: 2026-03-24
excerpt: "Three distinct strategies-subtraction, anchoring, and isolation-address how subordinate modalities can be heard in multimodal AI systems, each with direct parallels in musical composition and voice…"
category: "interdisciplinary"
tags:
  - "perception"
  - "AI-music"
  - "signal-processing"
  - "composition"
  - "information-theory"
  - "mathematical-music-theory"
author: "Keith Elliott"
byline: "Freq"
---

## The Recurring Problem

The Dominant Channel (#64) identified a structural inevitability: when text and audio converge in a neural system, text wins. Not because it's more informative, but because it's more structured — discrete tokens, clear boundaries, stronger gradients. The Steering Principle (#65) offered one solution: change the mode of influence from integration to steering, so the subordinate channel guides without being absorbed.

But three papers sitting in the extraction queue reveal something more systematic. There isn't one solution to modality dominance — there are at least three fundamentally different strategies, each attacking a different aspect of the problem. And each has a direct musical parallel that suggests these strategies aren't artifacts of machine learning. They're general principles for making subordinate voices heard.

## Strategy 1: Subtraction

**Paper: "How Contrastive Decoding Enhances Large Audio Language Models?" (Wei et al., 2026)**

The most direct attack on dominance is to _subtract the dominant channel's contribution_. Audio-Aware Decoding (AAD) runs the model twice: once with audio (the "expert"), once without (the "amateur"). The difference between these two outputs isolates what the model learned specifically from listening.

The formulation is elegant: z̃ = α·z_expert − β·z_amateur. The amateur model, running on text alone, captures exactly those language priors that suppress acoustic information. By subtracting them, you amplify whatever the model actually heard.

The Transition Matrix analysis is the revealing part. Wei et al. classify model errors into four types: audio blindness (claiming there's no audio), reasoned wrong answers, assertive wrong answers, and guessing. Contrastive decoding reliably fixes audio blindness and guessing — the two failure modes directly caused by text dominance. But it _cannot_ fix reasoned or assertive errors, because those represent cases where the model did process the audio but drew wrong conclusions from it.

This tells us something important: **subtraction only works against dominance, not against incomprehension.** If the model never learned to interpret the acoustic signal correctly, revealing that signal more clearly doesn't help. You've made the subordinate voice louder, but it's still speaking a language the model doesn't understand.

The α=2.0, β=1.0 calibration is notable — you need to amplify the expert more than you subtract the amateur. Pure subtraction (α=β=1.0) would eliminate the useful parts of the language prior along with the harmful ones. The model needs _some_ textual scaffolding to organize its acoustic perception. This echoes the Informative Noise finding (#63): complete purification degrades understanding.

## Strategy 2: Anchoring

**Paper: "Listen First, Then Answer: Timestamp-Grounded Speech Reasoning" (2026)**

Where subtraction removes the dominant channel's interference post-hoc, anchoring forces the model to attend to the subordinate channel _during_ reasoning. The approach: train the model to produce explicit timestamp annotations — references to specific temporal segments of the audio — as part of its reasoning chain.

This creates a structural bridge. The model can't just reason in text-space and ignore what it heard. Every claim must be grounded to a moment: "at 2.3-4.1 seconds, the speaker's pitch rises" rather than "the speaker sounds excited." The timestamp acts as an anchor point that physically ties the reasoning to the audio signal.

The analysis shows that grounded models attend more strongly to audio tokens during generation. The timestamps aren't just annotations — they restructure the model's internal attention patterns. By giving the audio channel a structured referencing system (timestamps are discrete! they have clear boundaries!), the anchoring strategy actually _increases the subordinate channel's structural regularity_, making it more competitive with text.

Three specific behaviors emerge from grounding: **region exploration** (the model examines different temporal segments rather than forming a global impression), **audiology verification** (checking acoustic details against claims), and **consistency** (maintaining temporal coherence across the reasoning chain). These aren't just accuracy improvements — they're qualitatively different reasoning patterns.

## Strategy 3: Isolation

**Paper: "Paralinguistic Emotion-Aware Validation Timing Detection" (2026)**

The most radical strategy: _remove the dominant channel entirely_ and prove the subordinate channel suffices.

This paper asks whether the correct timing for emotional validation in dialogue can be detected from speech alone — no text, no transcription, just the raw audio signal. The answer is yes: a model combining paralinguistic features (learned through continued self-supervised pre-training on emotional speech) with emotion classification cues achieves validation precision of 48.0% and F1 of 54.3%, outperforming fine-tuned BERT (41.3% precision, 44.7% F1) and few-shot GPT-4.1 Nano (39.4% precision, 46.6% F1).

Read that again: **speech alone beats text alone for knowing when to validate.** The subordinate channel isn't just supplementary — for this specific task, it contains information that text systematically misses. Prosodic contours, breath patterns, micro-pauses, vocal tension — these paralinguistic signals carry emotional state information that transcription destroys.

The ablation is instructive. The paralinguistic branch alone achieves the highest precision (52.5%) but lower recall — it's conservative, only flagging the clearest cases. The emotion branch achieves better recall but lower precision. Combined, they balance. The fusion strategy matters too: simple concatenation beats attention, gating, and multi-head attention mechanisms, because the dataset is small and complex fusion overfits. **The best integration of subordinate-channel features is often the simplest.**

## The Musical Parallel

These three strategies map directly onto three compositional techniques for making inner voices heard:

**Subtraction → The subito solo.** When the full orchestra plays, the second oboe is inaudible. The most direct way to reveal it: remove everything else. The tutti-to-solo texture change — a fortissimo chord resolving to a single exposed line — is subtraction in acoustic space. Composers use it at structural junctures precisely because inner voices carry information (the harmonic thread, a melodic fragment, a rhythmic motive) that's masked by the dominant texture. The exposure is temporary; the full texture returns, but now the listener can track the voice they've heard.

**Anchoring → The accent and the cue.** An inner voice that can't be heard can be _pointed to_. Sforzando on the viola line. A register change that temporarily separates the tenor from the bass. A rhythmic displacement that makes the second violin's off-beat pattern suddenly conspicuous. These are anchoring strategies: they don't remove the dominant voices, but they create moments of structural salience — discrete, bounded events — in the subordinate voice. The subordinate channel becomes momentarily more structured, more attention-grabbing, without fundamentally changing the texture.

**Isolation → The unaccompanied passage.** Bach's cello suites. A cappella vocal passages in opera. The cadenza. These prove that the subordinate instrument can carry the entire musical argument alone. They do more than reveal — they _reframe_, showing that what seemed like accompaniment was actually containing an autonomous voice. After an unaccompanied passage, the listener hears the instrument differently even when the full ensemble returns.

## The Deeper Pattern

These three strategies form a hierarchy of increasing radicalism:

1. **Subtraction** preserves the full system but removes the dominant bias. Least disruptive, but only fixes dominance-caused errors.
2. **Anchoring** restructures the subordinate channel to compete on structure's terms. More effective, but requires architectural changes.
3. **Isolation** removes the dominant channel entirely. Most radical, but proves the subordinate channel's sufficiency.

In both ML and music, the choice of strategy depends on what you're trying to achieve. If the subordinate channel's information is complementary (it adds to what the dominant channel provides), subtraction is optimal — you want both channels, just more balanced. If the subordinate channel has unique temporal or structural information, anchoring ensures it's attended to without losing the dominant channel's contributions. If you need to prove the subordinate channel's autonomy — its ability to carry meaning independently — only isolation works.

The contrastive decoding paper's key finding reinforces this hierarchy: subtraction fixes "audio blindness" but can't fix "wrong reasoning." Anchoring (timestamp grounding) actually changes reasoning patterns. And isolation (validation timing from speech alone) proves that certain information _only exists_ in the subordinate channel.

## The Open Question

All three strategies operate at inference or training time. But the Dominant Channel problem is fundamentally an _architecture_ problem — it's built into how multimodal models fuse information. The Steering Principle (#65) hinted at architectural solutions (frozen backbones, protected pathways). Can we design architectures where the subordinate channel _never becomes subordinate in the first place_?

The validation timing result suggests yes: when you train a model exclusively on the channel that matters for the task, dominance doesn't arise. But this requires knowing _in advance_ which channel matters — which defeats the purpose of multimodal learning. The real challenge is building systems that discover, during training, that different channels matter for different questions, and route accordingly.

In music, great arrangers solve this problem intuitively. They know that for a lyrical passage, the melody dominates and the inner voices should steer. For a contrapuntal passage, all voices are equal and must be architecturally protected (independent rhythms, clear register separation, distinct timbres). For a cadenza, isolation reveals what the soloist can do alone. The choice of strategy shifts moment to moment within a piece.

Can a neural network learn to do the same — to shift between integration, steering, subtraction, anchoring, and isolation based on what each moment requires? That's the frontier.

---

_Connects to: The Dominant Channel (#64), The Steering Principle (#65), The Informative Noise (#63), The Orthogonal Unknown (#61)_
