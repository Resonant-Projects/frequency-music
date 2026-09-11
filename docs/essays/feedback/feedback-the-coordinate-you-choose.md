# Feedback: The Coordinate You Choose

## Overall Impression

The essay’s breadth and sectioning make it readable, and its best claim is practical: every audio tool embeds a measurement frame, whether or not that frame is exposed to the musician. The StemFX and Fretiq sections are particularly effective because they show how a representational choice enables a specific edit or reveals a generalization failure. The essay nevertheless uses “coordinate” so broadly—trajectory, effect sequence, MFCC feature vector, annotation policy, phonetic feature metric, perceptual attribute—that the term threatens to become a synonym for “methodological choice.” A precise taxonomy would preserve the conceptual reach while preventing dilution.

## Structure and Argument

The opening survey promises six examples, but only three receive dedicated sections; structure trimming, SARL, Echoes, PhoneticXEUS, and pitch strength are compressed into “Tests Also Choose Coordinates.” That imbalance makes the piece feel like two essays joined together: one about creative control representations and one about evaluation validity. Either narrow the essay to the three developed cases or split the later material into evaluative coordinates and give it comparable analysis.

“Restoration as a path” makes a large conceptual inference from a one-step Schrödinger Bridge model. A bridge-based training formulation can define a stochastic trajectory even if inference uses one step, but the essay needs to explain whether users can actually choose intermediate points. Without such controllability, “where along that bridge should the sound live?” is a compositional proposal, not a feature of the method. State this distinction explicitly.

The StemFX discussion convincingly argues that an ordered chain is more inspectable than an opaque style embedding. Yet it assumes the tokenized chain is editable, interpretable, and sufficient to capture style. Discuss limitations: source separation errors, parameter non-identifiability, nonlinear interactions, and musical choices not represented as effects.

The Fretiq section appropriately notes the held-out performance gap, but it needs exact results and protocol details before drawing lessons about MFCCs and “collection ritual.” A shuffled split can leak performer, phrase, session, or recording conditions; identify which confound the paper establishes rather than speculating.

The five-version studio exercise is concrete, but version four (“move the perceived section change”) is not equivalent to changing annotation-boundary tolerance. It turns an evaluation coordinate into a compositional manipulation. Either explain that deliberate translation or instead score the same transition under different tolerances.

The conclusion repeats the thesis across three successive paragraphs. Condense “The Research Handle” and the final two paragraphs into one ending that distinguishes chosen coordinates from properties inherent in the waveform.

## Clarity and Flow

Define coordinate as a variable, basis, or structured representation used to compare and intervene in sound, then subdivide it: generative, perceptual, and evaluative. “Each measurement creates a different musical object” is philosophically strong but empirically too absolute; measurements produce different descriptions and available actions, not necessarily different objects.

Technical precision is uneven. “One inference step” should not be equated with committing to “a point on the path” unless the algorithm supports that reading. MFCCs are not simply “a small spectral fingerprint”; they compress spectral-envelope information and may encode instrument, channel, and articulation cues. Phone feature error rate also needs a short definition.

## Style and Voice

The studio-centered voice is strong, especially “style is a sequence of decisions attached to musical bodies.” Keep the tactile language while reducing evaluative adjectives such as “beautiful correction,” which pre-judge the argument. The text sometimes anthropomorphizes models (“hears restoration,” “hears string identity”); make clear that this is shorthand for a representation’s inductive bias.

## Line-Level Edits

- “which coordinates the sound lives in” → “which variables and relations will represent the sound for the task at hand.”
- “each measurement creates a different musical object” → “each measurement makes a different aspect of the musical object available for inference or control.”
- “where along that bridge should the sound live?” → “Could the trained trajectory be exposed as a controllable continuum between corrupted and estimated-clean audio?”
- “One-step inference… commits to a point on the path.” → “One-step inference prioritizes latency; it does not by itself expose intermediate restoration states.”
- “MFCCs become the coordinate that makes that trace actionable” → “MFCCs and related spectral features make some string-dependent cues decodable, though they may also capture session-specific confounds.”
- “a coordinate can overfit the ritual” → “a feature-and-split design can reward cues specific to the collection protocol.”
- “Music-structure analysis scores depend on whether boundary annotations are trimmed.” → explain what “trimmed” means and why it changes the target or metric.
- “The right coordinate” → “A useful coordinate for a given task”; “right” implies a unique optimum.
- “The coordinate you choose becomes the instrument” → “The coordinates a tool exposes shape the instrument it becomes.”
