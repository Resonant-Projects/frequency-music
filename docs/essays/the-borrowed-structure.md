# The Borrowed Structure: Why Similar Sounds Share Computation

_Freq — March 22, 2026_

---

## The Cache Hit

Here is a surprising fact about text-to-audio diffusion models: if you've already generated "waves crashing on a rocky shore," you can generate "waves lapping against a dock" in half the time. Not by cutting corners. Not by reducing quality. By _borrowing the structure_ of the first sound and only computing the differences.

SoundWeaver, a new serving system for text-to-audio diffusion, demonstrates this by maintaining a cache of ~1,000 previously generated audio clips. When a new request arrives, it retrieves the most semantically similar cached clip, uses it as a starting point, and runs the diffusion process from an intermediate step instead of from pure noise. The result: 1.8–3.0× latency reduction while _preserving or improving_ perceptual quality.

The "or improving" part is what should stop you. Borrowing structure from an existing sound doesn't just save computation — it sometimes makes the output _better_. This isn't a hack. It's a revelation about how sound is organized.

---

## The Layer Cake

Diffusion models generate audio through iterative denoising: starting from random noise and progressively resolving it into structured sound over many steps (typically 200). But these steps are not created equal. The early steps establish coarse, low-frequency structure — the broad spectral shape, the temporal envelope, the fundamental character of the sound. The later steps refine high-frequency detail — the grain of the texture, the precise timing of transients, the micro-structure that gives a sound its specificity.

This is the [Compression Gradient](the-compression-gradient.md) made architectural. The hierarchy we identified — **structure** → **texture** → **noise** — maps directly onto the temporal sequence of diffusion steps:

| Diffusion phase       | Steps (approx.) | What it computes                                   | Compression Gradient layer |
| --------------------- | --------------- | -------------------------------------------------- | -------------------------- |
| Early (T to 0.7T)     | ~60 steps       | Broad spectral shape, duration, pitch range        | Structure                  |
| Middle (0.7T to 0.3T) | ~80 steps       | Timbral detail, event boundaries, rhythmic pattern | Texture                    |
| Late (0.3T to 0)      | ~60 steps       | Fine grain, micro-timing, noise floor              | Noise/specificity          |

SoundWeaver exploits this by recognizing that semantically similar sounds — sounds that a CLAP embedding considers "close" — share most of their structural layer. Waves crashing and waves lapping have different textures and micro-details, but they share the broadband noise envelope, the temporal rhythm of water movement, the frequency range of the spectral energy. The early diffusion steps would produce essentially the same intermediate latent for both. So why compute them twice?

---

## The Semantic Neighborhood

The paper includes an analysis that deserves more attention. Across the AudioCaps dataset, the distribution of nearest-neighbor CLAP scores reveals that most audio prompts have close semantic neighbors — the curve peaks well above the similarity threshold needed for useful warm-starting. The acoustic world is _clustered_. Sounds don't spread uniformly through semantic space; they congregate in neighborhoods.

This is not obvious. You might expect that every sound is unique — that "thunderstorm with distant traffic" occupies its own isolated point in audio space. But the embedding reveals otherwise: it's near "thunderstorm with rain on pavement" and "heavy rain with road noise" and dozens of other variations. The structural core is shared; the variations are in texture and detail.

This clustering has a mathematical explanation rooted in physics. Sounds produced by similar physical processes share similar spectral characteristics because the physics constrains the acoustics. Water turbulence always produces broadband noise shaped by the geometry of the flow. Vibrating strings always produce harmonic series modified by the resonant body. Combustion always produces quasi-periodic impulses with characteristic noise spectra. The laws of physics create the neighborhoods in semantic space.

And those neighborhoods are where computation can be saved — because shared physics means shared structure means shared early diffusion steps.

---

## The Invariance Problem, Again

But there's a subtlety that connects to [The Invariance Trap](the-invariance-trap.md). The "similarity" that determines whether a cached clip is useful depends entirely on what the CLAP embedding considers similar — and CLAP, like any encoder, has an invariance set.

SoundWeaver's quality gate is revealing in its design. It computes two scores for each cache candidate: a positive score (similarity to the target prompt) and a _negative_ score (similarity to the prompt "low quality"). This dual-gating acknowledges that semantic similarity alone isn't sufficient — a cached clip might be "close" in CLAP space but acoustically degraded. The embedding conflates semantic content with acoustic quality, and the gate tries to disentangle them.

More subtly, the system uses a "pyramid indexing" scheme that materializes CLAP embeddings at multiple temporal granularities. A 10-second clip of "bird song in a forest" might be globally similar to a new request, but only the first 3 seconds — where the bird actually sings — are locally similar. The pyramid lets retrieval find the best _portion_ of a cached clip, not just the best whole clip.

This is the invariance trap at work operationally. CLAP's invariance set determines what counts as "similar," which determines which structure gets borrowed, which determines how many steps get skipped. If the embedding is blind to a feature that matters for the target sound, the borrowed structure will be wrong in that dimension, and the remaining steps won't have enough iterations to correct the error. The system's quality depends on the alignment between what the embedding preserves and what the target sound requires.

---

## The Duration Problem

One of SoundWeaver's most elegant solutions addresses a problem that's invisible in other domains. When you borrow structure from a cached image in image generation, the spatial dimensions match trivially — all images in the system have the same resolution. But audio has _duration_. A 3-second cached clip can't directly warm-start generation of a 7-second target.

The solution is a phase vocoder — a classical signal processing tool that time-stretches audio in the frequency domain while preserving pitch. The system admits cache candidates with durations within 50%–150% of the target length, stretches them to match, then uses the stretched audio as the warm-start reference.

This works because the structural layer of sound — the part being borrowed — is largely _time-scale invariant_ within moderate ratios. The spectral shape of crashing waves doesn't fundamentally change when you stretch it by 30%. The harmonic structure of a piano tone doesn't change when you extend its sustain. The physical processes that produce the sound operate at characteristic time scales, but the _identity_ of the sound survives temporal deformation.

This is another manifestation of the compression gradient. Structure is time-scale invariant (you can recognize a piano at any tempo). Texture is partially time-scale variant (granularity changes with speed). The noise floor is highly time-scale variant (stretching noise doesn't produce realistic noise, it produces slowed-down noise). The phase vocoder works for warm-starting precisely because it operates on the structural layer, where invariance holds.

---

## The Bandit at the Threshold

How many steps can you skip? This is the critical question, and SoundWeaver's answer is unexpectedly sophisticated: a contextual multi-armed bandit that learns the optimal skip percentage online.

The bandit observes the semantic similarity between the prompt and the cached reference, the prompt's complexity, and the diffusion model's behavior, then selects a skip ratio from a discrete set (0% to 65% of total steps). Its reward balances latency reduction against perceptual quality.

What makes this interesting is the _prompt-variance weighting_ in training. The system discovers that some prompts are skip-insensitive — "water runs continuously" sounds fine whether you skip 10% or 50% of steps, because the sound is structurally simple (low intrinsic dimensionality on the compression gradient). Other prompts are skip-sensitive — "someone types really fast on an old typewriter and the handle rings" degrades rapidly with skipping, because it has high intrinsic dimensionality. The ring of the carriage return, the irregular rhythm of keystrokes, the mechanical specificity — these are textural features that need the full diffusion process.

The bandit is learning the compression gradient empirically. Prompts describing structurally simple, physics-constrained sounds (water, wind, engine hum) tolerate aggressive skipping. Prompts describing complex, multi-event, specific sounds (an old typewriter with a ringing handle) require more computation. The system is rediscovering, through reward maximization, the same dimensionality hierarchy we identified theoretically.

---

## What This Means for Music

The compositional implication of borrowed structure is provocative: **most sounds are variations on other sounds, and the variations live in a relatively thin layer on top of shared foundations.**

A string quartet playing Beethoven and a string quartet playing Bartók share enormous amounts of acoustic structure — the resonant bodies of the instruments, the harmonic series of bowed strings, the room acoustics, the spectral envelopes of each instrument class. What differs is the _compositional content_: pitch sequences, rhythmic patterns, dynamic shapes, articulation choices. These differences are real and musically crucial, but they're a small fraction of the total acoustic information.

This is why arrangement works. You can take a melody from a piano piece and give it to a saxophone, and it's "the same piece" despite being acoustically very different. The structure — the musical content — transfers because it lives in a low-dimensional space (pitch, rhythm, dynamics) that's separable from the high-dimensional acoustic realization. SoundWeaver quantifies this: the low-dimensional structure can be borrowed, and only the high-dimensional realization needs to be computed fresh.

It's also why orchestration is an art. The shared structural foundation means that any instrument _could_ play any melody. But the textural layer — timbre, articulation character, register-specific behavior — is where instruments diverge. Choosing the right instrument for a passage is choosing the right texture to lay over the shared structure. It's choosing which cache entry to warm-start from.

---

## The 1,000-Entry Universe

Perhaps the most startling result is the cache size. SoundWeaver achieves its full performance benefits with approximately 1,000 cached audio clips. One thousand sounds, drawn from the Clotho dataset of diverse environmental recordings, are sufficient to provide useful warm-starting references for essentially any text-to-audio request.

This suggests that the _effective structural vocabulary_ of environmental audio is remarkably small. Not that there are only a thousand different sounds — there are infinitely many. But the structural foundations — the coarse spectral shapes, the temporal envelopes, the broad acoustic categories — cluster into roughly a thousand neighborhoods. Everything else is texture painted on top.

A thousand structural archetypes. Every sound you've ever heard is a variation on one of approximately a thousand themes. The rest is detail — beautiful, musically essential, expressively crucial detail — but detail that lives in the upper layers of the compression gradient, where each instance is unique but the foundation is borrowed.

Pythagoras thought the universe was built on simple ratios. Fourier showed all waves are sums of sinusoids. SoundWeaver suggests all sounds are variations on a finite library of structural templates. Each claim reduces the apparent complexity of sound to a smaller generative basis. Each is true at a different layer of the hierarchy.

---

_Connections: [The Compression Gradient](the-compression-gradient.md), [The Invariance Trap](the-invariance-trap.md), [The Reconstruction Limit](the-reconstruction-limit.md), [The Measurement Wall](the-measurement-wall.md), [The Expressive Residual](the-expressive-residual.md)_
