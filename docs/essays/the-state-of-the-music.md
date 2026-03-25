# The State of the Music

*How control theory's mathematical framework maps onto the way music actually unfolds.*

---

## A Machine That Remembers

In 1960, Rudolf Kálmán published a paper on linear dynamical systems that would reshape engineering. His key insight: you can model any system that changes over time as a *state* being updated by a rule. The state captures everything the system "remembers" about its past; the update rule determines how new inputs transform that memory into the next moment.

The mathematical form is deceptively simple:

```
dx/dt = Ax + Bu
y = Cx + Du
```

The state vector *x* holds the system's memory. The matrix *A* determines how that memory evolves on its own — its natural trajectory. *B* controls how new inputs enter. *C* projects the state into observable output. *D* provides direct feedthrough.

For sixty years, this framework modeled rockets, circuits, and chemical plants. Then, starting around 2021, researchers discovered it could model *sequences* — text, code, audio — with remarkable efficiency. The Structured State Space Model (S4) and its descendants showed that the same mathematics describing how a satellite maintains its orbit could describe how a sentence maintains its meaning.

Now, with SMDIM (Symbolic Music Diffusion with Mamba), this framework has arrived in music generation. And the fit isn't accidental. It's revealing.

## Music as State Evolution

Consider what happens when you listen to a piece of music. At any moment, you carry a *state* — an accumulated context of everything you've heard so far: the key, the prevailing rhythm, the melodic contour, unresolved tensions, the timbral palette. Each new note updates that state. A dominant seventh chord doesn't just add a sound; it *transforms your expectation* of what comes next.

This is exactly what a state space model does. The state vector *x* is the listener's (or generator's) accumulated musical context. The matrix *A* encodes how that context decays and evolves on its own — how a sustained dominant chord gradually builds tension even in silence. The input matrix *B* determines how each new musical event enters and transforms the state.

The analogy runs deep:

- **A's eigenvalues** determine the *timescales of musical memory*. Large eigenvalues mean slow decay — the model remembers events from far back. Small eigenvalues mean rapid forgetting. In principle, a well-structured *A* matrix could simultaneously model the fast decay of a grace note's influence and the slow persistence of a tonal center — though whether SMDIM's learned matrices actually exhibit this interpretable structure is an open empirical question the paper doesn't address.

- **The discretization step** (converting continuous-time SSMs to discrete updates) mirrors the relationship between continuous musical flow and discrete note events. Music lives in both worlds: the pitch space is continuous (think glissandi, vibrato, microtonal inflection), but compositional structure is discrete (notes, beats, measures). SSMs handle this duality natively.

- **Selective state spaces** (Mamba's innovation) make the *B* and *C* matrices input-dependent. This means the model decides *how much* to let each event influence the state based on *what that event is*. A modulation to a distant key should massively update the harmonic state; a passing tone should barely perturb it. Mamba's selectivity captures this naturally.

## Why Transformers Struggle with Music

The standard transformer approach to sequence modeling treats every pair of positions equally — any token can attend to any other token, with attention weights learned during training. This is powerful but expensive: the cost grows quadratically with sequence length.

For music, this is doubly problematic. Music has structure at *many simultaneous timescales* — the sub-beat level (articulation, ornament), the beat level (rhythm), the phrase level (melody), the section level (form), and the whole-piece level (narrative arc). A transformer must learn all of these hierarchical relationships from scratch through attention patterns, with no structural prior that says "nearby events interact differently than distant ones."

State space models offer something transformers don't: a *built-in notion of temporal scale*. The eigenvalues of the *A* matrix create a natural spectrum of memory timescales. Some dimensions of the state vector track fast-changing local features; others track slow-evolving global structure. This isn't learned from scratch — it's a structural property of the mathematics.

SMDIM's MFA Block exploits this by combining three components:
1. **Mamba layers** — near-linear complexity, handling long-range temporal dependencies via structured state evolution
2. **FeedForward layers** — nonlinear transformations for local feature refinement
3. **Self-attention** — precise local interactions where exact position-to-position relationships matter

This hybrid acknowledges something important: no single mechanism handles all musical timescales well. The state space component maintains global context efficiently; the attention component handles the precise, combinatorial interactions that matter at the note level.

## The Inverse Problem

While SMDIM uses state evolution to *generate* music, the DTT-BSR model tackles the inverse problem: given a finished mix, *recover* the underlying sources. This is music source restoration — undoing the production process to retrieve original stems from a mastered recording.

DTT-BSR also uses positional embeddings (RoPE) for temporal modeling, paired with band-split processing for spectral decomposition. The parallel is instructive: both generation and restoration require modeling music at multiple simultaneous scales (time and frequency), and both benefit from architectures that build temporal structure into their mathematical bones rather than learning it purely from data.

The fact that forward modeling (generation) and inverse modeling (restoration) converge on similar architectural principles suggests something deeper about music itself: its temporal structure isn't incidental. It's the *primary organizing principle*, and any model — generative or analytical — must respect it.

## From State Space to Composition Space

Here's where it gets compositionally interesting. If we take the SSM framework seriously as a model of musical cognition, it suggests concrete compositional strategies:

**Manipulating decay rates (speculation).** *If* eigenvalues of *A* control how long musical events persist in the model's state — which the SSM mathematics permits but the SMDIM paper doesn't verify — then a composer who introduces a striking event and delays its resolution is effectively relying on a slow-decay dimension. This is a hypothesis about what SSMs *could* reveal about musical memory, not a claim about what the cited paper demonstrates.

**State disruptions.** A dramatic silence, a sudden key change, or a textural rupture disrupts some dimensions of the listener's accumulated state *x* — though unlike a machine's state vector, a human listener's silence is *pregnant* with everything that preceded it, not zeroed out. A better analogy: these gestures *rotate* the state vector, forcing the listener to reorient. A silence after a long development section disrupts temporal expectations while preserving tonal memory; a sudden modulation disrupts tonal context while preserving rhythmic momentum. The drama comes precisely from what the listener *does* remember, not from what's erased.

**Selective gating.** Mamba's content-dependent gating suggests that not all musical events should have equal influence on the running state. A well-crafted melody might alternate between *gate-opening* events (notes that significantly update the listener's expectations) and *gate-closing* events (notes that confirm and stabilize the current state). Tension and release, viewed this way, is a pattern of selective state updating.

## The Deeper Pattern

State space models didn't become useful for music because someone cleverly repurposed engineering math. They work because the math was always describing something universal: how systems with memory process sequential information. Music is one of the most sophisticated such systems humans have invented.

The eigenvalue spectrum of *A* maps onto the hierarchy of musical timescales. The selective gating of Mamba maps onto the content-dependent nature of musical attention. The discretization from continuous to discrete dynamics maps onto the relationship between sonic reality and notated structure.

This doesn't mean SSMs are the "correct" model of music. But it suggests that the mathematics of state evolution — developed for rockets and circuits — captures something genuine about how music organizes time. And when a mathematical framework designed for one domain fits another this naturally, it's usually because both domains share a deeper structural principle.

In this case, that principle might be this: **meaningful temporal structure requires memory at multiple scales, and the most efficient way to implement multi-scale memory is through linear state evolution with structured eigenvalues.**

Music figured this out first. The math is just catching up.

---

*Sources: SMDIM (Symbolic Music Diffusion with Mamba, arXiv 2026); DTT-BSR (GAN-based DTTNet for Music Source Restoration, ICASSP 2026); Gu et al., "Efficiently Modeling Long Sequences with Structured State Spaces" (S4, 2021); Gu & Dao, "Mamba: Linear-Time Sequence Modeling with Selective State Spaces" (2023).*
