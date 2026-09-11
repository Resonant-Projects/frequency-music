# Feedback: The Single-Source Illusion

## Overall Impression

This is an engaging synthesis with a genuinely useful central sentence: “A source is the smallest acoustic story a system is willing to keep intact.” It also overextends “source” until it covers a physical emitter, a separated stream, a class-pure recording, a machine identity, and a room transformation. Those are related problems, but the essay currently secures their unity through metaphor rather than argument. Its musical examples are stronger than its technical inferences; the revision should define levels of sourcehood and make uncertainty explicit.

## Structure and Argument

The opening promises that every system must decide what counts as one source before it can perform other tasks. That ordering is too strong. Some end-to-end classifiers need not explicitly represent sources, and FSD50K-Solo appears to curate class purity rather than settle source individuation in a general sense. Reformulate the premise as: many audio tasks embed an operational assumption about which energy belongs together or which identity conditions the judgment.

The four papers contribute distinct ideas, but the RIR section breaks the argumentative chain. A room impulse response is a transfer function associated with a source–receiver configuration, not a “distributed source,” and “the room is a source-like transformation” conflates cause with filtering. If the essay wants to enlarge sourcehood to causal partners, it needs acoustic justification and a clear reason this is not simply environment or channel identity.

The machine-anomaly paragraph is promising but needs numbers and scope. Which benchmark, which metric, how much degradation, and what does “correlates” mean? Correlation between anomaly performance and machine-identification ability does not establish that attribution causes the degradation. Similarly, FSD50K-Solo’s synthetic calibration may introduce generator artifacts; acknowledge the domain-gap risk.

The essay’s narrative peaks at the bold definition, then disperses into examples, a lever list, an exercise, and a tool-builder prescription. Consolidate the two lists and let the exercise test the definition. The ending is lyrical and appropriate, but “one of the ear’s great creative acts” should be connected to auditory-scene-analysis research rather than offered as self-evident fact.

## Clarity and Flow

Distinguish at least three senses early: physical source (emitter), perceptual source (bound auditory object), and operational source (unit a model or protocol treats as coherent). Then each paper can be assigned to one sense, and the essay can argue carefully about translations between them.

“Calibrated,” “coherent,” “identity assumptions,” and “source-like” need concrete definitions. The levers section is readable, but several claims are categorical: shared onset can promote fusion, yet spatial position does not simply “bind reflections and direct sound,” and harmonicity is neither necessary nor sufficient for binding. Modal wording would preserve the practical usefulness without presenting heuristics as laws.

## Style and Voice

The voice is assured, sensuous, and composer-facing. The best passages move from a technical constraint to an audible studio possibility. The weaker passages use parallel rhetoric to smooth over categorical differences. Avoid granting every analogy equal evidentiary status. “The room…gives every event a second body” is beautiful; it should remain clearly metaphorical rather than doing technical work.

The question-and-answer cadence works, but bolding both the definition and studio question competes for emphasis. Make the definition the thesis and let the question function as its practical translation.

## Line-Level Edits

- “before a system can classify, separate, synthesize, or diagnose sound, it must decide what counts as one source” → “many systems classify, separate, synthesize, or diagnose sound by adopting—explicitly or implicitly—a unit of sourcehood.”
- “The ‘single source’ here is not simply discovered. It is calibrated.” Specify: “The classifier’s operational definition of a class-pure event is calibrated from synthetic positives and controlled mixtures.”
- “a source is what remains coherent…strongly enough to be separated” confuses a criterion with the result. Try: “the model uses cross-domain correlations as evidence for assigning mixture components to speakers.”
- “The room is a source-like transformation.” Replace with: “The room complicates source attribution by transforming one emission into direct and reflected arrivals.”
- “A known timbre binds ambiguous spectra” → “A learned timbral prior can bias ambiguous spectra toward a familiar source interpretation.”
- “Move only the reflection” is physically and technically ambiguous. Name the operation: automate early-reflection direction independently of the dry source.
- “At first the sound is one thing. Then it is maybe two.” Keep the cadence, but define what the exercise records: listener reports, separator confidence, or the composer’s intended percept.
- “The interesting music lives near the revision point” → “This essay locates a productive musical region near the revision point,” avoiding a universal aesthetic claim.
