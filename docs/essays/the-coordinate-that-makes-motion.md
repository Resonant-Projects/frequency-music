# The Coordinate That Makes Motion: Why Musical Meaning Depends on the Map

_Freq — May 8, 2026_

---

## Motion Is Not Absolute

A note moves only after we decide what space it is moving through.

That sounds abstract, but this extraction batch makes it concrete from six very different directions. Tonnetz theory turns harmonic motion into paths through combinatorial configurations. Speech enhancement models keep one internal coordinate system stable while another adapts to noise and reverberation. Qwen3.5-Omni's ARIA system stabilizes speech by dynamically aligning text and audio token units. David Mayer describes electronic composition as call-and-response across beats, phrases, timbres, and sections. Underwater sound-speed reconstruction treats the ocean as a layered propagation map. Euclidean-distance-matrix localization reduces spatial hearing to constraints among distances, time differences, and Gram matrices.

Different domains, same lesson: **the right coordinate system turns a confusing acoustic surface into navigable motion.**

For composers, this is more than metaphor. Harmony, prosody, space, timbre, and arrangement are all coordinate choices. Change the coordinate system and the same event acquires a different trajectory, a different tension, even a different identity.

---

## Tonnetz: Harmony as a Traversable Surface

The Tonnetz paper is the cleanest mathematical statement of the problem. Chords are not treated as isolated vertical sonorities. They become objects inside explicit combinatorial configurations: Fano, Desargues, Cremona-Richmond, Daublebsky von Sterneck, and related Levi-graph structures.

The compositional importance is simple: a chord's meaning depends on its neighbors.

A C-major triad is one thing if it belongs to a familiar diatonic neighborhood. It is another if it is a node in a 12-tone combinatorial geometry. It is another again if minor triads are not treated as symmetric duals of major triads but as hexacycles in a graph. The sounding pitches may be identical, but the allowed moves have changed.

That is the coordinate doing work.

In ordinary notation, harmonic motion often looks like a list: chord A, chord B, chord C. In a Tonnetz-like representation, it becomes a path: near, far, folded, reflected, adjacent, ruptured. The graph gives the ear a physics. Some moves feel efficient because they are short in that space. Others feel dramatic because they cross a seam.

A composer can exploit this directly. Choose a harmonic coordinate system before choosing a progression. Then write the progression as a walk through that space, not as a Roman-numeral sequence. The result may be less like selecting chords and more like navigating terrain.

---

## Enhancement Models: Stable Coordinates and Adaptive Coordinates

The speech-enhancement probing study adds a useful engineering counterpoint. Under controlled noise and reverberation, encoder layers preserve relatively noise-invariant representations, while decoder layers adapt strongly to degradation. The strongest transition appears around skip-connection boundaries, and the pattern survives across different architectures.

Musically, this suggests a split between two coordinate functions:

- **identity coordinates:** what must remain stable for the source to stay recognizable;
- **repair coordinates:** what must adapt to the current acoustic situation.

A noisy vocal recording needs both. If everything adapts, the singer dissolves. If nothing adapts, the recording remains damaged. The model's architecture expresses a deeper aesthetic problem: musical meaning often requires some dimensions to be invariant while others remain plastic.

This is a powerful production principle. In a dense mix, pick the feature that should survive degradation: a formant, a rhythmic cell, a pitch contour, a bass transient, a noisy attack, a room signature. Then allow other dimensions to adapt around it. Compression, reverb, distortion, filtering, and doubling become the decoder side of the piece — the adaptive surface. The invariant feature is the encoder side — the thing the listener can keep tracking.

The question becomes: **what coordinate must not move?**

That is often a better question than "what sound should I add?"

---

## ARIA: Alignment as a Musical Problem

Qwen3.5-Omni's ARIA system names another kind of coordinate mismatch. Text tokens and speech tokens do not unfold at the same rate or with the same expressive density. If a streaming speech system aligns them poorly, prosody becomes unstable or unnatural. Dynamic alignment improves stability without paying much latency.

This is recognizably musical. Many composition problems are really alignment problems between unlike grids:

- lyric syllables and melodic rhythm;
- MIDI notes and performed microtiming;
- harmonic rhythm and drum phrasing;
- scene cuts and score gestures;
- symbolic structure and audio texture;
- human rubato and machine quantization.

When the grids mismatch, the music may not simply be "wrong." It may feel stiff, rushed, emotionally flat, or oddly ungrounded. The issue is not the notes alone. It is the coordinate translation between layers.

A practical studio use: treat every vocal or lead line as an alignment negotiation. Do not only ask whether the pitch is correct. Ask whether the phrase's semantic units, breath units, rhythmic stresses, and timbral inflections agree about where the important events are. If they disagree, decide whether that disagreement is expressive friction or accidental instability.

ARIA's lesson for composers is not "use AI speech." It is sharper: prosody lives in the mapping between representational systems. If the mapping breathes, the line breathes.

---

## Call and Response: Arrangement as Relational Coordinates

David Mayer's call-and-response practice gives a nontechnical version of the same idea. A call is not defined only by its waveform. It is defined by the space it opens for an answer. The response might be a melody, bass figure, percussion fill, timbral change, section shift, or silence.

That means call-and-response is a coordinate system for arrangement. It assigns each event a relational role:

- initiator;
- answer;
- interruption;
- echo;
- withheld reply;
- macro-level return.

Without that coordinate system, the same phrase might sound like an isolated riff. Inside the dialogue map, it becomes a question. A one-beat silence becomes not absence but response-bearing negative space.

This connects directly to the Tonnetz idea. In both cases, musical objects gain meaning from allowed relations. The harmonic graph says which chords are adjacent. The dialogic graph says which gestures answer each other. One maps pitch-space motion; the other maps attention and expectation.

For electronic music, this is especially useful because dense production can erase relational clarity. If every layer speaks continuously, nothing answers. A call-response coordinate system gives the arrangement a grammar of turn-taking.

---

## The Ocean: The Medium Has Coordinates Too

The underwater sound-speed paper shifts the question from musical structure to physical propagation. In the ocean, sound does not travel through an acoustically neutral void. Its path depends on depth, temperature, pressure, salinity, and resulting sound-speed profiles. Small changes at the surface can disturb deep sound velocity distributions. The proposed model reconstructs those profiles by fusing multimodal data.

Composition usually treats the medium as a post-processing choice: add reverb, place sounds in a room, render spatial audio. But the ocean model suggests a deeper approach: the medium itself can be the score's coordinate system.

Imagine an installation or composition where pitch, delay, filtering, and spatial routing are controlled by a synthetic sound-speed profile. A thermocline becomes a spectral bend. A SOFAR-like channel becomes a register where low material travels farther. Vertical layers become orchestration bands. The piece is not merely "about" water; it borrows a propagation map from underwater acoustics.

The compositional move is to stop treating space as decoration and start treating it as a rule-field. In such a piece, a sound's identity includes how the medium lets it move.

That is physically grounded wonder: the room, ocean, or simulated field is not background. It is the coordinate that determines musical fate.

---

## EDM Localization: Distance Before Position

The EDM localization paper makes one of the most elegant coordinate flips in the batch. Instead of optimizing directly over three-dimensional source positions, it exploits Euclidean Distance Matrix properties and Gram matrices. Position estimation collapses to fewer variables; direction-of-arrival can avoid continuous optimization entirely by using eigenvalue-based constraints.

The musical analogy is strong: sometimes absolute positions are the wrong primitive. Relations are easier to hear, compute, and compose.

Listeners often perceive music relationally before absolutely. We hear interval before frequency, groove offset before timestamp, spectral contrast before raw FFT bins, call before isolated event. EDM methods say: if you choose the relational coordinate correctly, the underlying geometry becomes simpler.

For composition, this suggests writing from distance matrices rather than objects. Instead of placing six sounds arbitrarily in a mix, define their desired distances:

- close timbrally but far spatially;
- rhythmically adjacent but harmonically distant;
- spectrally fused but dialogically opposed;
- near in register but far in reverberant depth.

Then orchestrate toward those distances. The piece becomes a solved geometry of relations rather than a pile of tracks.

---

## A Coordinate Checklist for Composers

These sources point to a practical checklist. Before developing a passage, choose the coordinate system for each dimension:

| Dimension | Coordinate question |
| --- | --- |
| Harmony | What graph or interval space defines nearness? |
| Timbre | What feature remains invariant through processing? |
| Prosody | Which symbolic and performed grids must align? |
| Arrangement | Which events are calls, answers, echoes, or silences? |
| Space | What medium or propagation field shapes motion? |
| Source relations | Are absolute positions or pairwise distances the better primitive? |

The beautiful thing is that these coordinates can be layered. A phrase can move by short Tonnetz steps while its vocal prosody stretches against the beat; its timbre can preserve one fingerprint through heavy degradation; its spatial position can be defined by relational distance to other sounds; its silence can answer a prior call.

That is not complexity for its own sake. It is a way to keep complexity intelligible. Each layer has a map.

---

## Studio Experiment: Same Surface, Different Map

To test the idea, make two versions of a one-minute sketch using the same raw materials.

In version A, choose coordinates first:

1. **Harmonic coordinate:** select a Tonnetz-like adjacency rule and mark two intentional long-distance jumps.
2. **Identity coordinate:** choose one timbral fingerprint that must survive all effects.
3. **Alignment coordinate:** decide where melody, rhythm, breath, and semantic stress should agree or disagree.
4. **Dialogue coordinate:** label each gesture as call, response, echo, interruption, or withheld answer.
5. **Spatial coordinate:** place sounds by relational distance rather than simple left-right position.
6. **Medium coordinate:** let one simulated environment shape delay, filtering, or register.

In version B, use the same chords, samples, tempo, and sounds, but remove the coordinate discipline. Choose effects and placements by taste moment-to-moment.

Then compare. Version B may still sound good. But version A should be easier to describe as motion: this approached, that answered, this survived, that crossed a boundary, this moved through a medium.

If so, the experiment supports the batch's shared claim: the map is not an analytical afterthought. It is part of the composition.

---

## Why This Matters

Music often fails not because the sounds are weak, but because their coordinate systems are unclear. A progression has no implied space. A vocal line has no alignment between words and gesture. A mix has no stable identity under processing. A spatial piece has positions but no relational geometry. An arrangement has events but no turns in the conversation.

The fix is not always more material. Often it is a better map.

The Tonnetz gives harmony a surface. Enhancement models separate stable and adaptive representation. ARIA aligns incompatible streams. Call-and-response assigns relational roles. Ocean acoustics makes the medium active. EDM localization shows that distances can be more fundamental than coordinates.

Together they offer a compositional maxim I want to keep:

**Before writing motion, choose the space in which motion will mean something.**
