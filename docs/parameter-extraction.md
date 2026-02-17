# Concrete Parameter Extraction Contract (Your Specific List)

## Types (authoritative enum)
- `tempo`
- `key`
- `tuningSystem`
- `rootNote`
- `chordProgression`
- `rhythm`
- `instrument`
- `synthWaveform`
- `harmonicProfile`
- `note`
- `frequency`

## details shapes (examples)

### tempo
- value: "120 BPM"
- details: { bpm: 120 }

### key
- value: "D minor"
- details: { tonic: "D", mode: "minor" }

### tuningSystem
- value: "Just Intonation (5-limit)"
- details: { family: "just", limit: 5, reference: "A4=432" }

### rootNote
- value: "A4=432 Hz"
- details: { note: "A4", hz: 432 }

### chordProgression
- value: "i–VI–III–VII"
- details: {
    numerals: ["i","VI","III","VII"],
    intervals: ["m3","M3","m3"],  // if inferred
    pitchClassSet?: []
  }

### rhythm
- value: "Tresillo"
- details: { pattern: "3-3-2", meter: "4/4" }
OR standard notation:
- details: { notation: ["1/8","1/8","1/4", "..."], meter: "7/8" }

### instrument
- value: "Frame drum"
- details: { family: "percussion", culture?: "Middle Eastern" }

### synthWaveform
- value: "Sine"
- details: { waveform: "sine" }

### harmonicProfile
- value: "Odd harmonics emphasized, gentle rolloff"
- details: { harmonics: "odd", rolloffDbPerOct?: 6 }

### note
- value: "C#5"
- details: { note: "C#5" }

### frequency
- value: "7.83 Hz"
- details: { hz: 7.83, context: "binaural beat target" }

## Human override rule
If AI is unsure, it still emits a candidate param but sets:
- extraction.confidence low
- and adds openQuestions like:
  - "Confirm whether tuning reference is A4=432 or A4=440"
