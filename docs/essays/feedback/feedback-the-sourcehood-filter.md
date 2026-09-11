# Feedback: The Sourcehood Filter
## Overall Impression

The essay succeeds at extracting a useful three-part design question—isolation, attribution, commitment timing—and its proposed multi-axis “sourcehood meter” is more nuanced than a single score. But “filter” remains underspecified: sometimes it means a learned signal-processing filter, sometimes dataset exclusion, and sometimes a conceptual gate on identity. That ambiguity drives the synthesis but also makes it too easy to claim that three unrelated systems implement the same mechanism. The final personification, “when does the sound become someone?”, is evocative but narrows sourcehood to agency after the essay has included doors, sirens, rooms, and mixtures.

## Structure and Argument

The architecture–dataset–streaming sequence is logical, and the pivot into the three questions is well placed. Still, the streaming SpeechLLM example does not demonstrate a sourcehood filter unless the model explicitly performs speaker or event attribution. It demonstrates an emission or sufficiency policy. The essay should say that source commitment and translation commitment share a timing problem, not collapse them.

The SR-CorrNet account also needs a cleaner causal chain. It states that overlap, noise, and reverberation have “already blurred” identity by the final layer, but those corruptions are properties of the input; what the late split may do is fail to retain useful discriminative cues. The claim that correlations “become the basis for estimating filters” is technical enough to require a more exact description of inputs, filter type, and supervision.

The tool proposal should acknowledge that its listed measures live at different explanatory levels. Spectro-temporal coherence is signal-based; label stability depends on a model and taxonomy; attribution latency depends on a decision rule; pitch continuity is inappropriate for many sources. Present the output as a task-specific profile, and define the listening assumptions rather than implying a general sourcehood measurement.

The conclusion could then make a narrower, stronger claim: composition can manipulate the evidence by which a listener or model maintains an attribution through time.

## Clarity and Flow

“Allowed to commit to an identity” is a compelling question, but the essay never distinguishes identity from unity. A system can decide that there are two sources without identifying either, or identify “speech” without tracking a particular speaker. The isolation/attribution list begins to separate these, so introduce the distinction earlier.

Several terms need definition or support: “overloaded mixture,” “stable label,” “foreground cause,” “acoustic coherence,” and “listening contract.” In particular, a single class is not necessarily a single source: two dogs barking may be single-class but multi-source, and one mechanically complex event may receive one label. Verify that the FSD50K-Solo method targets source count rather than merely class purity.

## Style and Voice

The voice is direct and generative, and the phrase “preserve it before the shared bottleneck” is a strong organizing sentence once technically qualified. The essay leans heavily on “not merely X; Y” constructions and repeated declarations that engineering contains a compositional principle. Varying those transitions would reduce rhetorical predictability.

The sourcehood-meter section is the most concrete passage. Keep its emphasis on “handles,” but replace the casual promise “straightforward” with an honest account of calibration difficulty. That candor would strengthen rather than diminish the proposal.

## Line-Level Edits

- “First it decides what counts as one source.” → “Its outputs depend on an explicit or implicit rule for what counts as one source.” Many systems do not make a discrete first-stage decision.
- “the model carries an overloaded mixture too long” → “the model postpones speaker-specific factorization until after shared representation learning.” Define the actual architectural bottleneck.
- “source identity has already been blurred by overlap, noise, and reverberation” → “the learned representation may insufficiently preserve cues already degraded by overlap, noise, and reverberation.”
- “synthesize clean single-class events with a diffusion model” → state whether these synthetic events train the filter, serve as positive references, or enter the released dataset; these are materially different roles.
- “near-baseline quality” → identify the baseline, task, metric, and exact reported difference. “Roughly one to two seconds” also needs the latency metric.
- “one foreground cause, minimal competing causes” → “one target event under the dataset’s annotation and filtering criteria.” The present definition assumes what must be established.
- “The practical tool idea is straightforward” → “A practical, though calibration-heavy, tool would expose a sourcehood profile.”
- “label stability under source-separation or embedding models” → “agreement and confidence under named models, taxonomies, and perturbations.” Stability alone can reflect model bias.
- “when does the sound become someone?” → “when does the sound become attributable?” This retains the cadence while matching nonhuman examples.
