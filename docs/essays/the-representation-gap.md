# The Representation Gap

*How musical knowledge lives — and dies — in translation between forms.*

---

## The Problem Nobody Names

Every time you describe a melody in words, something vanishes. Every time you notate a performance, something else disappears. And every time you compress audio into tokens, you're making a bet about what matters and what doesn't.

This isn't a new problem — it's as old as musical notation itself. But recent research has sharpened the question into something precise and measurable: **what does each representation of music actually preserve?**

Three recent papers, arriving from completely different directions, converge on the same uncomfortable answer: we don't have a representation that captures everything, and the ones we default to may be systematically wrong about what matters.

## Audio Knows More Than Text

The most striking result comes from research on speech-enabled language models (audio-LLMs). When given conflicting audio and text inputs, these models overwhelmingly trust the text — even when audio-only accuracy (97.2%) exceeds text-cascade accuracy (93.9%). The researchers call this "text dominance," and they trace it not to information quality but to **arbitration accessibility**: the model finds it easier to reason over text because that's what its language backbone was trained on.

The implications for music are immediate. If a model processing a recording alongside its textual description will default to the text, then all the information that lives *only* in the audio — timbral nuance, micro-timing, the grain of a voice, the exact spectral envelope of a room — gets systematically downweighted. The representation that's easier to reason about wins, regardless of whether it's the one that captures more.

This is a formal version of something musicians have always known intuitively: the score isn't the music.

## Notation Needs Tools

Coming from the opposite direction, the CSyMR benchmark asks what happens when you try to reason about music from symbolic notation alone. The answer: large language models struggle, even with notation right in front of them. They can't reliably chain together the multiple analytical steps needed to answer questions like "does the second theme modulate to the dominant before or after the development section begins?"

But here's the twist: augmenting the LLM with deterministic symbolic analysis tools — essentially giving it music21 functions to call — improves accuracy by 5–7%. The notation *contains* the information, but the model can't reliably extract it through language-based reasoning alone. It needs domain-specific computational tools to make the implicit explicit.

This mirrors the audio-text finding in an unexpected way. In both cases, raw language-model reasoning hits a wall when musical structure gets complex. The solution in one case is to preserve the richer modality (audio over text); in the other, it's to augment reasoning with tools designed for the specific representational format (symbolic analysis over pure LLM inference). The common principle: **don't force musical knowledge through the bottleneck of general-purpose text reasoning.**

## Compression as Composition

Neural audio codecs add a third angle. Originally designed for audio compression — reducing bitrate while preserving perceptual quality — these systems turned out to double as the front-end for language-model-based speech synthesis. The same codec that compresses a recording can generate new speech from scratch.

This dual identity creates a philosophical puzzle that the deepfake detection community is grappling with: is codec-resynthesized audio "real" or "fake"? It passed through the same mathematical transformation in both cases. The bits are processed identically whether the goal is compression or generation.

But the musical implications go deeper. A neural codec is, at its core, a learned theory about what matters in audio. Its latent space is a compressed representation that preserves whatever the training process decided was important for reconstruction. When that same latent space becomes the vocabulary for *generating* audio, the compression assumptions become compositional assumptions.

What the codec throws away during compression, it can never generate during synthesis. The representation defines the boundary of the possible.

## The Map Is Not the Territory (But Which Map?)

Each representation is a lossy projection:

- **Audio waveform**: captures everything physical, but makes harmonic structure, form, and intentionality implicit.
- **Symbolic notation**: makes pitch, rhythm, and form explicit, but discards timbre, micro-timing, dynamics in their continuous reality, and everything that makes a performance human.
- **Text description**: makes high-level structure and intent accessible to language-based reasoning, but collapses the vast majority of acoustic and structural detail.
- **Codec tokens**: capture perceptually important features determined by training data, but their biases are opaque and they conflate compression with generation.

No single representation is adequate. But what's new — what these papers collectively reveal — is that our AI systems have strong, measurable, and often hidden preferences for which representation they trust. And those preferences don't align with information content.

## Toward Multi-Resolution Musical Thought

The way forward isn't to find the One True Representation. It's to build systems (and habits of thought) that can move fluently between representations, knowing what each one preserves and destroys.

A composer working with a DAW already does this unconsciously: they hear the audio, read the MIDI piano roll, check the notation, and hold a conceptual model of the form in their head simultaneously. The richness of musical thought comes from this multi-resolution perspective.

The Pythagorean tradition held that the fundamental structure of reality was music-like — that harmony, not particles, was the irreducible substrate. Whether or not you go that far, there's something right about the intuition that music resists reduction to any single formal system. It lives in the gaps between representations, in the surplus that every translation leaves behind.

The representation gap isn't a problem to solve. It's a feature of music's richness — and a reminder that any single lens, however powerful, is still just one way of seeing.

---

*Sources: "Text Dominance in Audio-LLMs" (modality arbitration in multimodal models), "CSyMR-Bench" (compositional symbolic music reasoning), "Neural Audio Codecs and Deepfake Detection" (labeling ambiguity in codec-resynthesized audio). All preprint-level evidence.*
