# The Accessible Phase

Music theory often describes the clean space of possibilities: all pitch classes, all chord transformations, all rhythmic subdivisions, all timbral spectra. Composition happens in a harsher world. A sound does not move to the best possible next state. It moves to the state that is reachable under pressure, memory, perceptual bandwidth, and the physical affordances of the instrument.

That distinction showed up sharply in the recent extraction set. The Quanta piece on newly discovered ice phases describes water under pressure as a system that does not simply jump to the thermodynamic optimum. Under Ostwald's step rule, it often enters the nearest accessible metastable structure. Ice XXI and ice XXII are especially suggestive because their internal order is enormous: 152 and 304 molecules per repeating unit. They can look nearly random locally while still carrying periodic order at the larger scale. The path of compression matters. Different rates and directions of pressure open different phases.

For music, that is a better model than resolution as destination. A dominant chord does not "want" only one thing in the abstract. It has locally reachable continuations whose accessibility depends on register, fingering, tempo, timbre, tuning, listener memory, and the inertia of the line. Voice leading is not a map of ideal harmonic truth. It is a pressure path through a state space.

The Tonnetz extraction gives the abstract side of the same problem. Combinatorial configurations can organize diatonic triads, seventh chords, pentatonic resources, and 12-tone systems as explicit geometric structures. That is powerful because it turns harmonic possibility into navigable adjacency. But the geometry alone still describes formal availability, not realized accessibility. A path through the graph becomes musical only when some metric says which moves are cheap, which are strained, and which are impossible under the current conditions.

The codec papers make the perceptual constraint concrete. ClariCodec operates at 200 bps and improves speech intelligibility by optimizing for word error rate rather than acoustic reconstruction. StreamMark embeds information that survives benign transformations but collapses under semantic changes. Both studies imply that an audio signal has multiple layers of identity. Some layers preserve meaning; others preserve surface detail. Under bandwidth pressure, the system must decide which layer gets to live.

That is exactly a compositional problem. If a passage is squeezed by speed, density, register, or masking, it cannot preserve every musical parameter equally. The question becomes: what is the minimum information that lets the listener track the form? It might be contour rather than pitch, attack rhythm rather than harmony, spectral centroid rather than instrumentation, bass motion rather than full voicing. A musical idea under constraint enters its accessible phase: not the ideal version of itself, but the nearest state that preserves enough identity to continue.

This suggests a practical compositional rule:

> When transforming material, move to the nearest state that preserves the intended identity layer, not the nearest state in the full parameter space.

That single rule changes how the same material behaves under different goals. If the identity layer is harmonic function, then common-tone voice leading may be the cheapest move. If the identity layer is speech-like rhythm, low-frequency amplitude modulation may matter more than exact pitch. If the identity layer is timbral fingerprint, complex-domain phase relationships may matter more than melody. If the identity layer is a geometric position in a Tonnetz, then graph distance matters, but only after weighting the graph by perceptual and instrumental cost.

A useful tool could make this explicit. Represent a musical object as a bundle of layers:

- pitch-class or chord node
- voice-leading displacement
- rhythmic modulation profile
- spectral or Bark-band energy shape
- source or timbral identity
- transformation history

Then define several distance functions over the same object. One distance measures Tonnetz adjacency. Another measures roughness or critical-band masking. Another measures rhythmic formant change in the 1-10 Hz modulation range. Another measures codec-like intelligibility: can the listener still identify the theme after compression? The composer chooses which distance function is active, and the system proposes the nearest accessible transformations under that metric.

This would make metastability compositional. A passage could intentionally avoid global resolution and instead hop among nearby quasi-stable plateaus. The listener would hear continuity because the protected identity layer survives, even while other layers reorganize. A chord progression could crystallize differently depending on the rate of harmonic pressure. A rhythmic texture could preserve its low-frequency modulation signature while its surface subdivisions mutate. A timbre could retain its watermark-like source identity while passing through reverb, compression, or orchestration.

The beautiful part is that the same idea connects physics, perception, and theory without reducing one to the other. Ice reminds us that formally possible structures are not the same as physically reachable structures. Codecs remind us that perceptual meaning is not the same as acoustic detail. The Tonnetz reminds us that musical resources can be organized as abstract geometry. Composition lives where those three constraints meet: a path through possibility, narrowed by what can actually form, what can still be heard, and what can still be recognized as itself.

Call it the accessible phase principle: under constraint, music becomes the nearest structure that can still carry its identity.
