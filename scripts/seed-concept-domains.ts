/** Seed the mission concept-domain registry. Dry-run by default. */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const DOMAIN_ENTRIES = [
  ["microtuning", "Tuning systems beyond standard 12-tone equal temperament."],
  [
    "geometric-music-theory",
    "Geometric representations and constructions applied to musical structure.",
  ],
  [
    "psychoacoustics",
    "Perception of pitch, timbre, consonance, and auditory space.",
  ],
  [
    "wave-physics",
    "Physical behavior of waves, harmonics, resonance, and interference.",
  ],
  [
    "mathematical-music-theory",
    "Mathematical structures underlying harmony, rhythm, tuning, and voice leading.",
  ],
  [
    "sacred-geometry",
    "Traditional geometric symbolism connected to music and acoustics.",
  ],
  [
    "consciousness-sound",
    "Research on sound, attention, consciousness, and altered or contemplative states.",
  ],
  [
    "biofield",
    "Bioelectromagnetic, biophotonic, and biofield models and measurements.",
  ],
  [
    "sound-healing",
    "Therapeutic and wellbeing applications of sound and vibration.",
  ],
  [
    "cymatics",
    "Visible pattern formation produced by sound and mechanical vibration.",
  ],
  [
    "earth-energy",
    "Earth resonance, geomagnetism, ley-line, and planetary-grid research.",
  ],
  [
    "music-production",
    "Composition, synthesis, recording, mixing, and studio practice.",
  ],
  [
    "ml-audio-engineering",
    "Off-mission capture for machine-learning and software engineering applied to audio.",
  ],
  [
    "general-science",
    "Off-mission capture for scientific concepts outside the research program.",
  ],
] as const;

const apply = process.argv.includes("--apply");
const client = getConvexClient();
const devBypassSecret = getDevBypassSecret();
const result = await client.mutation(api.vocabulary.seedMissionConceptDomains, {
  entries: DOMAIN_ENTRIES.map(([name, description]) => ({ name, description })),
  apply,
  devBypassSecret,
});

console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
console.log(
  `created=${result.created} updated=${result.updated} unchanged=${result.unchanged}`,
);
