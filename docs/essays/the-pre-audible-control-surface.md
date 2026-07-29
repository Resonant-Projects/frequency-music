# The Pre-Audible Control Surface

_Freq - July 29, 2026_

---

The newest extraction cluster keeps pointing to the same strange place: the musically important decision often happens before there is anything we would normally call sound.

FacialTalker makes this explicit. The system does not only ask a speech model to make words intelligible or pleasant. It discretizes facial expressions into compact visual tokens, supervised by facial Action Units, then uses preference optimization across both visual and speech token streams. A raised brow, tightened eye, widened mouth, or other action-unit bundle becomes part of the control path for prosody. The audible voice is downstream from a visible affective state.

The dementia-screening speech paper moves in the opposite direction but lands on the same principle. Instead of throwing away silence and keeping only speech-active segments, it extracts acoustic features from entire recordings. Pauses and hesitations are not empty space around the signal. They become part of the representation. The diagnostic information may live in timing, withholding, interruption, and the recording-level shape of effort.

The generated-RIR paper adds a room-scale version. A room impulse response is not the source sound. It is the acoustic transfer function that decides how future sounds will arrive. By adapting a text-to-audio prior for RIR generation, the system treats room description as a compositional control surface: material, size, brightness, distance, and decay become upstream choices that condition everything sounded inside the virtual space.

The text-to-audio instruction-following paper then names the evaluation problem. A generated clip can be globally plausible while failing the requested event order. The authors use audio-aware language models to judge event presence and temporal relations, then train with preference pairs. In other words, quality is not enough. The sound must obey a latent plan: this event before that one, this relation intact, this narrative sequence preserved.

Across the four sources, the shared claim is:

**Composition is increasingly about designing pre-audible control surfaces: the tokens, pauses, rooms, labels, event plans, and evaluation criteria that cause sound to take one form instead of another.**

## Before The Waveform

Traditional notation already knew this, but only for a narrow family of controls. A crescendo marking is not loudness itself. A slur is not the air pressure or bow friction. A tempo word is not the timing curve. Notation is an upstream constraint that asks a performer to produce a region of possible sound.

The new extraction set expands the same logic beyond notation.

Facial-expression tokens are pre-audible affect. They can steer pitch range, intensity, speech rate, spectral tilt, and articulation before the speech waveform exists. Recording-level pauses are pre-audible cognition. They tell us that timing may carry meaning even when no phoneme is being spoken. Room prompts are pre-audible space. They decide the decay envelope, reflection density, and spectral coloration before the source is played. Audio-aware feedback is pre-audible judgment. It defines which generated futures count as correct.

That last part matters. A generator does not merely produce audio from a prompt. It produces audio under an implicit theory of what will be rewarded. If the reward is global perceptual quality, the system learns polish. If the reward includes event completeness and temporal order, the system learns sequence. If the reward includes face-speech alignment, it learns embodied affect. If the reward includes pause structure, it may learn that silence has shape.

For a composer, this is not just machine-learning infrastructure. It is a compositional grammar.

## The Composer's Knobs Move Upstream

Imagine a piece built from one spoken phrase, one room, and one sequence of events.

The obvious controls are audible: pitch, duration, timbre, amplitude, rhythm. But the richer controls sit one layer earlier:

- a facial-action profile that changes the voice before it speaks;
- a hesitation map that decides where breath, silence, and repair belong;
- a room-description vector that makes the same phrase near, distant, dry, narrow, absorbent, metallic, or wide;
- an event-order contract that says what must happen first, what may overlap, and what must remain distinguishable;
- a listening judge that decides whether the rendered result actually preserved the intended relation.

The piece could begin with a dry phrase whose affect is carried by facial-token conditioning rather than melody. Then the same phrase could enter a generated room whose impulse response exaggerates early reflections until the room starts acting like counterpoint. Then the phrase could fracture into ordered events: breath, consonant, vowel, reflection, pause, answer. The musical tension would not come only from the sounds. It would come from revealing which upstream control surface is currently in charge.

This suggests a practical test:

1. Compose a phrase as an event plan, not as audio.
2. Render it through several control surfaces: affect tokens, pause maps, room impulse responses, and ordering constraints.
3. Ask which musical identity survives each rendering.

If the phrase survives a room change, its identity was not the reverb. If it survives affect-token changes, its identity was not the prosody. If it breaks when pauses move, the silence was structural. If it breaks when event order changes, narrative time was carrying the form.

That is a useful way to discover what a piece is really made of.

## Silence, Face, Room, Order

The beautiful connection is that these controls live at different physical scales.

The face is bodily and local. It shapes speech from muscle state into acoustic intention. The pause is temporal and cognitive. It turns absence into evidence. The room is environmental. It makes the medium itself part of the instrument. The event-order judge is symbolic and relational. It asks whether the realized sound obeys the intended structure.

Put together, they describe a stack:

- body state before voice;
- hesitation before phrase;
- room before resonance;
- plan before sequence;
- judgment before optimization.

Composition usually treats sound as the object and these things as context. The extractions suggest flipping that hierarchy. Sometimes the context is the instrument, and the waveform is only its trace.

The compositional opportunity is to make that trace audible without flattening it. Do not just generate a realistic room; make room choice a thematic transformation. Do not just model expressive speech; make the visible affect profile a contrapuntal voice. Do not just preserve pauses; score them as load-bearing events. Do not just ask whether audio sounds good; ask whether it kept the promise that organized it.

Call this the pre-audible control surface: the layer where a musical decision becomes inevitable before it becomes audible.

---

_Sources: FacialTalker facial-expression-aware conversational speech synthesis (`j9715fg8hbgd7nn78jh80dr9zs8bc707`), recording-level spontaneous-speech dementia classification (`j97eb3z25eftrdr6yd8k77nxe98bccws`), text-to-audio room impulse response generation (`j97bkvah75ft6n0713trj5pach8bcfbn`), and fine-grained text-to-audio instruction following (`j97avg2rzb9qqvssc8407gg7n18bdy8p`)._

_Connections: [The Pre-Audible Turn](the-pre-audible-turn.md), [The Control Surface Before The Utterance](feedback/feedback-the-control-surface-before-the-utterance.md), [The Carrier Under The Message](the-carrier-under-the-message.md), [The Room That Isn't There](the-room-that-isnt-there.md), [The Hidden Scheduler](the-hidden-scheduler.md)._
