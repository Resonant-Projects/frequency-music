// ZODIAC camera setup — OrbitControls, initial position, sector focus animation.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { type SectorDef } from './zodiac-data'

let activeFocusAnimId: number | null = null
let originalAutoRotate: boolean | null = null

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, aspect, 1, 3000)
  // Slightly below and in front: shows disc at a cinematic tilt
  camera.position.set(0, -120, 520)
  camera.lookAt(0, 0, 0)
  return camera
}

export function createOrbitControls(camera: THREE.Camera, domElement: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.15
  controls.minDistance = 200
  controls.maxDistance = 1200
  controls.maxPolarAngle = Math.PI * 0.72
  return controls
}

// Lerp camera toward a sector's midpoint for cinematic focus
export function focusSector(
  sector: SectorDef,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): void {
  const mid = (sector.startAngle + sector.endAngle) / 2

  // Target position: 500 units out along sector mid-angle, at Z=250
  const targetPos = new THREE.Vector3(
    Math.cos(mid) * 500,
    -Math.sin(mid) * 500,
    250,
  )

  // Target look-at: sector inner arc midpoint
  const lookAt = new THREE.Vector3(
    Math.cos(mid) * 175,
    -Math.sin(mid) * 175,
    0,
  )

  // Cancel any prior focus animation and disable autoRotate during lerp.
  // Capture autoRotate only when no animation is running (it's already false during one).
  if (activeFocusAnimId === null) originalAutoRotate = controls.autoRotate
  if (activeFocusAnimId !== null) cancelAnimationFrame(activeFocusAnimId)
  controls.autoRotate = false

  // Simple lerp animation over ~800ms
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const duration = 800
  const startTime = performance.now()

  function step() {
    const t = Math.min((performance.now() - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3)  // ease-out cubic

    camera.position.lerpVectors(startPos, targetPos, ease)
    controls.target.lerpVectors(startTarget, lookAt, ease)
    controls.update()

    if (t < 1) {
      activeFocusAnimId = requestAnimationFrame(step)
    } else {
      activeFocusAnimId = null
      if (originalAutoRotate !== null) {
        controls.autoRotate = originalAutoRotate
        originalAutoRotate = null
      }
    }
  }

  activeFocusAnimId = requestAnimationFrame(step)
}
