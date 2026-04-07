# Everything Is a Resonant Body

**Essay #80** — March 31, 2026

_How rooms, faces, chips, and neural networks all act as transfer functions — and what that means for composition._

---

## The Idea

A violin body takes string vibration and transforms it. A concert hall takes the violin's output and transforms it again. Your skull takes the hall's output and transforms it once more before it reaches your cochlea. At every stage, a physical structure imposes its own transfer function on sound — amplifying some frequencies, damping others, adding resonances, shaping the temporal envelope.

This is obvious when we're talking about instruments and rooms. What's less obvious is that this same principle — _input signal × resonant body = colored output_ — operates at every level of audio processing, from neuromorphic chips to neural networks to the human face.

## Four Resonant Bodies

### 1. The Room (UPV_RIR_DB)

A room impulse response is the acoustic fingerprint of a space. The UPV_RIR_DB dataset contains 18,976 individual impulse responses across three rooms, systematically catalogued with spatial metadata. Each response encodes the full acoustic behavior of a specific location within a specific space: reverberation time, early reflections, modal resonances, the lot.

The key insight is that a room _is_ its impulse response. You don't need to describe a room's geometry, materials, and furnishings to characterize its acoustic behavior — you just need the transfer function. The room is a resonant body, and convolution with its impulse response is the complete description of what it does to sound.

### 2. The Face (DiFlowDubber)

DiFlowDubber generates dubbed speech synchronized to lip movements in video. Its surprising claim: facial expressions contain sufficient information to capture global prosody and stylistic cues. The face isn't just moving in response to speech — it's acting as a resonant body that shapes the acoustic output.

This is literally true in a physical sense. The vocal tract, nasal cavity, and oral cavity form a coupled system of resonant chambers. When you change your facial expression, you change the geometry of these chambers, which changes the transfer function applied to the glottal source signal. Vowel formants are the resonant frequencies of this system. A smile literally changes the resonant body.

But DiFlowDubber suggests something deeper: the visual configuration of the face is so tightly coupled to the acoustic transfer function that you can _infer_ the sound from the shape. The resonant body's geometry predicts its output.

### 3. The Chip (Neuromorphic MFCC)

The neuromorphic MFCC paper replaces traditional frequency-domain transforms (FFT → mel filterbank → DCT) with reservoir computing — a system where a fixed, randomly connected network of nodes acts as a dynamical system that naturally separates input signals into discriminable features.

A reservoir computer is a resonant body. Its internal dynamics — the way signals reverberate, interfere, and decay through its network of connections — impose a transfer function on the input. The paper's core claim is that this physical resonance can replace the carefully engineered mathematical pipeline that mimics human auditory processing. The chip's structure _is_ the analysis.

What's remarkable is the biological connection: the cochlea itself is a resonant body. Hair cells along the basilar membrane respond to different frequencies based on their position and mechanical properties. The neuromorphic chip replaces one resonant body (the mathematical model of the cochlea) with another (the physical dynamics of the reservoir).

### 4. The Network (SELVA)

SELVA generates isolated audio for specific sound sources in video, using text prompts to select which source to synthesize. It learns to map visual features to acoustic output — but only for the specified source, suppressing everything else.

The trained neural network acts as a selective resonant body. Given visual input, it "resonates" only with the features corresponding to the text-selected source and produces audio that matches. It's a programmable transfer function: the text prompt tunes the resonant body's response characteristics.

This is analogous to sympathetic resonance in physical instruments. A snare drum's snare wires vibrate in response to specific frequency components of other instruments playing nearby. The snare is a selective resonant body — it responds to some inputs and not others, based on its physical tuning. SELVA's text conditioning is the digital equivalent of tuning the snare wires.

## The Transfer Function as Compositional Unit

If everything is a resonant body, then composition is the art of choosing and sequencing transfer functions.

This isn't just a metaphor. Consider what a composer actually does when they orchestrate:

1. **Choose the source signal** — a pitch, a rhythm, a noise
2. **Choose the first resonant body** — the instrument (violin body, brass bell, drum shell)
3. **Choose the second resonant body** — the room (concert hall, studio, bathroom)
4. **Choose the third resonant body** — the listener's context (headphones, car speakers, open air)

Each stage multiplies the signal by a transfer function. The final sound is the convolution of all these stages. Orchestration is transfer function design.

This framework suggests several compositional strategies:

### Resonant Body as Instrument

Use rooms, objects, and spaces as instruments rather than containers. Alvin Lucier's _I Am Sitting in a Room_ (1969) is the canonical example: the room's transfer function is the composition. Each iteration of re-recording filters the speech further through the room's resonances until only the room's eigenfrequencies remain. The room speaks.

### Transfer Function Morphing

If you can smoothly vary a transfer function over time, you get a new kind of musical gesture — not a change in pitch or rhythm, but a change in _resonant character_. Spectral composers like Grisey and Murail work in this space, treating the evolving spectrum as the primary musical parameter. Digital convolution makes this explicit: crossfade between two impulse responses and you've morphed one resonant body into another.

### Sympathetic Selection

Like SELVA's text-conditioned source selection, you can design resonant systems that respond selectively to specific inputs. A prepared piano is a crude version — objects placed on strings change which harmonics are amplified and damped. A more sophisticated approach: design digital resonant bodies that "listen for" specific spectral features in a live input and respond only to those, creating a system that plays back its own selective perception of the input.

### Impulse Response as Score

If a room's impulse response fully characterizes its acoustic behavior, then an impulse response _is_ a kind of score — a complete specification of how the resonant body will transform any input. You could compose by designing impulse responses: sculpting the temporal and spectral shape of the room's response as a creative act, then "performing" by choosing what signals to send through it.

## The Deeper Pattern

Why does the resonant body metaphor work at so many levels? Because resonance is what happens when a system with memory encounters a periodic input. The room remembers (reflections take time to decay). The cochlea remembers (hair cells have mechanical inertia). The reservoir computer remembers (signals reverberate through its connections). The neural network remembers (weights encode training history).

Memory + periodic input = selective amplification = resonance.

This is why transfer functions appear everywhere in audio: any system that has temporal memory will inevitably act as a frequency-selective filter. It's not a design choice — it's a physical necessity. And if every system in the audio chain is a resonant body, then the compositional question becomes: _which memories do you want your sound to pass through?_

---

## Sources

- **UPV_RIR_DB** — Multichannel room impulse response database (166 files, 18,976 individual IRs, 3 rooms)
- **DiFlowDubber** — Video dubbing via discrete flow matching; facial expressions encode prosody
- **Neuromorphic MFCC** — Reservoir computing for perceptual audio feature extraction
- **SELVA** — Text-conditioned selective video-to-audio generation

## Compositional Prompt

Design a piece where the primary musical parameter is the resonant body itself. Start with a simple, repeated impulse (a click, a burst of noise) and route it through a sequence of real and synthetic impulse responses — rooms of different sizes, instrument bodies recorded and deconvolved, even the transfer functions of neural networks exported as IRs. The "melody" is the changing character of the resonance. The "harmony" is what happens when two resonant bodies are convolved together.
