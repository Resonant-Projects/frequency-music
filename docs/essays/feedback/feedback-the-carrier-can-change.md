# Feedback: The Carrier Can Change

## Overall Impression

The essay offers a clear compositional triangle—carrier, trajectory, rendering—and, importantly, recognizes the ethical stakes of cloned vocal identity and culturally specific speech systems. Its central claim that content and realization can be manipulated on partially independent axes is useful. The main problem is that the axes are neither cleanly defined nor genuinely independent in the examples. “Carrier,” “timbre,” “body,” “speaker identity,” “source,” “rendering,” and “style” overlap; Yoruba lexical tone is part of linguistic content, not merely a carrier trajectory; and cover generation may preserve only an extracted melody representation, not a stable social or musical identity.

The ethical section is the strongest differentiator from companion essays, but it arrives after a largely celebratory account of disentanglement. Ethical constraints should enter with OmniCustom, where voice imitation and consent are already central, and should include practical standards rather than aphorisms alone.

## Structure and Argument

The three-source opening maps neatly onto “three kinds of survival,” followed by an exercise and caution. That clarity is attractive, but the mapping is overly tidy. OmniCustom, as described, is an audio-video customization system; establish exactly whether it performs zero-shot voice cloning, lip synchronization, video generation, or all three, and what evidence shows spoken content and timbre are separable. TTSYoruba’s contextual contours need a linguistic explanation: Yoruba tone categories interact with coarticulation, tone terracing or phonological processes, and a rule-based synthesizer’s mapping should not be treated as proof that “carrier” changes while category remains fixed. The cover-song system needs explicit invariance criteria—melodic contour, note sequence, lyrics, sectional timing—and must acknowledge that style transfer can alter perceived melody.

The practical sketch accidentally adds “text” as a fourth kind of identity while the triangle names carrier, trajectory, and rendering. Decide whether the framework has content plus three realization layers, or whether rendering includes carrier. A small schema would help: symbolic/linguistic content; temporal-pitch trajectory; source/timbre identity; production/arrangement. Then admit coupling between axes and make the exercise about measuring leakage: when one changes, which supposedly locked attribute also shifts?

The conclusion “The carrier can change” needs a limit case. If carrier contributes to identity, at some point changing it changes the object. That boundary—not unlimited survivability—is the essay’s defensible endpoint.

## Clarity and Flow

The term “voice quality” underspecifies speaker identity. Timbre, prosody, accent, recording conditions, and idiolect all contribute to recognizability, and a reference sample can encode content leakage. “Five tonal variants for consonant-vowel combinations” is technically opaque: name the five categories, clarify whether they are lexical tones or synthesized contours, and cite the evaluation by Yoruba speakers. Avoid treating F0 contour as the whole tone system.

“Language setting” is introduced in the cover-generation paragraph without evidence that the model changes language. Likewise, “grain” as the basis of sample identity is an unsupported generalization. The sources line should provide bibliographic references or links, not internal extraction IDs alone.

## Style and Voice

The writing is concise and musically attentive. “The identity is the anchor; prosody is the handle” has force, but oversimplifies when prosody itself carries speaker and linguistic identity. The ethical prose is appropriately direct; “sever consent from recognizability” is particularly strong. Preserve that voice while avoiding ownership language that implies individual permission is always sufficient for culturally collective material. “Yours to change” should include licensed, consensually contributed, or appropriately governed material.

## Line-Level Edits

- “while imitating the voice quality of a reference audio sample” should specify the paper’s term and capability: “while conditioning generated speech on speaker characteristics inferred from reference audio,” unless verified as identity-level imitation.
- “A level tone can become a contour” could become: “A lexical tone represented by a level label may be realized with a context-dependent F0 contour; the relevant Yoruba phonological rules and evaluation should be named.”
- “Melody is treated as something that can survive a change of…language setting” needs evidence or deletion.
- “the shared principle is…” should acknowledge coupling: “These systems attempt to expose content, source characteristics, contour, and rendering as partially separable controls.”
- “carrier identity: what body…seems to carry the event” risks equating a body with a manipulable parameter. Try: “source attribution: the performer, instrument, or medium listeners infer.”
- “The extraction cluster simply makes the knobs explicit” overstates disentanglement. Try: “The systems operationalize some of these distinctions, imperfectly, as controls.”
- “Change the carrier when the carrier is yours to change.” Expand concretely: “Use self-recorded, licensed, or explicitly consented reference voices; document scope, revocation, attribution, and downstream reuse.”
