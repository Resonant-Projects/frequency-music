// Research scope shared by gap targeting, discovery, extraction, and classification.
// The registry remains authoritative for assignable domain names.
export const RESEARCH_AREAS = [
  {
    sector: "math",
    label: "Mathematics",
    domains: ["mathematics"],
    mechanisms: [
      "Fourier analysis",
      "logarithmic pitch and ratios",
      "cyclic rhythms",
      "symmetry and groups",
      "dynamical systems and entrainment",
      "information and entropy models",
    ],
    outcomes: [
      "spectral resolution",
      "tuning error",
      "rhythmic distribution",
      "synchronization",
    ],
    foundationQuery:
      "mathematics music Fourier pitch ratios Euclidean rhythm textbook",
  },
  {
    sector: "wave",
    label: "Wave Physics",
    domains: ["acoustics"],
    mechanisms: [
      "normal modes and boundary conditions",
      "resonance and damping",
      "beating and dispersion",
      "coupled resonators",
      "room acoustics",
      "nonlinear vibration",
    ],
    outcomes: [
      "mode frequencies",
      "decay time",
      "radiated spectrum",
      "spatial sound field",
    ],
    foundationQuery:
      "musical acoustics normal modes resonance damping university textbook",
  },
  {
    sector: "music",
    label: "Music Theory",
    domains: ["tuning", "theory"],
    mechanisms: [
      "just intonation and temperament",
      "voice leading",
      "rhythm and meter",
      "scale and tuning traditions",
      "form and expectation",
      "performance practice",
    ],
    outcomes: [
      "voice-leading distance",
      "intonation",
      "rhythmic structure",
      "musical expectation",
    ],
    foundationQuery:
      "music theory tuning temperament voice leading rhythm open textbook",
  },
  {
    sector: "psycho",
    label: "Psychoacoustics",
    domains: ["psychoacoustics"],
    mechanisms: [
      "roughness and critical bands",
      "harmonicity and pitch",
      "masking and auditory grouping",
      "spatial hearing",
      "memory and cultural familiarity",
      "sensorimotor synchronization",
    ],
    outcomes: [
      "pleasantness",
      "stability and finishedness",
      "pitch discrimination",
      "auditory grouping",
      "synchronization accuracy",
    ],
    foundationQuery:
      "auditory roughness harmonicity consonance perception controlled experiment cultural familiarity",
  },
  {
    sector: "geometry",
    label: "Geometry",
    domains: ["geometry"],
    mechanisms: [
      "Chladni nodal patterns",
      "tuning lattices and Tonnetz",
      "voice-leading spaces",
      "symmetry and topology",
      "resonator shape",
    ],
    outcomes: [
      "mode topology",
      "spatial distance between chords",
      "tuning relations",
      "resonator spectrum",
    ],
    foundationQuery:
      "musical geometry Chladni tuning lattice voice leading mathematical model",
  },
  {
    sector: "synthesis",
    label: "Synthesis",
    domains: ["production", "instrument"],
    mechanisms: [
      "additive and physical modeling synthesis",
      "digital waveguides",
      "spectral envelopes and transients",
      "modulation and filtering",
      "spatial rendering",
      "reproducible instrument implementations",
    ],
    outcomes: [
      "spectrum",
      "envelope and decay",
      "timbre",
      "rendered spatial cues",
    ],
    foundationQuery:
      "audio synthesis physical modeling additive digital waveguide author documentation",
  },
] as const;

export const BOOTSTRAP_RESEARCH_DOMAINS: readonly string[] =
  RESEARCH_AREAS.flatMap((area) => [...area.domains]);

export const RESEARCH_SOURCE_GUIDANCE = `Include foundational university textbook chapters, formal mathematical results, empirical studies, negative or contradictory results, reproducible DSP methods, specialist tuning and performance practice, and author or instrument documentation when they explain a concrete musical mechanism. A paper need not mention music in its title if its acoustic, perceptual, or mathematical mechanism has a specific musical application. Incidental ML, speech benchmarks, unrelated software, and generic science remain off-mission.
Separate physical mechanisms, measured listener responses, formal models, practitioner observations, opinion, and speculative inspiration. Musical stability or finishedness, pleasantness, roughness, harmonicity, familiarity, and therapeutic outcomes are different constructs. Preserve measured outcomes, participant background, stimuli, register, timbre, level, and study limitations. Do not infer therapeutic effects from preference or infer physical causation from a visual resemblance. A preprint or opinion is not an independent peer-reviewed experiment; an abstract does not supply unreported methods. Textbook chapters from one work are not independent corroboration.`;
