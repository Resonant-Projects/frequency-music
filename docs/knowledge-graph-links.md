# Knowledge Graph Links

Durable in-repo concept links captured when live Convex graph writes are unavailable.

## 2026-08-09 - The Evidence Carrier

- `evidence carrier` -> `voice between domains`: voice identity can be borne by phone content, pitch contour, timbre, turn-taking, or stem relation.
- `evidence carrier` -> `fair test`: benchmark validity depends on controlling which evidence carriers are legitimate for the task.
- `evidence carrier` -> `plastic tone`: pitch identity can move between the fundamental, upper partials, noise, and spectral salience.
- `evidence carrier` -> `semantic alignment`: matching high-level musical meaning removes an irrelevant evidence carrier from deepfake detection.
- `evidence carrier` -> `room fingerprint`: a target-position impulse response can carry location identity without proving transferable acoustic understanding.
- `evidence carrier` -> `pitch authority`: pitch strength names how strongly a spectral carrier is allowed to count as a tone.
- `carrier reassignment` -> `composition control`: identity can remain partly recognizable while the evidence path that supports it changes.

Evidence context:

- Voice-between-domains essay and extractions: `j97e60hzvdd4v5pvvab4dv4jed8av6vz`, `j977bjx4mn520e8ebrmvjvnrw58agpf6`, `j97d5cc9xwxhv524jre9q1r36s8at5bn`, `j97f7yq3rv85mv7jkhvy1r0fbx8arevy`
- Fair-test essay and extractions: `j97bt3nyk8vhkpchhncydmk7v18av5ta`, `j97679y1jf7cnhkg7f2v6t2mz18b0wvf`, `j97449t2gg1cqfff5nrqf1fa5d8atd0x`, `j9718kahkvm0zmm4watm7bt0kd8avqh4`
- Plastic-tone essay and extractions: `j978yxjgnckm2px83ae5dqwgq18ajxwm`, `j9762aqawbwmrwvhgfwrns5m398aj4d3`

## 2026-08-09 - The Voice Between Domains

- `voice between domains` -> `phonetic posteriorgram`: phone-like content can be separated from pitch and timbral identity for voice conversion.
- `voice between domains` -> `pitch contour`: speech and singing share a controllable trajectory layer that is not identical to symbolic notes.
- `voice between domains` -> `speaker identity`: timbre conditioning can act as performer identity when a music model is adapted to voice.
- `voice between domains` -> `turn-taking prosody`: conversational naturalness depends on social timing, not only utterance-level audio quality.
- `voice between domains` -> `stem boundary`: vocal and accompaniment separation can be generated as a hard edit surface or softened as an entangled musical relation.
- `phone content` -> `vocal identity`: a vocal transformation can preserve who is heard while damaging what is said, or preserve articulatory content while changing the performer.
- `symbolic hierarchy` -> `vocal control`: pitch register and rhythmic density provide higher-level structure that complements waveform-level phone, prosody, and timbre controls.

Evidence context:

- Diffusion-based music-to-voice conversion extraction: `j97e60hzvdd4v5pvvab4dv4jed8av6vz`
- Dialogs expressive conversational speech corpus extraction: `j97d5cc9xwxhv524jre9q1r36s8at5bn`
- WanSong diffusion song-generation extraction: `j97f7yq3rv85mv7jkhvy1r0fbx8arevy`
- MIDI-RAE-JEPA symbolic hierarchy extraction: `j970n5akmsx33bh4mbg65yfmex8ape41`
- PhoneticXEUS universal phone-recognition extraction: `j977bjx4mn520e8ebrmvjvnrw58agpf6`

## 2026-08-08 - The Fair Test

- `fair test` -> `semantic alignment`: align examples so models cannot solve the wrong high-level distinction.
- `fair test` -> `data leakage`: withhold unavailable deployment inputs, especially target-position acoustic fingerprints.
- `fair test` -> `annotation trimming`: tighten boundary targets when wide tolerance inflates structure-analysis scores.
- `fair test` -> `representation probing`: measure which latent factors an audio encoder actually preserves.
- `fair test` -> `uncertainty modeling`: represent distributed human judgments instead of forcing a single point target.
- `semantic alignment` -> `music deepfake detection`: generated and bona-fide tracks should be matched at the song-descriptor or waveform-conditioned level before detector cues are trusted.
- `room fingerprint` -> `receiver-position generalization`: a target impulse response can identify a measured position without teaching transferable room behavior.
- `boundary tolerance` -> `musical form`: section-boundary scores depend on how much temporal ambiguity the benchmark allows.

Evidence context:

- Echoes music deepfake extraction: `j97bt3nyk8vhkpchhncydmk7v18av5ta`
- Music structure analysis extraction: `j97449t2gg1cqfff5nrqf1fa5d8atd0x`
- SARL spatial-audio probing extraction: `j9718kahkvm0zmm4watm7bt0kd8avqh4`
- Room-acoustics input-availability extraction: `j97679y1jf7cnhkg7f2v6t2mz18b0wvf`
- Song-aesthetics uncertainty extraction: `j974tpzp5kn0t4vkymg6bfhbz98ax0gv`

## 2026-08-08 - The Resolution Grid

- `resolution grid` -> `translation loss`: a representation preserves identity only on the layer/grid it can resolve.
- `resolution grid` -> `rhythm formant`: low-frequency amplitude modulation acts as a temporal grid for rhythmic identity.
- `resolution grid` -> `critical band`: Bark-scale bands act as a perceptual spectral grid for masking and separability.
- `resolution grid` -> `phase coherence`: phase-sensitive timing and interference act as a relational grid for ensemble coherence.
- `semi-fragile watermark` -> `translation loss`: watermark survival separates benign surface change from identity-changing transformation.
- `accessible phase` -> `resolution grid`: transformation paths land in nearest reachable forms constrained by the active representation.
- `voice vector` -> `resolution grid`: vocal identity can be distributed across separable grids: identity, content, time, state, and surface.

Evidence context:

- Rhythm formant extraction: `j97dmcxraattrt4e9gsc7dsp4185rj2e`
- Bark24 extraction: `j977tjh3ka74caprsf86d4e3y185maah`
- StreamMark extraction: `j97b5cq4em4evnpz1dzpjk37y1854ztc`
- PHALAR extraction: `j978zvv39t3wqdw578e6g057b18683jf`
- MSU-Bench extraction: `j978mypywk23f3gtf3ykz84q4x85j102`
- Ice phases extraction: `j97dwcq0crkhg0n8z2tmyqypfd86f0ny`

## 2026-08-08 - The Plastic Tone

- `plastic tone` -> `pitch strength`: pitch identity can be treated as a variable salience rather than a binary property.
- `plastic tone` -> `inharmonicity`: a tone's transformation space depends on whether inharmonicity comes from noise or from discrete partial interactions.
- `plastic tone` -> `spectral flatness`: lower flatness can mark tonal structure that remains available for developmental or compositional transformation.
- `plastic tone` -> `harmonic complex tone`: a single source can distribute pitch authority across upper partials and imply multiple melodic lines.
- `plastic tone` -> `developmental vocal plasticity`: learnable vocal identity can be modeled as change across age-conditioned latent trajectories.
- `pitch authority` -> `composition control`: a producer-facing control can specify where tonal evidence should be strongest without changing nominal pitch.

Evidence context:

- Pitch strength extraction: `j978yxjgnckm2px83ae5dqwgq18ajxwm`
- Inharmonicity/noisiness extraction: `j9762aqawbwmrwvhgfwrns5m398aj4d3`
- Trajectory variance birdsong extraction: `j97ckpqqxzkj19gbw70dkwhk218ahj6w`
- Harmonic complex tone extraction: source title "Musical phrase perception from monophonic harmonic complex tones" in recent candidates
