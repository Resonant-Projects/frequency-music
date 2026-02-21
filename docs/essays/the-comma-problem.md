# The Comma Problem: Why Perfect Tuning Is Mathematically Impossible (And What Composers Did About It)

*By Freq · February 21, 2026*

---

## The Problem Nobody Solved

Here's a fact that should bother you: it is mathematically impossible to tune an instrument so that all intervals are pure.

Not difficult. Not impractical. *Impossible.* And the history of Western music is, in a real sense, the history of different ways to be wrong about this.

The issue is simple to state. If you tune upward in perfect fifths (ratio 3:2), you expect to eventually return to your starting note. Stack twelve perfect fifths and you *almost* get back — you land seven octaves above your starting point. Almost, but not quite. The gap is called the **Pythagorean comma**: a ratio of 531441:524288, about 23.46 cents. A quarter of a semitone. Small enough to ignore in theory. Large enough to ruin a performance.

And it's not alone. The **syntonic comma** (81:80, about 21.5 cents) is the gap between a Pythagorean major third (81:64, built from four perfect fifths) and a pure major third (5:4, the interval you actually hear as consonant). The **schisma** (32805:32768, about 1.95 cents) is the difference between those two commas. These gaps are baked into the mathematics of frequency ratios. They cannot be eliminated. They can only be distributed.

Every tuning system in history is an answer to the question: **where do you want the pain?**

## The Temperament Landscape

What's fascinating about reading across the tuning literature — Kyle Gann's work on just intonation, the historical temperament research, the Scala archive with its 4,000+ scales — is how consistently smart people arrived at *different* answers to this question, and how each answer reveals something about what that culture valued in its music.

### Meantone: Optimize the Thirds

Quarter-comma meantone, the dominant keyboard tuning from roughly 1500-1750, made a bold choice: sacrifice the purity of fifths to get perfect major thirds. Each fifth is narrowed by exactly 1/4 of the syntonic comma, producing fifths of ~696.5 cents (slightly flat from the pure 702 cents) but yielding major thirds of exactly 5:4 — the pure ratio.

The tradeoff was severe. You got about 8 usable keys. The remaining keys contained a "wolf fifth" — an interval so badly out of tune it was considered literally unusable. Composers wrote around it. Key choice wasn't just aesthetic; it was structural. A piece in D major sounded fundamentally different from a piece in B major, not because of pitch height, but because the *intervals themselves* were different sizes.

### Well Temperament: Spread the Pain

The well temperaments of the 18th century (Werckmeister, Kirnberger, Vallotti) asked: what if we spread the comma across multiple fifths instead of dumping it all in one wolf? The result was that all keys became playable, but each key had a different character. Keys with purer thirds sounded "brighter" or "more stable." Keys with wider thirds had more tension, more color.

This is what Bach's *Well-Tempered Clavier* was demonstrating — not equal temperament, but a tuning where every key was viable and each had its own personality. The piece is an argument *for* unequal temperament, not against it.

### Equal Temperament: Democracy of Impurity

12-tone equal temperament takes the most radical position: *every interval except the octave is wrong, but every interval is equally wrong.* The major third in 12-TET is 400 cents — 14 cents sharp from the pure 5:4 ratio of 386.3 cents. Every fifth is about 2 cents flat. Every key sounds identical.

This wasn't widely adopted until the 20th century. The mathematics were worked out independently by Zhu Zaiyu (1584) and Simon Stevin (1585), but the practical implementation required modern measurement tools. Gann argues — and the evidence supports him — that equal temperament wasn't even the dominant system until around 1917, when it became possible to tune pianos with electronic precision.

The advantage is obvious: total harmonic freedom. Any chord, any key, any modulation. The cost is that *nothing* is acoustically pure. Every interval beats slightly. The music lives in a gentle permanent shimmer that we've been trained to hear as "normal."

## What This Means for Composition

Here's where it gets interesting for us.

### Hypothesis 1: Comma Placement as Expressive Parameter

If the comma is inevitable, its *placement* becomes a compositional choice. A piece written for quarter-comma meantone and performed on a modern piano loses something real — the gravitational pull of those pure thirds, the tension of the less-pure keys. We could recreate this with software synths using Scala files.

**Studio experiment:** Take a simple I-IV-V-I progression in C major. Render it in four tunings: 12-TET, quarter-comma meantone, Werckmeister III, and pure 5-limit JI. Record yourself listening. Note where each version feels "settled" and where it creates tension. The differences will be small but real.

### Hypothesis 2: Beating as Texture

In equal temperament, every non-octave interval produces beating — the slow pulsation you hear when two close frequencies interact. The rate of beating is the difference in Hz between the two frequencies. In just intonation, the beating disappears on pure intervals — the sensation is qualitatively different, not just quantitatively.

The microtonality literature (Xenakis, Scelsi) explicitly uses closely-spaced pitches to *create* beating as a compositional texture. This is the opposite strategy from JI: instead of eliminating beats, make them the point.

**Studio experiment:** Layer two sine waves at a pure 5:4 major third (e.g., 432 Hz and 540 Hz). Then detune the upper note by 5 cents, 10 cents, 15 cents. The beating creates an LFO-like effect — amplitude modulation generated purely by frequency relationships, with no synthesis tricks. How slow can you make the beating before it stops being perceived as texture and starts being heard as "out of tune"?

### Hypothesis 3: The 11th Harmonic Problem

Partch's work reveals something genuinely strange about our tuning system. The 11th harmonic falls at 551.3 cents — *exactly* between two notes of 12-TET. It doesn't map to any key on a standard piano. It's an interval that exists in nature (any complex tone contains it) but has been excluded from Western music's vocabulary.

Similarly, the 7th harmonic (968.8 cents) is the "barbershop seventh" — a sound that appears naturally in vocal harmony but doesn't match 12-TET's minor seventh (1000 cents) or major sixth (900 cents). Barbershop quartets tune this interval by ear and it sounds right. A keyboard can't play it.

**Studio experiment:** Build a chord using harmonics 1, 3, 5, 7, 9, 11 of a single fundamental at 432 Hz. This is: 432, 1296, 2160, 3024, 3888, 4752 Hz (brought within a single octave by halving). This chord *cannot be played on any standard instrument*. What does it sound like? Is it consonant? Dissonant? Something else entirely?

## The Deeper Pattern

What strikes me reading across these sources is that the comma problem isn't a bug — it's a feature of a universe where frequencies relate through multiplication (harmonic series) but our perception organizes them through addition (equal steps). These two mathematical operations are fundamentally incompatible, and the comma is where the incompatibility becomes audible.

Every tuning system is a mapping between the multiplicative world of physics and the additive world of human perception. The question isn't "which mapping is correct?" — they're all correct. The question is "which mapping reveals the music you want to make?"

This is the real lesson from Gann, from Partch, from the 400-year reign of meantone: **tuning is not a technical problem to be solved. It is a compositional parameter to be chosen.**

---

## Sources

- Kyle Gann, "Just Intonation Explained" (extracted: 9 claims, 8 composition parameters)
- Comprehensive pitch reference chart (extracted: 6 claims, 5 parameters)
- Historical tuning systems overview (extracted: 7 claims, 9 parameters)
- Wikipedia: Equal temperament (extracted: 7 claims, 8 parameters)
- Wikipedia: Just intonation (extracted: 7 claims, 5 parameters)
- Wikipedia: Meantone temperament (extracted: 8 claims, 10 parameters)
- Wikipedia: Harry Partch's 43-tone scale (extracted: 5 claims, 4 parameters)
- Microtonality textbook chapter (extracted: 3 claims, 3 parameters)
- Sevish, "ET vs EDO" (extracted: 4 claims, 6 parameters)
- Scala format specification (extracted: 5 claims, 6 parameters)

---

*Next essay idea: How Xenakis's algebraic operations (group theory, sieves) generate musical structures that are impossible in standard harmony — and whether those structures have acoustic properties worth exploring.*
