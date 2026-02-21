// ZODIAC material factory functions — Three.js material definitions.
// All materials follow the Illuminated Astrolabe aesthetic.

import * as THREE from 'three'
import { COLORS } from './zodiac-data'

// Sector fill — semi-transparent ring-arc face
export function makeSectorFillMat(color: string, active = false) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: active ? 0.10 : 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

// Arc boundary lines (inner r=175, outer r=265)
export function makeArcMat(color: string, opacity = 0.38) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity })
}

// Source node spheres — glowing emissive orbs floating above disc
export function makeSourceMat(color: string) {
  return new THREE.MeshStandardMaterial({
    color: COLORS.void,
    emissive: color,
    emissiveIntensity: 0.6,
    metalness: 0.2,
    roughness: 0.8,
  })
}

// Hub center sphere — bright gold with high emissive
export function makeHubMat() {
  return new THREE.MeshStandardMaterial({
    color: COLORS.gold,
    emissive: COLORS.gold,
    emissiveIntensity: 0.9,
    metalness: 0.8,
    roughness: 0.2,
  })
}

// Hub outer ring and disc elements
export function makeHubRingMat(opacity = 0.88) {
  return new THREE.LineBasicMaterial({
    color: COLORS.gold,
    transparent: true,
    opacity,
  })
}

// Hub violet inner ring (dashed)
export function makeHubVioletMat() {
  return new THREE.LineDashedMaterial({
    color: COLORS.violet,
    transparent: true,
    opacity: 0.45,
    dashSize: 3,
    gapSize: 2,
  })
}

// Pipeline rings — dashed concentric circles below disc
export function makePipelineRingMat(color: string) {
  return new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    dashSize: 4,
    gapSize: 3,
  })
}

// Outer boundary rings (thin/main)
export function makeOuterRingMat(opacity: number) {
  return new THREE.LineBasicMaterial({
    color: COLORS.gold,
    transparent: true,
    opacity,
  })
}

// Radial spoke lines at sector boundaries
export function makeSpokeMat(color: string, active = false) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: active ? 0.55 : 0.22,
  })
}

// Tick marks — all gold, varying opacity
export function makeTickMat(major: boolean) {
  return new THREE.LineBasicMaterial({
    color: COLORS.gold,
    transparent: true,
    opacity: major ? 0.45 : 0.18,
  })
}

// Hub-to-domain edge lines
export function makeHubEdgeMat(color: string, active = false) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: active ? 0.65 : 0.18,
  })
}

// Domain-to-source bezier edges
export function makeDomainEdgeMat(color: string, active = false) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: active ? 0.55 : 0.14,
  })
}

// Background scatter point field
export function makeBackgroundDotsMat() {
  return new THREE.PointsMaterial({
    color: COLORS.gold,
    size: 1.2,
    transparent: true,
    opacity: 0.018,
  })
}
