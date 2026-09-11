# Feedback: The Recoverable Residue
## Overall Impression

The essay advances a strong and usable distinction between fidelity and recoverability: transformations can destroy much of a signal while leaving task-relevant information inferable. The repeated question “what does the listener still recover?” is an effective compositional prompt. The argument’s main weakness is that “recover” covers incompatible operations—digit recognition, artifact detection, pitch inference, ASR, temporal localization, and emotion prediction—without specifying the observer, target, or success criterion. “Residue” also implies leftover signal features, whereas SCoPE’s prior may supply information not present in the current signal at all.

The source note is inadequate. Every named system and reported capability needs a normal citation, and the Vitalic analysis especially needs evidence: who performed the analysis, what “single inharmonic tones” means acoustically, and how two perceived melodies were demonstrated.

## Structure and Argument

The attacker framing gives the opening energy but becomes strained when “ordinary pitch perception” is called an attacker. In privacy, the attacker is an explicitly modeled adversary with knowledge and a goal; in perception, a listener is inferring structure without hostile intent. Use “probe” as the broader category and reserve “attacker” for the threat-model case.

The first section moves from privacy to deepfake generalization to auditory illusion, which establishes breadth but not causal unity. A simple framework would discipline the comparisons: define a transformation, target information, observer/probe, side information, and recovery metric for each case. This would immediately expose why SCoPE is different: recovery depends on speaker-conditioned history, not merely acoustic residue.

The composition techniques are suggestive but need feasible methods and controls. “Write a melody into the partial layout of a single inharmonic tone” may create virtual pitches or streaming effects, but the perceptual result depends on partial frequencies, amplitudes, register, duration, and listener. Testing which syllables remain recoverable should include transcription rather than composer intuition. “Emotional state persists” risks treating a model’s categorical prediction as the speaker’s real internal state.

The closing contrast with hidden information is incorrect as stated. Hidden-information recovery is not necessarily binary; watermark decoding has bit-error rates and confidence, and steganalysis can be probabilistic. Reframe the distinction as emphasis: residue concerns graded task information that persists unintentionally or selectively, while watermarking concerns deliberately embedded payloads.

## Clarity and Flow

“Privacy is … measured by whether an informed attacker can still recover the digits” is too absolute. Privacy is multi-dimensional; this study operationalizes one privacy risk through digit recovery under a particular threat model. Likewise, poor cross-generator deepfake detection could arise from domain shift, preprocessing, dataset artifacts, or insufficient semantic invariance. Avoid implying that all authenticity is reducible to a stable residue.

The VibeVoice paragraph conflates numerical model compression with information compression of the audio. Ternary weights reduce model precision and storage; they do not necessarily mean the speech signal itself has undergone “severe numerical simplification.” Separate acoustic tokenization from weight quantization and report accuracy, real-time factor, hardware, and baseline.

## Style and Voice

The essay’s direct questions and compact sections work well. “The attacker is a listener” is memorable but risks becoming a totalizing slogan. The final “Music has always lived there” is generic and avoids the promised defensible conclusion. End with the operational framework: composers can specify what information should remain inferable, to whom, and after which transformations.

## Line-Level Edits

- “every audio system should be judged” should be “an audio system can be stress-tested by asking what a capable probe still recovers.”
- “Privacy is not measured by” should become “This study does not operationalize privacy through audible alteration or generic ASR degradation; it tests digit recovery under a defined attacker model.”
- “Authenticity becomes a question” should be “Detector generalization becomes a question”; authenticity itself is not produced by the detector.
- “single inharmonic tones that evoke two simultaneous melodies” needs acoustic definition and listening evidence.
- “speech content survives severe numerical simplification” should distinguish low-rate acoustic tokens from ternary network weights.
- “The timestamp is … an event intensity to be read out” should say what the frame head predicts and how timestamps are derived.
- “when emotion is likely to persist” should become “when the model estimates state persistence,” avoiding a claim about actual emotion.
- Replace “Hidden information is binary” with “Deliberately embedded payloads are often evaluated by graded decoding error, just as perceptual residue is graded.”

