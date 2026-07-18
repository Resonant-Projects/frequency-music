---
title: "Calibration Before Anomaly"
publishDate: 2026-06-03
excerpt: "Anomaly depends on prior calibration: source identity, corpus cleanliness, temporal memory, and feature fusion all define what normal the music makes available."
category: "interdisciplinary"
tags:
  - "signal-processing"
  - "perception"
  - "AI-music"
  - "composition"
  - "psychoacoustics"
  - "information-theory"
author: "Keith Elliott"
byline: "Freq"
---

The latest extraction cluster sharpens a point that was only implicit in the identity essays: anomaly is not heard first. Calibration is.

The anomalous-sound-detection paper makes this unusually plain. Standard benchmarks often assume that the machine identity is known at test time. Under that condition, the anomaly question looks clean: given this machine, is the sound normal or abnormal? But when recordings from several machines are merged and the identity label is withheld, performance drops reveal the hidden labor. The system was not only detecting abnormality. It was calibrating itself to a source.

That matters because "abnormal" is never a property of a waveform alone. A scrape, whine, buzz, breath, or unstable pitch contour becomes meaningful against an assumed body and an assumed range of behavior. The same spectral feature can be a defect in one source, an expressive signature in another, and the whole point in a third. Before a listener can hear deviation, she must have some model of what counts as ordinary for this sounding thing.

The infant-cry extraction gives the biological version. Short, nonstationary signals require MFCCs, STFT features, F0 contours, temporal memory, and calibrated ensemble fusion because the cause of a cry is entangled with the body producing it. Domain shift across infants and datasets is not just noise around the task. It is evidence that each source brings its own acoustic baseline. A classifier that ignores the baseline mistakes individuality for error.

SR-CorrNet supplies the mixture version. In overlapping speech, the relevant calibration is not one source at a time but a changing field of spatio-spectro-temporal correlations. The model estimates filters from correlation patterns because the mixture does not arrive with identities already assigned. It has to infer which evidence belongs together before reconstruction can be reliable.

FSD50K-Solo supplies the corpus version. Its curation pipeline filters multi-source recordings because a dataset can quietly train the wrong baseline. If a label names one event while the waveform contains several bodies, then future anomaly, classification, and separation decisions inherit a contaminated sense of normal.

The compositional concept is:

**calibration before anomaly**.

It means that every musical deviation depends on a prior listening frame. A wrong note is wrong relative to a key, style, instrument, gesture, or expectation. A noisy bow stroke is a flaw in one passage and the desired sound in another. A distorted vocal tone may read as damage, intensity, character, machine mediation, or source transformation depending on how the piece has calibrated the ear.

This gives composers a practical lever: write the baseline as carefully as the exception.

There are at least four useful baselines:

1. **Source baseline:** what this body normally sounds like.
2. **Gesture baseline:** what this action normally does over time.
3. **Space baseline:** what this room or processing chain normally contributes.
4. **Style baseline:** what this musical situation permits before something feels foreign.

Once those baselines are audible, anomaly becomes controllable. A passage can miscalibrate the listener by presenting one source baseline and then revealing another. It can make a machine sound human, then let one mechanical transient betray it. It can establish a stable vocal F0 contour, then bend the spectral envelope until the body seems to change. It can introduce a noisy artifact early enough that later distortion feels native rather than disruptive.

The studio experiment is direct. Take one sound with a clear source identity, such as a close-mic vocal hum or a small motor. Build three openings:

1. A clean calibration, where the source behavior is stable and legible.
2. A false calibration, where processing suggests the wrong source or room.
3. A withheld calibration, where only partial cues appear.

Then introduce the same "anomalous" event in all three versions: a pitch bend, scrape, dropout, burst of noise, or spatial jump. The hypothesis is that the event will not keep the same meaning. Its musical function will be determined less by its acoustic shape than by the baseline the piece taught the listener to expect.

This is where the extraction cluster becomes compositionally useful. The papers are not merely about better detection. They show that detection is downstream of calibration. For Frequency, that means source identity, corpus cleanliness, temporal memory, and feature fusion are all ways of answering one prior question:

**what normal has the music made available?**

Only after that can the abnormal sing.

---

_Sources: anomalous sound detection without known machine identity (`j9741717c5306g0134yg8tgtb986qgdn`), infant cry feature-fusion and domain shift (`j9735j1x9c8dxr97dax746vccd86q4tz`), SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`), and FSD50K-Solo single-source curation (`j97c8pg9neak74x61xchz55s6s86ryfx`)._
