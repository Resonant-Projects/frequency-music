# The Mixable World

Aurchestra makes a quiet but important claim about listening: an acoustic scene can become a mix.

The system is framed for augmented hearing. Instead of giving a listener one blunt control, such as global noise suppression, or one spotlight, such as a single target sound, it extracts separate streams for selected environmental sound classes. Those streams can then be adjusted independently, "much like an audio engineer mixes tracks." The reported limits are concrete enough to matter compositionally: real-time operation on 6 ms streaming chunks, and robust control of up to five overlapping target sounds.

That matters because it changes the ontology of the room. A cafe, street, rehearsal, kitchen, or train platform stops being one summed waveform and becomes a small console. Speech, traffic, machinery, footsteps, water, and music can each be made louder, softer, nearer, or less insistent. The listener is no longer only adapting to the scene. The scene is adapting to the listener.

The recent hydroacoustic extraction points to the same transformation at another scale. A self-supervised pipeline trains on spectrogram reconstruction, turns informative patches into event-level embeddings, and clusters years of low-frequency recordings near Mayotte Island. In that case the output is not live faders but a navigable catalog: 317 clusters manually mapped to 15 hydroacoustic classes or noise categories in under an hour. The ocean, too, becomes less like an undifferentiated recording and more like a set of addressable layers.

These systems are not equivalent. Aurchestra is real-time and user-facing; the hydroacoustic pipeline is exploratory and scientific. But both enact the same compositional move:

> Make the mixture addressable before deciding what the mixture means.

PS4, the target-speaker extraction system, supplies the interpersonal version. It uses enrollment audio, transcripts, voice-activity labels, speaker similarity, ASR loss, and perceptual quality to pull one speaker through overlapping conversation. The point is not merely denoising. It is preserving an identity strongly enough that a crowded speech mixture can be rebalanced around that identity.

Put together, the three sources describe a spectrum of mixability:

- Aurchestra: class-conditioned faders for a live environment.
- Hydroacoustic clustering: event classes for long-duration ecological listening.
- PS4: identity-conditioned extraction for overlapping human voices.

The compositional insight is that "source separation" is too small a name for this. Separation is the technical act; mixability is the musical affordance. Once a system can expose stable layers, the artist can automate attention. A city recording can swell only its mechanical rhythms while leaving voices ghosted. A field piece can move between seasonal marine-mammal patterns and anthropogenic noise without treating the ocean as background texture. A vocal ensemble can let one singer's consonants cut through while the breath and room remain shared.

The danger is also musical. A mixable world can become a domesticated world, where every inconvenient sound is reduced to a slider. That would miss the deeper opportunity. The best use is not always suppression. It may be counterpoint: letting environmental layers answer one another, exaggerating a normally ignored class until it becomes thematic, or revealing that a "noise" category has internal rhythm, seasonality, and identity.

For a practical tool, the interface should therefore avoid only offering mute and solo. It should offer compositional verbs:

- foreground, background, and shadow a class;
- preserve identity while changing density;
- scan clusters as motifs rather than labels;
- automate attention across time;
- expose residual bleed as a controllable color rather than a failure.

This connects back to the aligned control surface. A fader becomes meaningful only when the system has made a promise about what the fader controls. "Birds" is not a useful control unless the model can hold birdness steady enough across wind, distance, overlap, and microphone condition. "Target speaker" is not useful unless identity survives extraction. "Hydroacoustic event" is not useful unless a cluster carries repeatable acoustic structure.

The mixable world is therefore not a fantasy of total control. It is a discipline of partial, testable controls. A scene becomes composable when some of its sources can be named, followed, and transformed while the rest of the world keeps leaking through.

That leakage may be the most important part. It reminds the composer that real listening is not a spreadsheet of stems. It is a negotiation between addressable structure and unresolved mixture. The new tools are powerful because they move the boundary, not because they erase it.

_Sources: recent extractions `j975t7frqwkx8wa1p26nshczhh8aefmy` (Aurchestra multi-class augmented-hearing control), `j977hrtynjz4cbrjsjw20zer3d8af58j` (self-supervised hydroacoustic event clustering), and `j976zkb1rmy7699zrsyz97nv2d8advqj` (PS4 target-speaker extraction)._
