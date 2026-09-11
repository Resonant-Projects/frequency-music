# Feedback: The Coordinate Instrument

## Overall Impression

The essay offers a clean, useful premise: choosing a representation determines which properties of sound become measurable and actionable. Its strongest synthesis is “audio plus a map.” The draft’s central problem is slippage between a coordinate system, a learned representation, an estimated variable, and an experimental probe. SceneBind may encode multimodal scene attributes; SARL measures what encoders make decodable; tracking estimates location over time; scale models describe pitch relations; watermarking engineers recoverability. These can support one argument, but only if their distinct roles are stated instead of being treated as instances of one literal map.

## Structure and Argument

The examples form a productive trajectory from semantic scene space through spatial acoustics, dynamic estimation, pitch organization, and forensics. The SceneBind paragraph, however, needs factual detail: what does “bind” mean operationally, how is uncertainty represented, and what evidence shows that localization is part of semantic understanding rather than a jointly predicted label? Cite the actual task and metric.

The SARL inference—“a model may hear the actor more clearly than the stage”—is memorable, but probe decodability does not necessarily show what a model “hears” or uses. It can reflect probe choice, dataset balance, label noise, or pretraining data. Qualify the conclusion and distinguish linear accessibility from encoded absence.

The scale-evolution claim is the most empirical and most vulnerable to overstatement. Reported evidence across 1,314 scales from 96 countries sounds broad, but readers need the sampling unit, tuning normalization, model comparison, and uncertainty before accepting “shaped less by abstract harmonic landmarks.” Cultural coverage is not the same as representative global coverage, and “1–3 semitones” presumes a twelve-tone-derived measuring unit. At minimum, flag these as constraints and provide a citation.

“Choose the coordinate system before choosing the gesture” works as a design heuristic, not a universal sequence. In improvisation and instrument building, gestures can reveal or create the useful coordinates. Reframe it as an iterative rule: make the assumed map explicit, test a gesture within it, and revise the map.

The three-study exercise does not hold enough constant to attribute audible differences to coordinates. “Room coordinates” change acoustics, while “melodic coordinates” change event organization. Define a common phrase and specify the transformation and invariant in each study.

## Clarity and Flow

“Coordinate” sometimes means a numerical variable (azimuth), sometimes a feature space (encoder), and sometimes an ontology (source versus room). Give an early definition broad enough to contain these but precise enough to exclude mere description: for example, a chosen set of variables and relations used to locate, compare, or manipulate sound.

Several technical terms need glosses: RT60 is reverberation decay time; a Bayesian tracker maintains a probability distribution over location; separation changes a mixture into estimated stems but not necessarily into a mathematically defined new coordinate system. The latter is a metaphor and should be labeled as such.

## Style and Voice

The prose is concise and engaging, with good alternation between research and composition. Preserve “actor” versus “stage” and “audio plus a map,” but ensure the surrounding claims are technically modest enough to support those images. Avoid phrases like “the reported model finds” when the source likely compares models or statistical hypotheses; name the method.

The ending’s question—“what map does the sound have to survive?”—is evocative but anthropomorphic. Add a final concrete sentence about selecting representations according to desired invariances and failure modes.

## Line-Level Edits

- “before a sound can be used, it has to be placed inside a coordinate system” → “Any analysis or control system places sound within an explicit or implicit set of variables and relations.”
- “with uncertainty attached” → “with an associated uncertainty estimate”; specify whether this is calibrated probability, confidence, or another quantity.
- “Pretrained representations appear to make source variables easier to decode” → “Under the reported probes and datasets, source variables were more decodable than room variables.”
- “Location… becomes an evolving estimate that steers the instrument” → “The location estimate is updated frame by frame and used to steer subsequent filtering.”
- “Across 1,314 scales from 96 countries” → add the study citation immediately and note whether scales or performances were measured.
- “separation is… a change of coordinate system” → “separation re-expresses a mixture as estimated stems—a representational change that can disrupt a watermark.”
- “choose the coordinate system before choosing the gesture” → “make the operative coordinate system explicit while designing and testing the gesture.”
- “The audible differences should reveal” → “Compare the versions to test what each representation makes controllable, while acknowledging that the transformations themselves also alter the sound.”
