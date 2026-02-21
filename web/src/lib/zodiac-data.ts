// ZODIAC data layer — types, constants, sector/pipeline definitions.
// Mirrors design3.tsx SECTORS but serves both 2D and 3D implementations.

export const COLORS = {
  void: '#0d0620',
  gold: '#c8a84b',
  violet: '#8b5cf6',
  cream: '#f5f0e8',
  glowInner: '#1a0f35',
} as const

export const TAU = 2 * Math.PI
export const BASE = -Math.PI / 2
export const STEP = TAU / 6

// Ring radii shared by both 2D (SVG units) and 3D (world units, 1:1 scale)
export const R = {
  hubDot: 6,
  hubViolet: 22,
  hubOuter: 36,
  hubLabel: 50,
  recipe: 58,
  hypothesis: 92,
  extract: 128,
  sources: 160,
  sectorInner: 175,
  arcLabel: 220,
  sourceCount: 246,
  sectorOuter: 265,
  outerThin: 268,
  outerMain: 280,
  dotZoneMin: 282,
  dotZoneMax: 315,
} as const

export interface SectorDef {
  id: string
  label: string
  color: string
  startAngle: number
  endAngle: number
  sources: number
  claims: number
  summary: string
  dots: Array<{ angleRel: number; r: number }>
}

export interface PipelineRing {
  label: string
  r: number
  color: string
  z: number  // Z offset below disc plane in 3D
}

export const SECTORS: SectorDef[] = [
  {
    id: 'math', label: 'Mathematics', color: '#8b5cf6',
    startAngle: BASE, endAngle: BASE + STEP,
    sources: 12, claims: 45,
    summary: 'Group theory, Tonnetz geometry, Fourier analysis, and tuning lattice mathematics',
    dots: [{ angleRel: 0.22, r: 290 }, { angleRel: 0.52, r: 308 }, { angleRel: 0.78, r: 282 }],
  },
  {
    id: 'phys', label: 'Wave Physics', color: '#c8a84b',
    startAngle: BASE + STEP, endAngle: BASE + 2 * STEP,
    sources: 15, claims: 67,
    summary: 'Standing waves, harmonic series, resonance modes, cymatics, acoustic field coupling',
    dots: [
      { angleRel: 0.18, r: 295 }, { angleRel: 0.42, r: 313 },
      { angleRel: 0.65, r: 287 }, { angleRel: 0.85, r: 305 },
    ],
  },
  {
    id: 'music', label: 'Music Theory', color: '#f5f0e8',
    startAngle: BASE + 2 * STEP, endAngle: BASE + 3 * STEP,
    sources: 11, claims: 38,
    summary: 'Just intonation, microtuning, EDO systems, xenharmonic voice-leading geometry',
    dots: [{ angleRel: 0.28, r: 298 }, { angleRel: 0.55, r: 282 }, { angleRel: 0.78, r: 312 }],
  },
  {
    id: 'psycho', label: 'Psychoacoustics', color: '#8b5cf6',
    startAngle: BASE + 3 * STEP, endAngle: BASE + 4 * STEP,
    sources: 9, claims: 29,
    summary: 'Consonance perception, auditory masking, critical bands, tonal memory encoding',
    dots: [{ angleRel: 0.3, r: 293 }, { angleRel: 0.7, r: 308 }],
  },
  {
    id: 'geo', label: 'Geometry', color: '#c8a84b',
    startAngle: BASE + 4 * STEP, endAngle: BASE + 5 * STEP,
    sources: 8, claims: 24,
    summary: "Polygon-angle correspondence, sacred geometry, Grant's cipher, Platonic solids",
    dots: [{ angleRel: 0.25, r: 303 }, { angleRel: 0.58, r: 288 }, { angleRel: 0.82, r: 315 }],
  },
  {
    id: 'synth', label: 'Synthesis', color: '#f5f0e8',
    startAngle: BASE + 5 * STEP, endAngle: BASE + TAU + BASE,
    sources: 6, claims: 18,
    summary: 'Spectral composition, additive and FM synthesis, granular textures, microtonal DAW',
    dots: [{ angleRel: 0.35, r: 298 }, { angleRel: 0.68, r: 283 }],
  },
]

export const PIPELINE_RINGS: PipelineRing[] = [
  { label: 'RECIPE',     r: 58,  color: '#c8a84b', z: -10 },
  { label: 'HYPOTHESIS', r: 92,  color: '#8b5cf6', z: -20 },
  { label: 'EXTRACT',    r: 128, color: '#c8a84b', z: -30 },
  { label: 'SOURCES',    r: 160, color: '#8b5cf6', z: -40 },
]

// Compute the 3D world position of a dot for a given sector
export function dotWorldPos(sector: SectorDef, dot: { angleRel: number; r: number }, z = 0) {
  const angle = sector.startAngle + dot.angleRel * (sector.endAngle - sector.startAngle)
  return {
    x: dot.r * Math.cos(angle),
    y: -dot.r * Math.sin(angle),  // Y flipped: SVG Y↓ → Three.js Y↑
    z,
  }
}

// Compute the midpoint position on an arc (for edge targets, label placement, etc.)
export function arcMidpoint(r: number, startAngle: number, endAngle: number, z = 0) {
  const mid = (startAngle + endAngle) / 2
  return {
    x: r * Math.cos(mid),
    y: -r * Math.sin(mid),
    z,
  }
}
