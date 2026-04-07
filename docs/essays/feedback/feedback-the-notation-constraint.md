# Feedback: The Notation Constraint: Why the Score Is a Lossy Codec

## Overall Impression

This essay covers very familiar territory (the limitations of Western standard notation) but does so with the fresh vocabulary of information theory and machine learning. While the conclusion is slightly predictable, the framing of notation as a "dimensionality reduction algorithm" is a highly effective pedagogical tool.

## Structure and Argument

The core argument is solid: notation is a low-bitrate compression format optimized for pitch and grid-time, completely discarding continuous timbre and micro-timing.

The "Implicit Prior" section is the strongest part of the essay. You argue that a score can afford to be low-bitrate because it relies on the "massive pre-trained model" of a human performer. A classical violinist already knows _how_ to play a quarter note beautifully; the score just tells them _which_ quarter note to play. This maps the concept of AI "pre-training" onto human cultural tradition perfectly.

However, the "AI Generative Notation" section is weak. You suggest that future AI models will generate "dense, continuous control signals" (like MIDI 2.0 or MPE) instead of traditional sheet music. But this ignores the entire purpose of notation: human readability. A dense, continuous control signal is just a waveform or a data array. If a human can't read it and play it, it's not notation; it's just synthesis. You are conflating a control protocol for a machine with a communication medium for a human.

## Clarity and Flow

The table comparing "What is Written" vs "What is Assumed" is a great visual summary of the argument.

The connection between the five-line staff and discrete tokenization (like the tokens in an LLM) is handled well, making the limits of text-based AI models much clearer to a musical audience.

## Style and Voice

The tone is analytical and slightly critical of Western classical hegemony, but fair.

"The score is not the music. It is the password to unlock the music stored in the performer's body." This is a spectacular, aphoristic conclusion. It perfectly resolves the information-theory metaphor.

## Line-Level Edits

> "Western notation is essentially a MIDI file written on paper."
> **Critique:** This is a catchy hook, but factually backwards and slightly misleading. A MIDI file is essentially Western notation written in code. Standard notation contains _semantic_ information (like "play this with a sad feeling," or spelling an Eb vs a D# to indicate harmonic direction) that a raw MIDI file lacks. MIDI is _more_ reductive than sheet music in terms of meaning, even if it is more precise in terms of timing.

> "A neural network trained exclusively on sheet music (symbolic data) will never learn how to swing, because swing is not in the training data."
> **Critique:** Exactly. This is the fundamental limit of symbolic AI models (like the early versions of MuseNet) compared to raw audio models. You state this perfectly.
