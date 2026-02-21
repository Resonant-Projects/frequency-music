// ZODIAC scene initialization — ties all modules together.
// Returns a handle with cleanup, sector selection API, and raycaster for clicks.

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'

import { SECTORS, COLORS } from './zodiac-data'
import { createCamera, createOrbitControls, focusSector } from './zodiac-camera'
import {
  buildSectorGroup, buildSourceNodes, buildHub,
  buildPipelineRings, buildOuterRings, buildTickMarks,
  buildBackgroundDots, getLabelPositions,
} from './zodiac-geometry'
import { buildHubEdges, buildDomainEdges, setEdgeActivity } from './zodiac-edges'

export interface ZodiacHandle {
  cleanup: () => void
  setActiveSector: (id: string | null) => void
  onSectorClick: ((id: string) => void) | null
}

export function initZodiacScene(
  canvas: HTMLCanvasElement,
  cssContainer: HTMLElement,
  onSectorClick?: (id: string) => void,
): ZodiacHandle {
  // --- Renderer ---------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  // CSS3D renderer for domain labels
  const cssRenderer = new CSS3DRenderer()
  cssRenderer.setSize(canvas.clientWidth, canvas.clientHeight)
  cssRenderer.domElement.style.position = 'absolute'
  cssRenderer.domElement.style.top = '0'
  cssRenderer.domElement.style.left = '0'
  cssRenderer.domElement.style.pointerEvents = 'none'
  cssContainer.appendChild(cssRenderer.domElement)

  // --- Scene ------------------------------------------------------------------
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.void)
  scene.fog = new THREE.FogExp2(COLORS.void, 0.0008)

  // CSS scene (shares same camera)
  const cssScene = new THREE.Scene()

  // --- Camera & Controls ------------------------------------------------------
  const camera = createCamera(canvas.clientWidth / canvas.clientHeight)
  const controls = createOrbitControls(camera, canvas)

  // --- Post-processing --------------------------------------------------------
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    1.2,  // strength
    0.6,  // radius
    0.3,  // threshold
  )
  composer.addPass(bloomPass)

  // --- Lighting ---------------------------------------------------------------
  scene.add(new THREE.AmbientLight(COLORS.void, 0.8))

  const rimLight = new THREE.DirectionalLight(COLORS.glowInner, 0.4)
  rimLight.position.set(200, 200, 400)
  scene.add(rimLight)

  const hubLight = new THREE.PointLight(COLORS.gold, 0.8, 400)
  hubLight.position.set(0, 0, 50)
  scene.add(hubLight)

  // Per-domain sector lights
  SECTORS.forEach((sector) => {
    const mid = (sector.startAngle + sector.endAngle) / 2
    const r = 220
    const light = new THREE.PointLight(sector.color, 0.4, 280)
    light.position.set(r * Math.cos(mid), -r * Math.sin(mid), 30)
    scene.add(light)
  })

  // --- Build Geometry ---------------------------------------------------------
  // Background dots
  buildBackgroundDots(scene)

  // Outer rings + ticks
  buildOuterRings(scene)
  buildTickMarks(scene)

  // Pipeline rings (below disc)
  buildPipelineRings(scene)

  // Hub
  const hubDot = buildHub(scene)

  // Sector groups (mutable: rebuilt on activation change)
  const sectorGroups = new Map<string, THREE.Group>()
  SECTORS.forEach((sector) => {
    const g = buildSectorGroup(sector, false)
    scene.add(g)
    sectorGroups.set(sector.id, g)
  })

  // Source nodes
  const sourceNodes = buildSourceNodes(scene)

  // Edges
  const hubEdges = buildHubEdges(scene)
  const domainEdges = buildDomainEdges(scene)

  // --- CSS3D Domain Labels ---------------------------------------------------
  getLabelPositions().forEach(({ sector, x, y, z, rotZ }) => {
    const el = document.createElement('div')
    el.style.fontFamily = "'Cormorant Garamond', Georgia, serif"
    el.style.fontSize = '10.5px'
    el.style.letterSpacing = '0.2em'
    el.style.color = sector.color
    el.style.opacity = '0.58'
    el.style.transition = 'opacity 0.25s ease'
    el.style.userSelect = 'none'
    el.textContent = sector.label.toUpperCase()
    el.dataset.sectorId = sector.id

    const obj = new CSS3DObject(el)
    obj.position.set(x, y, z)
    obj.rotation.z = rotZ
    cssScene.add(obj)
  })

  // --- State ------------------------------------------------------------------
  let activeSectorId: string | null = null

  function rebuildSectorGroup(sector: (typeof SECTORS)[0], active: boolean) {
    const old = sectorGroups.get(sector.id)
    if (old) {
      old.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose()
          const mat = child.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else (mat as THREE.Material).dispose()
        }
      })
      scene.remove(old)
    }
    const g = buildSectorGroup(sector, active)
    scene.add(g)
    sectorGroups.set(sector.id, g)
  }

  function setActiveSector(id: string | null) {
    // Update previous active sector
    if (activeSectorId && activeSectorId !== id) {
      const prev = SECTORS.find((s) => s.id === activeSectorId)
      if (prev) rebuildSectorGroup(prev, false)

      // Update CSS label opacity (scoped to this scene's CSS3D layer)
      cssRenderer.domElement.querySelectorAll<HTMLElement>('[data-sector-id]').forEach((el) => {
        if (el.dataset.sectorId === activeSectorId) el.style.opacity = '0.58'
      })
    }

    activeSectorId = id

    if (id) {
      const sector = SECTORS.find((s) => s.id === id)
      if (sector) {
        rebuildSectorGroup(sector, true)
        // Update CSS label
        cssRenderer.domElement.querySelectorAll<HTMLElement>('[data-sector-id]').forEach((el) => {
          if (el.dataset.sectorId === id) el.style.opacity = '1'
        })
      }
    }

    setEdgeActivity(hubEdges, domainEdges, id)
  }

  // --- Raycaster for sector click -------------------------------------------
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  function onCanvasClick(e: MouseEvent) {
    if (!onSectorClick) return
    const rect = canvas.getBoundingClientRect()
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const meshes: THREE.Mesh[] = []
    sectorGroups.forEach((g) => {
      g.traverse((child) => { if (child instanceof THREE.Mesh) meshes.push(child) })
    })

    const hits = raycaster.intersectObjects(meshes)
    if (hits.length > 0) {
      const sectorId = hits[0].object.userData.sectorId as string | undefined
      if (sectorId) {
        setActiveSector(sectorId)
        onSectorClick(sectorId)
        const sector = SECTORS.find((s) => s.id === sectorId)
        if (sector) focusSector(sector, camera, controls)
      }
    }
  }

  canvas.addEventListener('click', onCanvasClick)

  // --- Resize handler --------------------------------------------------------
  function onResize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    cssRenderer.setSize(w, h)
    composer.setSize(w, h)
    bloomPass.resolution.set(w, h)
  }

  window.addEventListener('resize', onResize)

  // --- Animation loop --------------------------------------------------------
  let animId = 0
  let running = true

  function animate() {
    if (!running) return
    animId = requestAnimationFrame(animate)
    controls.update()

    const t = Date.now() * 0.001

    // Pulse source node emissive intensity
    sourceNodes.forEach(({ mesh }, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(t * (0.5 + i * 0.05) + i * 0.7) * 0.25
    })

    // Slow hub rotation (the hub dot)
    hubDot.rotation.y += 0.002

    composer.render()
    cssRenderer.render(cssScene, camera)
  }

  animate()

  // --- Cleanup ----------------------------------------------------------------
  return {
    cleanup() {
      running = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('click', onCanvasClick)
      controls.dispose()
      scene.traverse((object) => {
        if ('geometry' in object && object.geometry) {
          (object.geometry as THREE.BufferGeometry).dispose()
        }
        if ('material' in object && object.material) {
          const mat = object.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      composer.dispose()
      renderer.dispose()
      if (cssRenderer.domElement.parentElement) {
        cssRenderer.domElement.parentElement.removeChild(cssRenderer.domElement)
      }
    },
    setActiveSector,
    onSectorClick: onSectorClick ?? null,
  }
}
