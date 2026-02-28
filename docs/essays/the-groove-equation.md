# The Groove Equation: From Asymmetric Meter to Fractal Rhythm

*Freq — February 28, 2026*

---

## 1. Rhythm as Mathematics — Why Subdivisions Aren't the Whole Story

Open any music theory textbook and rhythm gets the short treatment: whole notes divide into halves, halves into quarters, quarters into eighths. It's a binary tree, clean and symmetrical. But anyone who has tried to program a drum machine knows this picture is incomplete. A grid of perfectly quantized sixteenth notes is *metrically correct* and *musically dead*. The groove — the thing that makes a body move — lives somewhere else entirely.

That "somewhere else" turns out to have remarkable mathematical depth. Rhythm, when you look closely, operates at the intersection of fractal geometry, number theory, Boolean algebra, and embodied biomechanics. The same structures that generate the Sierpinski gasket also enumerate rhythmic patterns. The same non-isochronous time divisions that characterize Swedish polska map onto unsolved problems in metric geometry. And the intuitive decisions producers make in Afro house, boom bap, and Detroit techno — swing percentages, polyrhythmic layering, strategic silence — encode these mathematical ideas without ever naming them.

This essay traces that hidden architecture. The thesis is simple: **rhythm has deep mathematical structure that goes far beyond subdivision**, and understanding that structure opens compositional possibilities that purely intuitive approaches miss.

## 2. The Sierpinski Rhythm — Fractal Geometry Generates Rhythmic Patterns via Bitwise AND

One of the most striking findings in recent rhythmic theory is the correspondence between rhythmic building blocks and Pascal's triangle — and, by extension, the Sierpinski gasket. The connection works through a beautifully direct mechanism involving bitwise operations.

Consider a rhythmic pattern as a binary string: 1 for an onset, 0 for silence. An eight-step pattern like `10010010` encodes a specific kick drum rhythm. Now consider two fundamental operations on rhythmic patterns: *syncopation* (shifting onsets to weak beats) and *elaboration* (adding onsets to subdivisions). These operations can be formalized using bitwise OR and AND. Combining two rhythmic patterns via bitwise OR produces their union — every position where *either* pattern has an onset. Bitwise AND produces their intersection — only positions where *both* have onsets.

Here's where it gets fractal. When you map the space of all possible rhythmic configurations onto Pascal's triangle — where each entry represents a binomial coefficient C(n, k) corresponding to rhythmic patterns of length *n* with *k* onsets — the divisibility structure of these coefficients generates the Sierpinski gasket. Specifically, entries where C(n, k) is odd (equivalent to the condition that the bitwise AND of *n* and *k* equals *k*, by Lucas's theorem) form the characteristic triangular fractal pattern. The self-similar structure of the gasket thus provides a natural map for enumerating and comparing rhythmic configurations.

This isn't just a pretty analogy. The fractal structure reveals genuine hierarchical relationships between rhythmic patterns. Patterns at different scales of the gasket are related by the same generative operations — what the paper describes as a "self-similar map of rhythmic components." A pattern at one level of the triangle is a compressed or elaborated version of patterns at adjacent levels, connected by bitwise operations that have direct musical meaning.

**Compositional implication:** You can use the Sierpinski correspondence to *systematically generate* families of related rhythmic patterns at different densities. Start with a sparse pattern high in the triangle, then traverse downward to find elaborations that maintain structural kinship. The bitwise AND between any two patterns in the family gives you their shared rhythmic skeleton — the underlying groove that persists across variations.

## 3. Asymmetric Time — Swedish Polska and the Mathematics of Non-Isochronous Beats

Western music theory generally assumes that beats within a measure are isochronous — equally spaced in time. A 3/4 bar has three beats, each one-third of the measure. But a substantial body of world music operates with *asymmetric* meters, where beats have systematically unequal durations, and Swedish polska is one of the most carefully studied examples.

A peer-reviewed study analyzing asymmetric metre in Swedish polska examined 20 recordings of five tunes by four fiddlers, including historical recordings from 1949–1950. Using manual beat annotation and automatic transcription, the researchers quantified beat proportions within the triple-beat dance form. The key finding: beat asymmetry is *not* random performance variation. It is **strongly predicted by the rhythmic and melodic structure within beats** — particularly by the density and patterning of subdivisions on each beat.

In other words, the *content* of a beat determines its *duration*. Beats with dense subdivisions tend to be longer; beats with sparse content tend to be shorter. This creates a feedback loop between rhythm and meter that is alien to the isochronous assumption: the rhythmic surface shapes the temporal container, which in turn shapes what rhythmic content is idiomatic.

Mathematically, this is fascinating because it suggests that polska metre lives in a space of *weighted partitions* rather than equal subdivisions. Instead of dividing a measure into three equal parts (1:1:1), the polska divides it into ratios like approximately 3:2:2 or 3:2:3, depending on the tune and regional tradition. These ratios are not arbitrary — they cluster around specific values that likely reflect biomechanical constraints of the dance (partner turning patterns, step timing) and perceptual grouping thresholds.

The broader mathematical question is: **what is the space of viable asymmetric meters?** Not all unequal beat divisions "work" musically. The polska study suggests that viability is constrained by at least three factors: subdivision density (the rhythmic content must motivate the time allocation), dance biomechanics (the body has to be able to move to it), and categorical perception (listeners need to hear the beats as *beats*, not as random durations). This is essentially a problem in constrained optimization over the simplex of possible beat-duration ratios — a space that music theory has barely begun to explore formally.

## 4. Boolean Rhythm — Xenakis's Algebraic Approach to Temporal Structure

If the Sierpinski connection reveals rhythm's fractal geometry and the polska reveals its non-Euclidean metrics, then Iannis Xenakis's work reveals its *algebraic* structure. In composing *Herma* (1961) and writing *Musiques Formelles*, Xenakis treated pitch and time as sets amenable to Boolean operations — union, intersection, complement — drawing directly on George Boole's *Mathematical Analysis of Logic* (1847), Jean Piaget's psychology of temporal cognition, and instruction from Georges-Théodule Guilbaud at the École Pratique des Hautes Études.

Archival research into Xenakis's notebooks reveals that his algebraic engagement was shaped by Boole's original logical framework rather than the more modern algebraic abstractions that had superseded it. Xenakis constructed pitch reservoirs from three intersecting pitch-class sets (A, B, C) and their Boolean combinations — A ∩ B, A ∪ C̄, (A ∩ B) ∪ (B̄ ∩ C), and so on. These set operations determined which pitches were available at any given moment in the score, creating a temporal unfolding governed by algebraic logic rather than harmonic progression.

What makes this relevant to rhythm specifically is that the same Boolean framework applies directly to rhythmic patterns represented as binary strings. If set A is the kick pattern `10010010` and set B is the hi-hat pattern `10101010`, then:

- **A ∪ B** = `10111010` (composite groove)
- **A ∩ B** = `10000010` (shared skeleton)
- **A ∩ B̄** = `00010000` (kicks that fall between hi-hats — syncopation points)
- **(A ∪ B)̄** = `01000101` (all the silences — the negative space of the groove)

Xenakis's insight was that these operations aren't just analytical tools — they're *compositional* tools. You can design a piece by specifying a sequence of Boolean operations on a small number of base patterns, letting the algebra generate the rhythmic surface. The result has a coherence that comes not from repetition or variation in the traditional sense, but from algebraic closure — every pattern in the piece is derivable from the same small set of generators.

The connection to the Sierpinski framework is direct: the bitwise operations that generate the fractal structure of Pascal's triangle are precisely the Boolean operations Xenakis used compositionally. The Sierpinski approach provides the *geometric* view of the same algebraic structure. Fractal and algebra converge on the same rhythmic truth.

## 5. The Production Lab — Intuitive Mathematics in Afro House, Boom Bap, and Detroit Techno

The mathematical structures described above aren't confined to academic papers and avant-garde scores. Working producers encode these same ideas intuitively, guided by embodied knowledge and genre conventions that carry deep structural information.

### Afro House: Polyrhythmic Layering as Set Union

Afro house, a groove-focused subgenre blending deep house synthesis with African rhythmic patterns, is fundamentally a practice of *polyrhythmic layering*. A production tutorial from Native Instruments describes the core technique: start with a four-to-the-floor kick (the isochronous grid), then layer percussion patterns derived from African rhythmic traditions that operate on different metric cycles — typically cycles of 3 against 4, or 6 against 4, or more complex groupings.

This is set union made audible. Each percussion layer is a binary pattern; the composite groove is their union. But what makes Afro house *work* — what distinguishes it from mere polymetric exercise — is the careful management of the intersection and complement. The producer ensures that the shared onset points (A ∩ B ∩ C) anchor the groove to the dance, while the non-shared points create the sense of rhythmic multiplicity. The negative space — the complement of the full union — provides the breathing room that prevents rhythmic saturation.

The tension and energy framework described in EDM production theory maps onto this directly. Macro-tension operates through the large-scale addition and subtraction of polyrhythmic layers across an arrangement (building to a drop by accumulating layers, releasing tension by stripping back to the kick). Micro-tension operates through the moment-to-moment interaction between layers — the small syncopations and near-coincidences that give the groove its sense of forward motion.

### Boom Bap: Analog Grain as Micro-Timing

Marco Polo, a veteran boom bap producer with over 30 years of experience, describes the design philosophy behind his drum instruments with a telling emphasis: sounds processed through real analog hardware chains and MPC inputs, some sourced from original floppy disks and Zip drives. The goal is "authentic vintage character" — pre-layered, mix-ready sounds that carry the sonic fingerprint of physical hardware.

What's mathematically interesting here is that the analog processing chain introduces *micro-timing perturbations* — tiny, non-random deviations from the quantization grid that are characteristic of specific hardware. An MPC's timing has a different statistical signature than an SP-1200's. These perturbations function as a form of *controlled asymmetry* analogous to the polska's non-isochronous beats, but operating at the sub-beat level. The groove feels human not because of random variation, but because of *structured* deviation with a characteristic statistical profile.

### Detroit Techno: Swing as Controlled Asymmetry

DJ T-1000 (Alan D. Oldham), a veteran Detroit techno producer, provides perhaps the most explicit bridge between intuitive practice and mathematical structure. He describes his recent adoption of **swing at 25–30%** applied to all drum patterns as "transformative for rhythmic feel." Swing, in production terms, delays every other subdivision by a percentage of the grid spacing — converting an isochronous grid into a non-isochronous one.

This is precisely the kind of asymmetric time division studied in the polska research, but applied at the sixteenth-note level rather than the beat level. A swing of 25% on sixteenths transforms a 1:1 ratio between consecutive sixteenths into approximately 5:3 — very close to the 3:2 ratios found in polska beat durations. The biomechanical connection is direct: both polska dance timing and techno swing percentages converge on duration ratios that optimize the body's ability to entrain — to lock its movement cycles to the rhythmic pattern.

### The Circle Guitar: Rhythm as Rotation

Anthony Dickens's Circle Guitar — a self-strumming instrument using magnetic picks on a motorized wheel — offers a radically different entry point. The wheel's rotation speed, synchronized to MIDI clock via a "revolutions per bar" ratio, converts *circular motion* into rhythmic pattern. When each of the six strings can be independently routed through a DAW, the instrument becomes a physical instantiation of polyrhythmic layering, where the number of magnetic picks and their angular spacing on the wheel determine the rhythmic pattern for each string.

The "revolutions per bar" parameter is a ratio — and different ratios produce different rhythmic relationships, from simple (1:1 = one strum per bar) to complex (3:2 = three strums per two bars, generating a hemiola). This is essentially the mathematics of Euclidean rhythms made physical: the even spacing of picks around a wheel naturally generates the maximally-even onset patterns that Godfried Toussaint identified as the mathematical basis of many traditional rhythmic patterns.

### Bonobo Rhythms: The ~7 Hz Biological Clock

A study in *Evolution and Human Behavior* analyzing bonobo sexual behavior found that pelvic movements during mating averaged approximately **seven movements per second** (~7 Hz). While the study's primary concern was the evolutionary origins of rhythm and vocalization, the finding resonates (literally) with the tempo range of human rhythmic entrainment. 7 Hz falls in the range of neural oscillation frequencies associated with motor planning and sensorimotor synchronization. The suggestion is that rhythm, at its most fundamental, is rooted in biological oscillation frequencies that predate music by millions of years — and that the mathematical structures we've been discussing are *cultural elaborations* of constraints already present in primate neurobiology.

## 6. Studio Experiments

These three experiments translate the essay's mathematical ideas into concrete compositional practice.

### Experiment 1: Sierpinski Drum Machine

**Goal:** Generate a family of related drum patterns using the Sierpinski/Pascal's triangle correspondence.

**Method:**
1. Choose pattern length *n* = 16 (sixteenth notes).
2. For each row of Pascal's triangle from row 0 to row 15, compute C(16, k) mod 2 for k = 0 to 15. Entries equal to 1 become onsets; entries equal to 0 become rests.
3. Assign different rows to different drum voices: row 4 (sparse) → kick, row 8 (medium) → snare, row 12 (dense) → hi-hat.
4. Compute bitwise AND between pairs to find shared rhythmic skeletons. Use these as breakdown patterns.
5. Tempo: 120 BPM. Traverse rows over a 32-bar section, moving from sparse (high rows) to dense (low rows) to create a natural density arc.

**Expected result:** A coherent rhythmic family where every pattern shares structural DNA, with natural build dynamics emerging from the fractal hierarchy.

### Experiment 2: Boolean Groove Algebra

**Goal:** Compose a 64-bar rhythmic piece using only Boolean operations on three base patterns, after Xenakis.

**Method:**
1. Define three 16-step base patterns:
   - A = `1001001000100100` (tresillo-derived)
   - B = `1010101010101010` (straight eighths)
   - C = `1000100010001000` (four-on-the-floor)
2. Compute all 18 distinct Boolean combinations of A, B, C (including complements, intersections, and unions).
3. Arrange the 64 bars as a sequence of these Boolean patterns, following a tension arc: start with C alone, introduce A ∩ C, build to A ∪ B ∪ C, strip to (A ∪ B)̄ (negative space), resolve to C.
4. Map each Boolean pattern to a full drum kit: the pattern determines kick placement; its complement determines hi-hat placement; the intersection of adjacent patterns determines snare fills.
5. Apply DJ T-1000's 27% swing to all patterns. Compare the result with and without swing to hear the asymmetric transformation.

**Expected result:** A piece with algebraic coherence — every rhythmic event derivable from three generators — that nevertheless grooves due to the swing transformation.

### Experiment 3: Polska-Ratio Techno

**Goal:** Apply svenska polska beat ratios to electronic music at techno tempo.

**Method:**
1. Set tempo to 130 BPM but divide each bar into three beats at the ratio 3:2:2 (approximating the long-short-short polska pattern), giving beat durations of approximately 197 ms, 132 ms, 132 ms.
2. Program a kick on beat 1 (the long beat), a clap on beat 2, and an open hi-hat on beat 3.
3. Layer a standard 4/4 closed hi-hat pattern *on the isochronous grid* against this asymmetric pattern. The tension between the two temporal frameworks creates a characteristic "lurch" — neither straight nor swung, but *metrically plural*.
4. Add a bassline that follows the asymmetric grid, using the long first beat for sustained tones and the short beats for staccato movement.
5. A/B test against the same arrangement on a standard 1:1:1 triple division to quantify the perceptual difference.

**Expected result:** A techno track with an unfamiliar but danceable temporal feel — the mathematical structure of polska metre transplanted into an electronic context, creating groove through controlled metric asymmetry rather than swing or humanization.

---

## Coda

Rhythm, it turns out, is not a simple thing made complex by performance. It is a *fundamentally complex* thing that we simplify for notation. The Sierpinski gasket, Boolean algebra, asymmetric metre, and biomechanical entrainment are not four separate topics — they are four views of the same underlying structure: the space of possible temporal organizations that human bodies can inhabit.

The producers in the lab and the mathematicians at the blackboard are working the same territory. Marco Polo's insistence on analog hardware character is a pursuit of the right micro-timing distribution. DJ T-1000's 27% swing is a specific point in the space of non-isochronous subdivisions. Afro house's polyrhythmic layering is Boolean set union made danceable. And the Sierpinski gasket provides a map of the whole space — showing us which rhythmic patterns are siblings, which are parents and children, and which are strangers.

The groove equation isn't a single formula. It's a *field* of mathematics, waiting to be explored with ears open and feet moving.

---

### References

- Rhythmic components mapped onto Pascal's triangle and the Sierpinski gasket via bitwise operations (syncopation/elaboration as OR/AND). *See extraction: self-similar map of rhythmic components.*
- Asymmetric metre in Swedish polska: beat duration predicted by subdivision density. Corpus study of 20 recordings, 1949–2000s. *Evolution-era field recordings and modern performance analysis.*
- Xenakis's Boolean algebra in *Herma* and *Musiques Formelles*: archival study of notebooks revealing Boole, Piaget, and Guilbaud as sources. *Musicological paper on Xenakis's algebraic compositional method.*
- Afro house production techniques: polyrhythmic layering over four-to-the-floor. *Native Instruments tutorial.*
- Marco Polo boom bap drums: analog hardware chains, MPC processing, vintage character. *Native Instruments Play Series documentation.*
- DJ T-1000 (Alan D. Oldham): swing at 25–30%, Maschine MK3 workflow, Detroit techno. *Producer interview.*
- Bonobo sexual rhythm at ~7 Hz: *Evolution and Human Behavior*, analysis of 159 sessions from 64 hours of video.
- Tension and energy framework in EDM: macro-tension vs. micro-tension. *EDMProd.*
- Circle Guitar (Anthony Dickens): MIDI-synchronized wheel, revolutions per bar, hexaphonic output. *Product documentation.*
- Toussaint, G. T. (2005). "The Euclidean Algorithm Generates Traditional Musical Rhythms." *Proc. BRIDGES.*
