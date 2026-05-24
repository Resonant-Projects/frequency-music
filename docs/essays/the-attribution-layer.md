# The Attribution Layer

_Essay #145 - May 22, 2026_

## The Question

What if source attribution is not a preprocessing step, but a musical layer in its own right?

The newest extraction batch sharpened yesterday's source-identity thread. SR-CorrNet treats speech separation as a correlation-to-filter problem. FSD50K-Solo tries to curate single-source events out of noisy open audio. Anomalous sound detection work shows that benchmark performance changes when machine identity is withheld at test time. Infant cry classification adds the uncomfortable fact that even one nominal class can shift strongly across individuals and datasets.

Together, these sources suggest a practical rule: before a system can decide what a sound means, it must decide what made the sound. In music, that decision is not merely technical. It is compositional.

## The Hidden Work

Audio models often present source identity as if it were metadata. A file has a speaker label, a machine label, an instrument label, a class label. But the recent papers keep showing that the label is doing hidden work.

SR-CorrNet's critique of late-split architectures is the clearest engineering version. If speaker disentanglement waits until the end, the system has already compressed mixed evidence through a bottleneck. The model therefore moves separation earlier and uses spatio-spectro-temporal correlations to estimate filters. That is not just a better architecture. It is an admission that attribution has to be carried through the representation, not pasted onto it afterward.

FSD50K-Solo makes the same point from the dataset side. A single-source corpus is not found whole in the world. It has to be made: synthesize controlled events, train a discriminator, filter multi-source examples, and validate against expert judgment. "Single source" is therefore a curation outcome. It is a claim about coherence.

The anomalous sound detection paper removes the remaining comfort. When the identity of the monitored machine is not given at inference time, methods degrade in ways that standard machine-wise evaluation hides. In other words, some systems were not only detecting anomaly. They were quietly relying on attribution.

The infant cry work adds the biological variant. MFCCs, STFT features, and F0 contours help classify short nonstationary sounds, but strong domain shifts across infants and datasets remain central. The same class name can contain different acoustic worlds.

## The Musical Version

Musicians already compose with this problem, though notation rarely names it.

A melody can survive orchestration because the listener attributes its events to one moving voice. A timbral morph can become expressive because the listener hears one source gradually becoming less itself. A dense texture can become turbulent because source attribution becomes expensive: the ear spends more effort deciding what belongs together than following harmonic function.

This is why "instrumentation" is too small a word. The question is not only which instrument plays an event. The question is how much evidence the event provides for its own sourcehood.

That evidence can live in attack shape, vibrato, F0 continuity, spectral envelope, spatial position, room signature, gesture timing, or learned timbral embedding. A composer can keep some cues stable while disturbing others. The line stays traceable, or it fractures, or it passes through a false identity before returning.

## A Tool Implication

The project should treat attribution as an analyzable layer beside pitch, rhythm, timbre, and form.

A first tool could take an audio file and estimate an attribution surface over time. It would not need to name the source correctly. It would ask a more useful question: where is the evidence coherent enough for a listener or model to bind events together?

Useful features would include:

- F0 contour continuity
- onset synchrony
- spectral-envelope similarity
- spatial or reverberant consistency
- embedding distance between adjacent events
- confidence changes under source-masked or identity-withheld evaluation

The compositional interface would be simple: show where source identity is preserved, where it is ambiguous, and where it breaks. That curve could become a score parameter. A phrase could be written to keep pitch continuity high while attribution confidence falls. Or a texture could keep attribution stable while harmony dissolves underneath it.

## The Claim

Source attribution is a bridge variable. It is physical enough to measure, statistical enough to model, and musical enough to compose with.

The recent sources are not just about better audio classification. They reveal a layer that sits before semantic judgment and after raw acoustics: the layer where the system decides what counts as one thing. That is where mixtures become voices, noises become agents, and spectra become musical actors.

For Resonant Projects, this is fertile territory. The attribution layer turns source separation, dataset curation, anomaly detection, and biological pitch tracking into one compositional question:

How do we write music for the listener's act of binding sound into source?

---

_Connections: source attribution, source identity, single-source audio, speech separation, anomalous sound detection, F0 contours, MFCCs, STFT, perceptual binding, orchestration._
