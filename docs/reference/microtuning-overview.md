# Microtuning / Xenharmonic Music — Quick Reference

*Comprehensive overview of mathematical foundations, tuning systems, tools, and composition approaches*

---

## 📐 Mathematical Foundations

### Core Formula: Cents

```
cents = 1200 × log₂(ratio)
      = log₁₀(ratio) × 3986.3137
```

**Inverse (ratio from cents):**
```
ratio = 2^(cents/1200)
```

**EDO step size:**
```
step_cents = 1200 / n   (for n-EDO)
```

### Key Interval Relationships

| Interval | Just Ratio | Cents | 12-EDO (cents) | Difference |
|----------|------------|-------|----------------|------------|
| Octave | 2/1 | 1200.00 | 1200 | 0 |
| Perfect 5th | 3/2 | 701.96 | 700 | +2¢ |
| Perfect 4th | 4/3 | 498.04 | 500 | -2¢ |
| Major 3rd | 5/4 | 386.31 | 400 | **-14¢** |
| Minor 3rd | 6/5 | 315.64 | 300 | +16¢ |
| Major 6th | 5/3 | 884.36 | 900 | -16¢ |
| Minor 7th | 9/5 | 1017.60 | 1000 | +18¢ |
| Harmonic 7th | 7/4 | 968.83 | 1000 | **-31¢** |
| Neutral 3rd | 11/9 | 347.41 | — | quarter-tone territory |

### Important Commas

| Comma | Ratio | Cents | Description |
|-------|-------|-------|-------------|
| Syntonic | 81/80 | 21.51 | Pythagorean vs just M3 |
| Pythagorean | 531441/524288 | 23.46 | 12 pure 5ths vs 7 octaves |
| Septimal | 64/63 | 27.26 | 7th harmonic adjustment |
| Schisma | 32805/32768 | 1.95 | Very small, ~2 cents |

---

## 🎹 Tuning Systems

### Equal Divisions of the Octave (EDO)

| EDO | Step (¢) | Key Features | Good For |
|-----|----------|--------------|----------|
| **12** | 100 | Standard Western | Universal transposition |
| **17** | 70.6 | Superpyth, exotic | Neutral intervals |
| **19** | 63.2 | Meantone-like | Better M3, distinct enharmonics |
| **22** | 54.5 | Superpyth + 7-limit | Exotic harmony, two whole tones |
| **24** | 50 | Quarter-tones | Arabic maqam, neutral intervals |
| **31** | 38.7 | Extended meantone | Excellent 5-limit + good 7-limit |
| **41** | 29.3 | Very accurate | All limits through 11 |
| **53** | 22.6 | Near-just 5-limit | Pythagorean + just approximation |
| **72** | 16.7 | High precision | All limits, includes 12/24/36 |

### Just Intonation (JI) Systems

| System | Primes Used | Character |
|--------|-------------|-----------|
| **5-limit** | 2, 3, 5 | Classical JI (Renaissance ideal) |
| **7-limit** | 2, 3, 5, 7 | Adds septimal "blues" intervals |
| **11-limit** | 2, 3, 5, 7, 11 | Neutral 3rds, quarter-tone-like |
| **13-limit** | 2, 3, 5, 7, 11, 13 | Extended harmonic series |

### Historical Temperaments

| Temperament | Description | Key Color |
|-------------|-------------|-----------|
| **Pythagorean** | Stacked pure 5ths | Wide M3 (81/64), wolf 5th |
| **1/4-comma Meantone** | Pure M3, narrow 5ths | Sweet 3rds, limited keys |
| **Werckmeister III** | Circulating, varied 5ths | Strong key character |
| **Kirnberger III** | Near-just in C, circulating | Warm near keys |
| **Vallotti** | Evenly distributed | Gentle key color |

---

## 🛠 Tools & Software

### Desktop/Plugin

| Tool | Type | Description |
|------|------|-------------|
| **Scala** | Desktop | Reference software, huge scale archive (4000+ scales) |
| **MTS-ESP Suite** | Plugin | Master tuning for entire DAW session |
| **Entonal Studio** | DAW | Purpose-built for microtonal |
| **Pianoteq** | Plugin | Physical modeling with full microtuning |

### Online

| Tool | URL | Use Case |
|------|-----|----------|
| **Scale Workshop** | scaleworkshop.plainsound.org | Create, play, export scales |
| **Xenharmonic Wiki** | en.xen.wiki | Reference, theory, scales |

### Synths with Microtuning Support

**Full Support (MTS-ESP compatible):**
- Surge XT (free, excellent)
- Vital
- Serum (via pitch tables)
- Pigments
- Zebra 2
- Diva
- Hive 2

**Native Scala Support:**
- Kontakt
- Omnisphere
- Many u-he synths

### File Formats

| Format | Extension | Contents |
|--------|-----------|----------|
| Scala Scale | `.scl` | Intervals only (cents or ratios) |
| Scala Keyboard Map | `.kbm` | Note-to-scale-degree mapping |
| AnaMark TUN | `.tun` | Complete tuning + mapping |
| MTS | SysEx | MIDI Tuning Standard messages |

---

## 🎼 Composition Approaches

### By Technique

| Approach | Description | Composers |
|----------|-------------|-----------|
| **Extended JI** | Higher prime limits for new colors | Johnston, Gann, La Monte Young |
| **EDO Exploration** | Composing in non-12 systems | Blackwood, Sevish, Byrnes |
| **Spectral** | Overtone-based harmony | Grisey, Murail, Haas |
| **Adaptive JI** | Real-time pitch adjustment | Hermode, algorithmic |
| **Polymicrotonality** | Multiple tunings simultaneously | Young, Wyschnegradsky |

### Practical Starting Points

1. **19-EDO**: Familiar but sweeter (better thirds)
2. **Just Intonation major scale**: Pure but limited
3. **24-EDO**: Quarter-tones, easy conceptually
4. **22-EDO**: Exotic but coherent harmony

### Notation Systems

| System | Use Case |
|--------|----------|
| **Ben Johnston** | Extended JI with accidentals |
| **Helmholtz-Ellis** | Comprehensive JI notation |
| **Sagittal** | Universal microtonal symbols |
| **Cents deviation** | Practical for performers |

---

## 👤 Key Figures

### Pioneers
- **Harry Partch** (1901-74) — 43-tone JI, custom instruments
- **Julián Carrillo** (1875-1965) — Fractional tones, custom pianos
- **Alois Hába** (1893-1973) — Quarter/sixth tones, opera
- **Ivan Wyschnegradsky** (1893-1979) — Ultrachromatic, dense temperaments

### Just Intonation
- La Monte Young, Terry Riley, Ben Johnston, Kyle Gann, Lou Harrison, James Tenney, Michael Harrison

### Contemporary
- Georg Friedrich Haas, Sevish, Brendan Byrnes, Jacob Collier
- King Gizzard (Flying Microtonal Banana)
- Aphex Twin (MTS-ESP co-developer)

---

## 📚 Essential Resources

### Books
- **Music: A Mathematical Offering** — Dave Benson (free PDF)
- **A Geometry of Music** — Dmitri Tymoczko
- **Genesis of a Music** — Harry Partch
- **Tuning, Timbre, Spectrum, Scale** — William Sethares

### Online
- **Kyle Gann's Just Intonation Explained** — kylegann.com/tuning.html
- **Xenharmonic Wiki** — en.xen.wiki
- **Sevish's tutorials** — sevish.com

### Communities
- Xenharmonic Alliance (Facebook)
- r/microtonal (Reddit)
- Surge/MTS-ESP Discord channels

---

*Reference v1.0 — Data from microtuning-sources.json*
