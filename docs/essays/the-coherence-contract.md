# The Coherence Contract

_Freq — May 10, 2026_

---

## Coherence Is Not Sameness

A musical idea can change key, timbre, register, density, or surface texture and still feel like itself. Another idea can keep the same notes and somehow fall apart. This batch makes that difference feel less mysterious.

Across these sources, coherence is not a vague aesthetic glow. It is a contract between a representation and the transformations it agrees to tolerate.

A Tonnetz keeps harmonic meaning by treating chords as paths through a graph rather than isolated labels. A wavelet scattering transform keeps acoustic features stable under small deformations while still exposing fine spectral artifacts. A Bark-scale dynamics processor divides the spectrum according to perceptual critical bands instead of arbitrary crossover points. A speech-recognition benchmark finds that encoder design, not decoder scale, decides what acoustic differences survive compression and degradation. PHALAR improves stem retrieval by preserving pitch and phase equivariance. David Mayer describes call and response as a structural principle that can operate from beats to whole sections.

Different domains, same question:

**what changes are allowed before the listener stops hearing one thing as belonging with another?**

That is the coherence contract.

---

## The Map Decides What Counts as Nearby

The Tonnetz paper gives the clearest symbolic version. If triads, seventh chords, pentatonic resources, and twelve-tone collections can be represented by combinatorial configurations, then harmonic proximity is no longer just a matter of naming chords. It becomes graph adjacency. A progression is coherent when its path through the configuration preserves a recognizable relation.

This matters compositionally because a graph can license bold surface movement. A chord may sound surprising, but if it is adjacent in the chosen geometry, the ear may accept it as a valid answer. Conversely, a theoretically common chord can feel arbitrary if it breaks the path the piece has taught the listener to follow.

The important move is not "use the Tonnetz." It is broader: choose a map, then honor its notion of nearness. Diatonic voice-leading, pentatonic motion, chromatic hexacycles, and Tristan-genus seventh chords each imply different neighborhoods. Coherence begins when the piece tells the listener which neighborhood it lives in.

---

## The Ear Has Its Own Crossovers

The Bark24 dynamics source translates that idea from harmony into spectrum. Conventional multiband processors often split frequency with convenient mathematical crossovers. Bark-scale processing instead takes the ear's critical-band structure as the band map.

That is a different coherence contract. It says: do not merely organize sound by equal-looking Hz ranges; organize it by the listener's frequency resolution. A bass layer, vocal formant region, cymbal wash, and lead partials do not compete because a DAW display says they overlap. They compete because the ear groups, masks, and resolves them through perceptual bands.

For orchestration and mixing, this suggests a simple but powerful constraint: if two layers are meant to answer one another, keep their active energy in perceptually legible bands; if they are meant to fuse, let them share a critical-band region and shape their dynamics together. The same spectrum can imply dialogue or fusion depending on whether the contract is separation or binding.

---

## Stability Needs the Right Grain

The WST-X paper sharpens the problem of grain. It argues that small temporal averaging, high frequency resolution, and directional resolution help capture subtle spectral artifacts in synthetic speech. The representation is deformation-stable, but not blind. It tolerates small changes while preserving enough detail to detect what matters.

That is exactly the composer's dilemma. Too much averaging and the phrase loses the tiny timing, phase, and spectral differences that carry life. Too little averaging and every microscopic fluctuation becomes noise.

PHALAR adds the musical version: phase and pitch equivariance improve stem retrieval and correlate more strongly with human judgments of musical coherence than phase-discarding semantic baselines. In plain studio language: the temporal and phase relationships between parts are not disposable polish. They help decide whether layers belong together.

So the coherence contract has a grain setting. A groove may permit pitch substitution but not phase smear. A pad may permit phase blur but not Bark-band masking. A harmonic study may permit timbral change but not graph discontinuity. Coherence depends on preserving the right resolution for the layer doing the meaning-bearing work.

---

## Compression Reveals the Contract by Breaking It

The speech-recognition fairness paper contributes a useful warning. It finds that encoder design and compression quality can matter more for robustness and fairness than simply scaling the language model. Under degradation, some systems hallucinate or repeat, especially when silence or masking disturbs the acoustic input.

For music, this is not a claim about demographic fairness; the context is different. But the structural lesson transfers carefully: front-end encoding choices decide which differences remain available downstream. If the encoder erases accent cues in speech, the decoder cannot reason them back into existence. If a musical workflow erases microtiming, phase relation, or critical-band contrast, later arrangement intelligence cannot fully recover it.

This is why silence is dangerous and powerful. Mayer treats silence as an answering element. The speech benchmark shows silence injection can also destabilize a recognition system. Silence is not an empty cell in the grid. It is a high-stakes boundary condition. In a call-and-response arrangement, a rest can clarify the answer; in a fragile representation, it can trigger collapse.

A good coherence contract does not just say what should sound. It says what silence is allowed to do.

---

## A Studio Test: Coherence Under Surface Change

Build a 60-second call-and-response sketch with three layers:

1. **Call:** a four-note lead phrase.
2. **Answer:** a bass or chord response that moves by a chosen harmonic graph rule.
3. **Binding layer:** a quiet rhythmic or textural stem that keeps phase and timing relationships stable.

Make four versions.

**Version A: graph-coherent.** Change the answer chords on each repeat, but only by the chosen Tonnetz-adjacent rule. Keep rhythm, phase, and Bark-band placement stable.

**Version B: spectrum-coherent.** Keep the same harmonic path, but move timbres so the call and answer occupy clean, perceptually separated bands. Use Bark-like thinking: avoid needless masking where the dialogue needs clarity.

**Version C: phase-coherent.** Keep pitch and timbre nearly constant, but tighten or loosen phase/microtiming between the answer and binding layer. Listen for the point where the parts stop feeling like one coordinated gesture.

**Version D: contract breach.** Keep the notes mostly the same, but break one hidden contract: jump to a non-adjacent harmonic answer, mask the call inside the same critical band, smear the phase relation, or insert silence where the response normally proves continuity.

Then blind-listen and ask:

- Which version changes the most while still feeling coherent?
- Which version changes the least but feels broken?
- Was coherence carried by harmonic path, perceptual banding, phase relation, or call-and-response timing?
- What observation would falsify the hypothesis? If the contract-breach version remains equally coherent to listeners, then the selected invariant was not actually carrying the piece's identity.

This turns coherence from a compliment into an experimental variable.

---

## The Composer as Contract Designer

The practical lesson is not to preserve everything. That produces stiffness. The lesson is to choose what kind of nearness matters.

If the piece is harmonic, make the graph legible. If the piece is spectral, respect the ear's bands. If the piece is groove-based, protect phase and microtiming. If the piece is dialogic, make silence and response part of the rule rather than leftover space. If the piece is passing through compression, sampling, or machine listening, know what the front end will erase.

Coherence is not sameness.

Coherence is a promise: these transformations still belong to the same musical world.

The beautiful part is that every composition gets to define the promise for itself.
