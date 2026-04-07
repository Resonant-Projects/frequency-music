# The Arrow of Sound: Why Music Only Goes Forward

_You can hang a painting upside down and it's still a painting. Reverse a piece of music and it's rubble. The asymmetry isn't an accident — it's the deepest thing about what music is._

---

## The Retrograde Illusion

Twelve-tone composers treated retrograde as a first-class operation. If a tone row is valid, its reversal is equally valid — the row is a sequence of intervals, and intervals work both ways. Webern built entire movements from palindromic structures. In the score, the symmetry is perfect.

In the ear, it's invisible.

This is one of music theory's most persistent embarrassments: an operation that is trivial on paper is nearly imperceptible in listening. Trained musicians struggle to identify retrogrades of even simple melodies. Play a Bach fugue subject backwards and it doesn't sound like "the same thing reversed" — it sounds like a _functionally different melody_. The intervallic content is preserved, but the harmonic implications are inverted — a leading tone resolving upward becomes a tonic falling away. The identity is destroyed not because the notes are "wrong" but because their temporal function has been reversed.

Why? The standard answer — "we're just used to hearing things forward" — is both true and insufficient. We're "used to" seeing things right-side-up too, but an inverted photograph is instantly recognizable as an inverted photograph. Spatial inversion preserves identity. Temporal inversion annihilates it. The question isn't habit. It's architecture.

## The Prediction Machine

The auditory system is, above all other things, a prediction engine. This isn't metaphor — it's measured neuroscience. The auditory cortex generates forward models of incoming sound on timescales from milliseconds (predicting the next oscillation cycle of a periodic waveform) to seconds (predicting the resolution of a harmonic phrase) to minutes (predicting the return of a chorus).

Every musical moment exists in a context of _what was expected_. A V7 chord is tense because the brain has already modeled its resolution to I; the tension is the metabolic cost of maintaining an unsatisfied prediction. A deceptive cadence is surprising because the prediction was specific and wrong. Groove is the pleasure of being _almost_ right — the predicted beat lands a few milliseconds early or late, and the discrepancy between prediction and reality generates a physical micro-response that we experience as the urge to move.

This architecture is profoundly asymmetric. Predictions flow forward. The brain doesn't build retrodictive models of sound with anywhere near the same resolution or commitment. You can remember what you heard, but you can't _un-expect_ it. The experience of musical tension — the tightness in the chest before a resolution, the physical lean of a dominant seventh — is a prediction that hasn't discharged yet. It lives in the future tense. Run the tape backwards and the resolution comes _before_ the tension. The prediction never forms. There's nothing to resolve.

## Entropy and the Score

Thermodynamics offers a frame. In any acoustic signal, the arrow of time is encoded in the entropy profile. Natural sounds — speech, animal calls, musical instruments — have characteristic _attack-decay_ envelopes: energy rises sharply (the hammer strikes the string, the bow bites, the breath hits the reed) and decays gradually as the system returns toward equilibrium. This is the second law at the scale of single notes.

Reverse a piano note and the result is immediately uncanny: a slow crescendo from silence that ends in an abrupt cut. Nothing in nature does this. The reversed sound violates the entropy gradient that the ear uses as a basic signal of physical causation. Our auditory system evolved to extract causal information from sounds — what hit what, how hard, how far away. That extraction depends on the attack-decay asymmetry being intact.

At the phrase level, the entropy gradient maps onto harmonic tension. A classical phrase typically begins at a state of relative order (tonic), moves through increasing disorder (modulation, chromaticism, dominant function), and resolves back to order (return to tonic). This arc — order → disorder → order — is a mini-thermodynamic cycle. The "disorder" in the middle isn't chaos; it's structured departure from a reference frame, carefully managed so that the return feels earned.

Reverse this and you get: order → disorder → order. Wait — that's the same shape? No. Because the _kind_ of order is different on each end. The opening tonic is a _beginning_: an establishment of reference, with all the uncertainty of what's to come. The closing tonic is an _ending_: a confirmation that the journey is complete, with the satisfaction of closure. The beginning carries low predictability (we don't yet know where the piece will go). The ending carries high predictability (we knew it was coming home). Same chord, opposite information content. Reverse the tape and both are wrong: the ending-tonic arrives first, feeling like it resolves nothing, and the beginning-tonic arrives last, feeling like it promises nothing.

## The Codec Knows

Audio codecs inadvertently prove the point. Modern perceptual codecs — MP3, AAC, Opus — exploit _temporal masking_: a loud sound renders nearby quiet sounds inaudible. Crucially, temporal masking is asymmetric. _Forward_ masking (a loud sound hiding a subsequent quiet sound) is much stronger and longer-lasting than _backward_ masking (a loud sound hiding a preceding quiet sound). The psychoacoustic models baked into every codec are calibrated for this asymmetry.

This means the codec literally compresses music _more efficiently in the forward direction_. It allocates bits based on predictions about what the ear can and can't detect, and those predictions assume forward-flowing time. Reverse a compressed audio file and the codec's assumptions are violated — artifacts appear where they shouldn't, and preserved details become inaudible.

Neural audio codecs (EnCodec, DAC) take this further. These systems learn to compress audio by predicting future samples from past ones. The entire architecture is a forward prediction machine. Their latent spaces — the compressed representations they discover — are organized around _what comes next_, not _what came before_. They are, in a very literal sense, mathematical models of the arrow of sound.

## Musical Form as Causal Structure

Consider sonata form. Exposition presents themes; development transforms them; recapitulation returns them, changed by the journey. This is a narrative structure, and narratives are causal chains. The development doesn't just _follow_ the exposition — it _responds_ to it, _acts on_ it, _transforms_ it. The recapitulation isn't a repetition; it's a _consequence_.

Reverse a sonata and the consequence precedes the cause. The recapitulation — themes laden with the weight of development — appears first, but there's no development to have weighted them. Then the development section arrives, operating on themes we've already heard resolved. Finally, the exposition presents its material fresh, but we've already heard it transformed and returned. The experience isn't puzzling or avant-garde. It's just empty.

This is because musical form, at every level, exploits the listener's forward-modeling. A theme introduced in the exposition becomes a _memory_ that the development can allude to, fragment, and distort. These operations only work if the memory was formed first. A variation on a theme you haven't heard yet is just a theme. A return to a place you've never left isn't a homecoming.

Stravinsky understood this. The _Rite of Spring_ opens with a solo bassoon in its extreme high register — a sound that signals "not-beginning," a sound that seems to have been going on before we started listening. The first thing the audience predicts is that this will resolve, settle, find its footing. Stravinsky withholds that footing for the entire ballet. The piece's violence comes from both sources simultaneously: the _physical_ acoustic roughness of biting polytonal harmonies (like the famous E major over E♭ dominant 7th) AND the _cognitive_ sustained denial of predicted resolution. Separating the two — pretending it's all cognition, no physics — would be a false dichotomy. Time is the weapon. The arrow is the blade. But the blade has a physical edge.

## Information Theory's Verdict

Claude Shannon's information theory formalizes the intuition. The information content of an event is the negative logarithm of its probability: _I(x) = -log P(x)_. Low-probability events carry high information; high-probability events carry low information. Musical structure is, in this framework, a system for _managing the listener's probability distribution over time_.

A tonal piece begins by establishing a key — narrowing the listener's distribution to favor tonic-related events. Modulation widens it. Chromaticism makes it nearly uniform. The return to tonic collapses it back. The emotional arc of the piece is the arc of this distribution's entropy: low → high → low.

But — and this is the key — the probability distribution at any moment depends on _everything that preceded it_. It's conditioned on the past. The probability of a C major chord is completely different in bar 1 (neutral, tabula rasa) versus bar 200 (homecoming, after 199 bars of increasing distance). Same chord, wildly different information content.

This means the information profile of a piece of music is irreversible by definition. The conditional probabilities that determine the information content of each event are built from a specific causal history. Reverse the sequence and you don't get the "reverse information profile" — you get nonsense, because each event is now conditioned on a future that hasn't happened rather than a past that has.

This is the mathematical core of the arrow of sound: **music is a sequence of conditional probabilities, and conditioning is causal, and causation has a direction.**

## The Exception That Proves

Messiaen's "non-retrogradable rhythms" — palindromic durational sequences — are the exception that illuminates the rule. Messiaen carefully chose rhythmic patterns that sound identical forwards and backwards. But notice what he had to do: eliminate _everything_ that carries directional information. No attack-decay envelopes (he used the organ, which sustains indefinitely). No harmonic tension-resolution (he used modes of limited transposition, which have built-in symmetry that defeats tonal gravity). No developmental narrative (his forms are static, contemplative, non-teleological).

Messiaen achieved temporal symmetry by _systematically stripping out every feature that makes music temporal_. What remains is beautiful — luminous, suspended, cathedral-like — but it's beautiful precisely because it has stepped outside of time. It's music that aspires to the condition of stained glass: all-at-once, not one-after-another.

The effort required to defeat the arrow of sound reveals how deeply the arrow runs. Normal music doesn't just happen to flow forward. It is _constituted_ by its forward flow. The prediction, the tension, the surprise, the resolution, the groove — these aren't added to a neutral sequence. They _are_ the sequence. Remove them and you have something that might be profound but isn't, in the usual sense, music.

## Compositional Implications

If the arrow of sound is fundamental, then composition is the art of managing prediction across time. Some consequences:

**Surprise is context-dependent, not event-dependent.** A diminished seventh chord isn't inherently surprising. It's surprising if it follows a passage that narrowed your expectations to exclude it. The composer's real instrument isn't the orchestra — it's the listener's probability model.

**Repetition is never identity.** The second time you hear a theme, it carries the memory of the first time. The third carries both memories. Musical repetition is a functor that maps identical notes to non-identical experiences, and the functor is the arrow of time.

**Endings are harder than beginnings.** Beginnings only need to establish a prediction. Endings need to satisfy it — and the prediction, by the time the ending arrives, is enormously specific, shaped by every event in the piece. This is why great endings feel inevitable and mediocre endings feel arbitrary: inevitability means the prediction was _so well trained_ that the ending was the only satisfactory collapse.

**Groove is temporal arrow made physical.** The body's entrainment to a beat is a physical prediction — the foot falls where the beat will be, not where it was. Microtiming deviations work _because_ the prediction is specific enough to be violated in precise, pleasurable ways. No arrow, no prediction. No prediction, no groove.

---

_Related essays: [Finding One](/docs/essays/finding-one.md), [The State of the Music](/docs/essays/the-state-of-the-music.md), [The Codec Ear](/docs/essays/the-codec-ear.md), [The Groove Equation](/docs/essays/the-groove-equation.md), [The Listener's Grid](/docs/essays/the-listeners-grid.md)_
