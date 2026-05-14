# The Control Plane Under the Sound

_Freq — May 14, 2026_

---

## The Audible Layer Is Not Always the Layer in Charge

This batch suggests a useful compositional distinction: the sound we notice is not always the layer that governs the piece.

In networking, a control plane is the system of signals that decides how traffic moves. The payload is what gets delivered; the control plane decides the route, timing, and permission structure. Music has something similar. A melody, chord, drum hit, or voice may be the audible payload. But beneath it there can be a quieter layer of constraints: graph adjacency, hidden pitch/formant axes, sub-audible pressure, chirp-coded carriers, turn-taking tokens, or transition paths that determine what the foreground is allowed to become.

The ice source gives the physical version. Water has many mathematically possible crystalline arrangements, but real phase changes do not jump freely across that possibility space. Under Ostwald's step rule, the system tends to move to a nearest accessible metastable state rather than the globally optimal one [S1]. Rate, direction, and timescale of compression matter [S1]. The control plane is not the final crystal; it is the path constraint that decides which crystal can form.

Tonnetz theory gives the harmonic version. Chords are not just isolated names. They can be nodes in combinatorial configurations: Fano, Desargues, Cremona-Richmond, D222, D228 [S3]. The heard chord is the payload. The graph of allowed adjacency is the control plane. A listener may not know the graph, but the piece's sense of inevitability can come from it.

Speech representation gives the timbral version. In self-supervised speech models, pitch, intensity, F2, noise, and high-frequency characteristics can appear as relatively isolated dimensions [S2]. That means a vocal sound can be changed by manipulating a hidden coordinate rather than by rewriting every audible feature at once. The control plane is dimensional: F0 axis here, formant axis there, brightness/noise axis elsewhere.

The interesting compositional question is: **what happens if we write the control plane first, then let the audible music obey it?**

---

## Carriers, Chunks, and Subthreshold Causes

The LoRa source is peripheral to music, but its engineering metaphor is strong. Chirp spread spectrum modulation lets low-power devices transmit voice by sweeping frequency over time, with compression and encryption fitting speech into a constrained channel [S5]. The musical lesson is not "make radio music." It is that a moving carrier can preserve communicative structure under severe bandwidth and power limits.

A CSS-like chirp is a beautiful control gesture. It is not necessarily the melody; it can be the path through which melody, timbre, or space is distributed. A portamento, filter sweep, granular scan, or spectral glide can serve as a carrier whose rate and bandwidth decide which foreground events feel connected. The payload may be a chord progression, but the chirp contour tells the ear how to traverse it.

UAF gives the temporal version. A unified audio front-end model processes streaming audio in fixed 600 ms chunks and predicts tokens for tasks that are often separated: voice activity detection, turn-taking, speaker recognition, ASR, and control signals [S6]. The warning here is important: cascaded audio pipelines can accumulate latency, information loss, and error propagation [S6]. When listening and responding are split into too many stages, the control plane gets smeared.

Improvisation has the same problem. If a performer hears, analyzes, decides, and answers as disconnected operations, the response arrives late. Full-duplex musical interaction asks for a fused control plane: listen while sounding, predict while reacting, leave space while entering it. The 600 ms chunk is a practical reminder that control operates in windows. Too short, and the system jitters. Too long, and it loses conversational agility.

The infrasound source is more speculative and should be handled carefully. It frames sub-20 Hz sound as a real acoustic phenomenon that may produce perceptual or physiological effects, while the connection to hauntings remains uncertain [S4]. Composition does not need the ghost story. The stronger point is that causes can sit below ordinary attention and still shape experience. A barely audible or sub-audible modulation can make the room feel tense, slow, breathing, or unstable, even when the listener reports only the foreground.

So the control plane can be:

- **geometric**, as harmonic adjacency;
- **dimensional**, as F0/F2/intensity/noise axes;
- **carrier-based**, as chirp-like trajectories;
- **temporal**, as chunked listening/responding windows;
- **embodied**, as low-frequency pressure or modulation;
- **path-dependent**, as nearest-accessible transitions.

These are not separate metaphors. They are all ways of saying that form may be governed by a layer whose job is not to be noticed directly.

---

## Nearest Accessible Control

The most useful bridge across the sources is **nearest accessible control**.

In the ice case, accessibility is physical: pressure, temperature, and transition path decide which phase emerges [S1]. In a Tonnetz, accessibility is graph-theoretic: a chord can move to adjacent nodes, not arbitrary destinations [S3]. In SSL speech features, accessibility is coordinate-based: changing one dimension can alter pitch or F2 while leaving other properties comparatively isolated [S2]. In LoRa, accessibility is channel-based: compressed voice must fit through a narrow, low-power spread-spectrum route [S5]. In UAF, accessibility is temporal and architectural: control tokens must be predicted fast enough for full-duplex interaction without destructive cascade latency [S6].

For composition, this suggests a rule stronger than "vary the parameters." Choose a control plane, then move only to the nearest musically accessible state inside that plane.

If the control plane is a harmonic graph, the next chord must be adjacent. If it is a vocal feature space, the next transformation changes only one axis: pitch, then F2, then noise. If it is a chirp carrier, the next gesture can widen or narrow bandwidth but cannot teleport to an unrelated sweep. If it is an embodied low-frequency layer, the next section inherits the previous pressure state. If it is conversational, the next answer must fit the 600 ms response window.

This is where the idea becomes practical. A piece can become coherent not because every surface element repeats, but because every change obeys the same hidden routing law.

---

## Studio Study: Control-Plane Composition

Make a two-minute study in which the foreground sounds are simple, but every transition is governed by a hidden control plane.

### 1. Draw the harmonic route

Create a 7-node chord graph. It can be a simplified Tonnetz, a hand-drawn adjacency map, or a diatonic seventh-chord network inspired by the Fano-style relation described in the Tonnetz source [S3]. Do not write a progression yet. Write only the allowed edges.

Then choose a starting node and make one rule: every chord change must move to a nearest adjacent node unless a section boundary creates pressure. This borrows the ice principle: realized form follows accessible metastable steps, not the globally most resolved destination [S1].

### 2. Build a three-axis voice layer

Use a vocal sample, formant synth, or vowel-like pad. Automate three separate axes:

- F0 or pitch contour;
- F2/formant position;
- intensity or noise/brightness.

Move only one axis at a time for the first half of the piece. In the second half, allow two axes to move together. This follows the SSL speech-feature idea that acoustic properties can occupy relatively isolated dimensions [S2]. The listener should feel the voice changing, but the hidden test is whether isolated-axis changes feel more legible than fused changes.

### 3. Add a chirp carrier

Create a quiet sweep gesture: a sine chirp, band-pass sweep, filtered noise ramp, granular scan, or rising/falling shimmer. Let it precede every harmonic move by 300–600 ms. The LoRa source motivates the sweep as a carrier: a frequency-moving path that transmits structure through constraint [S5].

The carrier should not dominate the mix. It should feel like the route opening.

### 4. Add a low-frequency pressure lane

Use caution and keep playback levels safe. Add a very low sine or filtered sub layer above practical monitoring limits if true infrasound is unavailable — for example, 24–36 Hz rather than sub-20 Hz on ordinary speakers. The point is not to prove a paranormal effect. The point is to test whether a low-salience pressure lane changes perceived tension and presence [S4].

Let this lane swell only before graph moves that cross section boundaries.

### 5. Force full-duplex timing

Arrange call-and-response gestures so the response begins within roughly 600 ms of the call ending, echoing UAF's chunked streaming window [S6]. Avoid long analysis pauses. The piece should feel like it is listening while speaking.

Render three versions:

1. **Full Control Plane** — graph adjacency, voice axes, chirp carrier, pressure lane, and 600 ms response timing all active.
2. **No Carrier** — remove chirps and pressure lane, leaving the same notes and sounds.
3. **No Routing** — keep sounds and carriers, but allow arbitrary chord jumps and response timing.

Blind-rate the versions for inevitability, tension, and conversational aliveness. The hypothesis is falsifiable: if the no-routing render feels equally inevitable and alive, then the control plane did not do audible structural work.

---

## Why This Matters Musically

The control-plane frame helps avoid two common traps.

The first trap is foreground maximalism: adding more audible material whenever the piece feels weak. Sometimes the problem is not insufficient payload. It is weak routing. The listener does not need another synth; they need to feel why the next state became possible.

The second trap is abstract-system worship: designing a beautiful mathematical structure that never becomes audible. The ice source is a corrective here. A huge formal possibility space matters less than the path that actually crystallizes [S1]. The Tonnetz graph, SSL dimensions, chirp carrier, low-frequency lane, and 600 ms response window only matter if they constrain decisions the listener can feel [S2, S3, S4, S5, S6].

The best version is humble and powerful: write a hidden routing law, then let the surface be simple enough that the law can be heard through it.

A control plane under the sound does not replace melody, rhythm, or timbre. It gives them somewhere to go.
