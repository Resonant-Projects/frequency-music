# The Resolution Budget

_Essay #183 - May 20, 2026_

## Fidelity Is Not One Thing

This batch is about a deceptively simple question: when a signal cannot preserve everything, what deserves precision?

The speech-rhythm source separates low-frequency amplitude modulation from spectral-envelope features. Rhythm formants carry macro-temporal structure; MFCC-style features carry finer phonological and spectral information. The codec source makes the pressure harsher: at 200 bps, a system can optimize for intelligibility rather than acoustic reconstruction and improve word error rate without treating all acoustic detail as equally precious. The wavelet scattering source adds another angle: subtle synthetic artifacts require small temporal averaging and high frequency/directional resolution. The important detail depends on the task.

That is the connection:

**Resolution is not a global virtue. It is a budget.**

A composer does not simply choose high fidelity or low fidelity. The useful question is where the piece spends its fidelity. Rhythm can be sharp while timbre is blurred. Contour can be intelligible while texture is sparse. Spectral microstructure can shimmer while the harmonic path stays almost static. Each choice says what the listener is being asked to follow.

## Rhythm Can Carry the Identity

The Nyishi/Adi study is valuable because it treats speech rhythm as a frequency-domain phenomenon. Low-frequency amplitude modulation, roughly the range we would recognize as pulse, phrase motion, and syllabic density, is not just surface timing. It is a measurable spectral layer with discriminative power.

For composition, that suggests a clean experiment. Keep harmony, tempo, and instrumentation constant, but vary only the low-frequency modulation profile: tremolo rate, gating density, sidechain contour, phrase-level accent dispersion. If listeners hear the versions as different dialects of the same material, the rhythm-formant layer is doing musical identity work.

The important part is not copying speech. It is borrowing the separation of scales. Macro-temporal modulation and spectral envelope are different carriers. A piece can decide which one gets the cleanest encoding.

This matters especially in dense production. We often polish timbre until the groove becomes mushy. The source points toward the opposite move: spend resolution on the modulation spectrum first, then let the spectral surface be coarser if the rhythmic identity survives.

## Intelligibility Is Not Reconstruction

ClariCodec sharpens the point. The codec is designed for ultra-low-bitrate speech communication, and its reinforcement-learning objective rewards word recognition rather than generic acoustic similarity. That distinction is compositionally fertile.

In music, reconstruction asks: does this sound like the original?

Intelligibility asks: does the listener still know what matters?

Those are not the same question. A melody can survive brutal timbral reduction if contour, attack timing, and register motion remain clear. A chord progression can survive thin voicing if functional motion and bass direction remain legible. A groove can survive narrow bandwidth if accent hierarchy and inter-onset timing remain stable.

The practical lesson is not to make everything lo-fi. It is to decide what the equivalent of word error rate is for the passage. Maybe the listener must recognize the melody. Maybe they must feel the asymmetric pulse. Maybe they must hear the harmonic route. Once that is named, fidelity can be aimed instead of sprayed everywhere.

## Alignment Has Its Own Fidelity

The Qwen3.5-Omni source describes instability in streaming speech synthesis when text and speech tokenizers do not align cleanly, and it introduces dynamic alignment to improve prosody and stability. That gives us a different kind of resolution budget: not spectral, not rhythmic, but relational.

In vocal music, the obvious analogue is lyric-to-note alignment. But the deeper analogue applies to any layered system. A drum accent and bass articulation can be individually clear yet relationally vague. A chord change and filter sweep can be high quality in isolation yet miss each other by just enough to feel unconvincing. A visual cut and musical hit can be accurate by grid time but wrong by perceived gesture.

Alignment fidelity is the precision with which layers mean together.

This is a useful corrective to purely vertical mixing. A mix can have pristine stems and poor prosody. The sounds are clean, but their relationship is unstable.

## Some Details Need Small Windows

The wavelet scattering paper is a reminder that some artifacts disappear when the averaging window is too broad. Its claim is technical: small temporal averaging, high frequency resolution, and directional resolution help capture subtle synthetic-speech anomalies. Compositionally, this says that some musical information only exists at the right analysis scale.

A noisy transient, a phasey high partial, a bow-change roughness, a codec edge, a breath onset, a consonant smear: these may not survive a representation optimized for broad stability. If those details are musically important, the resolution budget has to reserve local precision for them.

This gives a useful studio rule:

Do not judge a texture only at the scale where it looks stable.

Zoom in until the thing you care about either appears or vanishes. If it vanishes, the representation is not wrong; it is spending its budget elsewhere.

## Harmony Also Has a Budget

The Tonnetz source moves the same idea into abstract musical structure. A graph of harmonic resources tells us what moves are possible, but it does not tell us which moves deserve precision. A composer can spend resolution on exact voice leading, on chord identity, on common-tone retention, on geometric symmetry, or on large-scale route shape.

Those choices produce different music even when the same graph is used.

This is where the ice source becomes more than a metaphor. Ostwald's step rule says physical systems may move to the nearest accessible state rather than the globally most stable one, and the path/rate of compression can determine which phase appears. A harmonic system can behave similarly. If every phrase resolves to the abstract optimum, the path becomes predictable. If the rule is nearest-accessible motion under changing pressure, the music can crystallize into metastable plateaus.

The resolution budget, then, is not only sonic. It is procedural. How precisely does the piece track the nearest move? How much ambiguity can a node tolerate? Does the graph preserve local accessibility while giving up global certainty?

That is a beautiful compositional lever: make the path exact, let the destination breathe.

## A Studio Recipe: Three Budgets, One Phrase

Build a one-minute study from a single fixed harmonic graph.

1. Write a four-phrase sketch at 96 BPM using one diatonic or pentatonic Tonnetz-like resource. Freeze the chord-node sequence.
2. Render three versions with the same tempo, roots, phrase lengths, instruments, and loudness.
3. In **Version A**, spend the resolution budget on rhythm: clear 1-10 Hz modulation, gating, tremolo, or sidechain motion. Blur the spectral surface slightly.
4. In **Version B**, spend it on intelligibility: make attacks, melodic contour, register motion, and phrase boundaries maximally clear. Keep timbre plain.
5. In **Version C**, spend it on fine spectral detail: keep rhythm and contour simple, but add high-resolution filtering, transient shaping, multiband motion, or controlled phase texture.
6. Loudness-match the three renders.
7. Blind-listen and ask: which layer announces itself first?

The falsifier matters. If the prioritized layer is not identifiable, then the budget was either too subtle, poorly isolated, or not perceptually relevant in this material. That would still be a good result. It tells us which analysis layer was elegant on paper but weak in the room.

## The Aha

The elegant connection across these sources is that preservation is selective.

Speech rhythm preserves identity at low modulation frequencies. Prosody depends on alignment between representational streams. Ultra-low-bitrate codecs can preserve intelligibility without worshiping reconstruction. Wavelet scattering catches artifacts only when its window and resolution match the target. Ice phases emerge through accessible paths, not abstract optimality. Tonnetz resources become music through chosen traversal precision.

For composition, that becomes a discipline:

Do not ask, “How much detail can I add?”

Ask, “Which layer must remain precise for this music to stay itself?”

That is the resolution budget. Spend it where the meaning is.

---

_Sources: Cross-Linguistic Rhythmic and Spectral Feature-Based Analysis of Nyishi and Adi; Qwen3.5-Omni Technical Report; ClariCodec; WST-X Series; Physicists Discover the Most Complex Forms of Ice Yet; Tonnetz Theory, Classical Harmony, and the Combinatorial Geometry of Abstract Musical Resources_

_Connections: The Carrier Decides (#181), The Invisible Coordinate (#182), The Fixed Frame (#180), The Thick Boundary Revisited (#179)_
