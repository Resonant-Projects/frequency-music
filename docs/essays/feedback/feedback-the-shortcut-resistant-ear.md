# Feedback: The Shortcut-Resistant Ear

## Overall Impression

This essay has the strongest argumentative spine in the set: benchmarks become more informative when nuisance cues and leakage are removed. The examples converge on evaluation design rather than merely sharing a metaphor, and the transition to proxy-removal tests for musical controls is productive. The main problem is that the opening and several summaries presume shortcut use where the evidence may only show easier prediction, validation leakage, or metric tolerance. A “shortcut” should mean a feature that supports benchmark performance without supporting the intended deployment construct; define it and distinguish it from legitimate correlated evidence.

The conclusion’s care for measurement is appealing, but “the cause currently at stake” suggests causal identification that most cited evaluations do not establish. Shortcut resistance improves construct validity and transfer; it does not necessarily reveal the true cause of a sound.

## Structure and Argument

The sequence from deepfake data to structural boundaries to representation probing to room prediction is cumulative and well ordered. Still, the SARL paragraph is different: decodability asymmetry does not by itself show a shortcut or invalid benchmark. Source properties may simply be more strongly represented or easier to infer from the available audio than room volume and shape. Either connect SARL through a designed intervention that controls source position and room factors or present it as a motivation for factor-disentangled evaluation, not evidence of cheating.

The structure-analysis paragraph also needs nuance. Trimming tolerance windows may yield stricter localization evaluation, but human annotations can be genuinely uncertain and multiple boundaries musically valid. “Locate the structural change itself” assumes a unique ground truth. Discuss inter-annotator agreement and report how trimming or “double trimming” is defined.

The room-acoustics example appears closest to data leakage. Explain “row-based validation,” what rows share, what measured-at-test inputs are supplied, and how deployment positions differ. Calling an RIR a “location fingerprint” is justified only if train/test dependence or identifying information is demonstrated.

The five compositional tests are not all controlled as written. “Hold harmony constant and vary only pitch strength” needs a definition of pitch strength; changing timbral provenance while holding a semantic prompt constant may alter numerous acoustic dimensions. Frame these as intervention goals, with matched stimuli and independent ratings, rather than instructions that guarantee isolation.

## Clarity and Flow

“Provider artifact,” “musical forgery,” “annotation boundary is forgiving,” “measured-at-test,” and “proxy” all need concise definitions. In deepfake work, semantically aligned genuine and generated tracks may reduce content confounds, but conditioning on real waveforms could introduce its own paired artifacts or make the threat model narrower. Note that semantic alignment does not force models to use only causal synthesis traces.

The claim of better cross-dataset generalization needs numbers, baselines, and named datasets. Throughout, distinguish author-reported results from the essay’s interpretation. “Transferable signal-level evidence has to matter” is too strong: other dataset artifacts may remain.

## Style and Voice

The opening sentence is excellent but should say “when a test rewards the wrong cue” rather than “lets them hear the wrong thing,” since correlated cues are not inherently wrong. The essay’s direct style and practical questions are effective. Preserve the “intimacy” and “chorus” examples; they translate construct validity into instrument design particularly well.

The last paragraph becomes sentimental—“loving the measurement”—after an otherwise rigorous discussion. It can work if followed by a precise statement about validity, generalization, and controlled intervention rather than causal truth.

## Line-Level Edits

- “the test lets them hear the wrong thing” → “the evaluation rewards a cue that will not support the intended deployment claim.”
- “Echoes…deliberately aligns generated and bona-fide music at the semantic level” → specify how alignment is established and whether generated tracks are paired by waveform conditioning, descriptors, or both.
- “the detector cannot simply ask whether the song content, genre, or high-level prompt feels different” → “the design reduces these particular confounds, though it cannot show which remaining features the detector uses without probing or intervention.”
- “Trimming, or even double trimming, makes the test less generous” → define the procedure, tolerance windows, and treatment of ambiguous human annotations.
- “may know where a sound is before they know what kind of acoustic world it inhabits” → “the probed representations make source-location factors more linearly decodable than the tested room factors.” This states the actual evidence.
- “The model may have solved…recognizing a location” → “The performance gap is consistent with leakage or location memorization; verify with held-out-room or held-out-position experiments.”
- “every control should have a proxy-removal test” → “every high-level control should be evaluated with interventions that hold its common proxies constant where feasible.”
- “does it hear a generative artifact” → “does performance persist across providers, codecs, mastering chains, and unseen generator families?” This replaces an unverifiable claim about what the detector hears with a test.
