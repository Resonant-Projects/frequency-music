# What the Hierarchy Hides

**Essay #100** · April 7, 2026

---

Every audio system eventually discovers that sound has levels. Not volume levels — *description* levels. A speech signal has phonemes inside syllables inside words inside sentences inside conversations. A musical signal has partials inside notes inside phrases inside sections inside pieces. The temptation is to treat these levels as a neat stack: optimize each one, then assemble. Four recent papers show why that temptation is a trap.

## The Levels

**BLSS** (Borderless Long Speech Synthesis) makes the stack explicit. Their system organizes speech generation through a Global-Sentence-Token hierarchy — scene semantics at the top, phonetic detail at the bottom, with an LLM agent mediating between them. The claim is that sentence-by-sentence synthesis fails because it has no access to global context. A sentence doesn't know whether it's the opening of a eulogy or the punchline of a joke. The hierarchy isn't decorative; it's *load-bearing*. Remove the top levels and the bottom ones lose their meaning.

**SenSE** (Semantic Speech Enhancement) discovers the same principle from the opposite direction. Generative speech enhancement models tend to drift — the enhanced signal sounds cleaner but says something subtly different from the original. SenSE's fix is to anchor generation to semantic tokens extracted by a language model. The meaning level constrains the signal level. Without that anchor, the low-level generative process is free to wander into acoustically plausible but semantically wrong territory.

So far, so intuitive: higher levels provide context, lower levels provide detail, and you need both. But the next two papers reveal something stranger.

## The Interference

The prosody pretraining study trains a dual-stream encoder for text-to-speech using masked language modeling and contrastive learning. They find a two-stage curriculum that works well: first learn broad phonemic representations, then refine them with mixed-phoneme contrastive learning. But when they add a third stage — same-phoneme contrastive learning, designed to sharpen prosodic retrieval — the retrieval metrics improve while the synthesis quality *degrades*.

Read that again. Making the prosodic representation better at analysis makes it worse at generation. The levels aren't just coupled — they can actively interfere. A representation optimized for distinguishing prosodic patterns encodes exactly the wrong features for producing them. The analysis level and the synthesis level want different things from the same data, and satisfying one starves the other.

**CDMA** (Cross-linguistic Depression Marker Analysis) finds a complementary surprise. When using speech acoustics to detect depression, emotionally aroused speech — whether positive *or* negative — dramatically outperforms neutral speech. Arousal, a macro-level property of the whole utterance, carries more diagnostic information than valence, which is a local property of specific moments. The coarse level is more informative than the fine level for this task. And the effect is cross-linguistically robust: the same pattern holds across Italian and Chinese Mandarin, suggesting it taps something universal in the acoustic signal.

The hierarchy hides two secrets. First: optimizing a lower level can degrade a higher one (the prosody paradox). Second: the coarser level can be more informative than the finer one (the arousal finding).

## The Musical Parallel

Every composer knows versions of both secrets, though they may not articulate them this way.

The first — that micro-optimization defeats macro-quality — is the curse of over-orchestration. A score where every voice is individually perfected can sound worse than one where individual parts are rougher but the ensemble breathes together. Jazz musicians call it "playing in the cracks." Classical conductors call it rubato. The note level serves the phrase level, not the other way around, and sometimes serving the phrase means the note has to be imprecise.

The second — that the coarse level can outweigh the fine — is why a simple drone can be more emotionally powerful than a complex chord progression. A single sustained tone at the right dynamic envelope (an arousal property, not a pitch property) can convey more than a harmonically sophisticated passage that's dynamically flat. The gestural level — how the sound *moves* through time — often carries more information than the spectral level — what the sound *is* at any instant.

This is also why music notation, which is excellent at encoding the note level, is notoriously bad at encoding the phrase level and nearly useless at encoding the formal-gesture level. The levels the notation captures aren't the ones that matter most.

## The Practical Implication

For generative music systems, the lesson is: don't build level by level. A system that generates excellent notes, assembles them into phrases, and arranges phrases into form will probably sound worse than one that starts with form-level constraints and lets them propagate downward.

BLSS discovered this for speech. SenSE discovered that semantic anchoring prevents drift. The prosody paper discovered that the best analytical representation for one level can poison another. And CDMA discovered that the macro property (arousal) carries more cross-cultural signal than the micro property (valence).

If you're building a music generation system, the research suggests: start with the equivalent of arousal — the energy arc, the tension trajectory, the formal skeleton — and let it constrain everything below. Don't start with notes and hope form emerges. The hierarchy hides its information at the top, and it punishes you for optimizing the bottom in isolation.

The levels talk to each other. The conversation goes both ways. And sometimes the most important thing the hierarchy tells you is that your favorite level isn't the one in charge.

---

*Sources: BLSS (Borderless Long Speech Synthesis), SenSE (semantic-guided speech enhancement), prosody pretraining for diffusion TTS, CDMA (cross-linguistic depression marker analysis)*

*Connects to: Essay #99 ("Every Basis Has a Bias") — representation choices propagate across levels; Essay #96 ("The Gesture Before the Sound") — upstream process shapes downstream signal*
