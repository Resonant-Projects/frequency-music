// ZODIAC scene initialization — ties all modules together.
// Returns a handle with cleanup, sector selection API, and raycaster for clicks.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  CSS3DObject,
  CSS3DRenderer,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import {
  createCamera,
  createOrbitControls,
  focusSector,
  isAutoRotating as isControlsAutoRotating,
  prefersReducedMotion,
  setAutoRotate as setControlsAutoRotate,
  watchReducedMotion,
} from "./zodiac-camera";
import { COLORS, SECTORS, textSafeSectorColor } from "./zodiac-data";
import {
  buildDomainEdges,
  buildHubEdges,
  setEdgeActivity,
} from "./zodiac-edges";
import {
  buildBackgroundDots,
  buildHub,
  buildOuterRings,
  buildPipelineRings,
  buildSectorGroup,
  buildSourceNodes,
  buildTickMarks,
  getLabelPositions,
  setSectorGroupActive,
} from "./zodiac-geometry";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  ConstellationGroup,
  ConstellationEdge,
} from "./zodiac-constellations";
import {
  buildConstellations,
  updateConstellationTime,
  animateConstellationFadeIn,
} from "./zodiac-constellations";
import type { ArmillaryRingGroup } from "./zodiac-armillary";
import {
  buildArmillaryRings,
  animateArmillarySpring,
  updateArmillaryRotation,
} from "./zodiac-armillary";
import type { OrbitalRing, OrbitalSystem, PullLines } from "./zodiac-orbits";
import {
  buildOrbitalSystem,
  updateOrbits,
  buildPullLines,
} from "./zodiac-orbits";
import { pickAny, configureRaycaster } from "./zodiac-orbit-picking";
import type {
  ConstellationConcept,
  ItemRelation,
  OrbitalExtraction,
  OrbitalHypothesis,
  OrbitalRecipe,
  OrbitalSource,
  ZodiacSubTopic,
} from "./zodiac-types";

export interface ZodiacHandle {
  cleanup: () => void;
  /** Select a sector: lights it and owns its overlay lifecycle. */
  setActiveSector: (id: string | null) => void;
  /** Temporarily light a sector (hover/focus preview); overlays untouched. */
  previewSector: (id: string | null) => void;
  loadConstellations: (
    sectorId: string,
    concepts: ConstellationConcept[],
    edges: ConstellationEdge[],
  ) => void;
  loadArmillaryRings: (sectorId: string, subTopics: ZodiacSubTopic[]) => void;
  loadOrbitalBodies: (
    sources: OrbitalSource[],
    extractions: OrbitalExtraction[],
    hypotheses: OrbitalHypothesis[],
    recipes: OrbitalRecipe[],
  ) => void;
  showPullLines: (itemId: string, relations: ItemRelation[]) => void;
  clearPullLines: () => void;
  setAutoRotate: (enabled: boolean) => void;
  isAutoRotating: () => boolean;
}

// Ambient rotations run at a quarter speed under reduced motion: spatial
// relations stay legible without continuous fast movement.
const REDUCED_MOTION_TIME_SCALE = 0.25;

// A pointer that travels further than this between down and click was a drag
// (an orbit), not a pick.
const DRAG_CLICK_TOLERANCE_PX = 4;

export interface ZodiacSceneOptions {
  /** Class for the hover tooltip; the scene sets only its position. */
  tooltipClass?: string;
}

export function initZodiacScene(
  canvas: HTMLCanvasElement,
  cssContainer: HTMLElement,
  onSectorClick?: (id: string) => void,
  onConceptClick?: (conceptId: Id<"concepts">) => void,
  onOrbitalClick?: (itemId: string, itemType: string, title: string) => void,
  onArmillaryClick?: (label: string, conceptNames: string[]) => void,
  options: ZodiacSceneOptions = {},
): ZodiacHandle {
  // --- Renderer ---------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // The canvas is sized by CSS to fill its container; the renderer only sets
  // the drawing buffer (updateStyle=false) so a later shrink is observable.
  const initialWidth = Math.max(1, cssContainer.clientWidth);
  const initialHeight = Math.max(1, cssContainer.clientHeight);
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // CSS3D renderer for domain labels
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(initialWidth, initialHeight);
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.top = "0";
  cssRenderer.domElement.style.left = "0";
  cssRenderer.domElement.style.pointerEvents = "none";
  cssContainer.appendChild(cssRenderer.domElement);

  // --- Scene ------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.void);
  scene.fog = new THREE.FogExp2(COLORS.void, 0.0008);

  // CSS scene (shares same camera)
  const cssScene = new THREE.Scene();

  // --- Camera & Controls ------------------------------------------------------
  const camera = createCamera(initialWidth / initialHeight);
  const controls = createOrbitControls(camera, canvas);

  // --- Post-processing --------------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(initialWidth, initialHeight),
    1.2, // strength
    0.6, // radius
    0.3, // threshold
  );
  composer.addPass(bloomPass);

  // --- Lighting ---------------------------------------------------------------
  scene.add(new THREE.AmbientLight(COLORS.void, 0.8));

  const rimLight = new THREE.DirectionalLight(COLORS.glowInner, 0.4);
  rimLight.position.set(200, 200, 400);
  scene.add(rimLight);

  const hubLight = new THREE.PointLight(COLORS.gold, 0.8, 400);
  hubLight.position.set(0, 0, 50);
  scene.add(hubLight);

  // Per-domain sector lights
  SECTORS.forEach((sector) => {
    const mid = (sector.startAngle + sector.endAngle) / 2;
    const r = 220;
    const light = new THREE.PointLight(sector.color, 0.4, 280);
    light.position.set(r * Math.cos(mid), -r * Math.sin(mid), 30);
    scene.add(light);
  });

  // --- Build Geometry ---------------------------------------------------------
  // Background dots
  buildBackgroundDots(scene);

  // Outer rings + ticks
  buildOuterRings(scene);
  buildTickMarks(scene);

  // Pipeline rings (below disc)
  buildPipelineRings(scene);

  // Hub
  const hubDot = buildHub(scene);

  // Sector groups: built once; lit/rest is an opacity change on their
  // materials. The fill meshes are cached for click raycasting.
  const sectorGroups = new Map<string, THREE.Group>();
  const sectorFillMeshes: THREE.Mesh[] = [];
  SECTORS.forEach((sector) => {
    const g = buildSectorGroup(sector, false);
    scene.add(g);
    sectorGroups.set(sector.id, g);
    g.traverse((child) => {
      if (child instanceof THREE.Mesh) sectorFillMeshes.push(child);
    });
  });

  // Source nodes
  const sourceNodes = buildSourceNodes(scene);

  // Edges
  const hubEdges = buildHubEdges(scene);
  const domainEdges = buildDomainEdges(scene);

  // --- CSS3D Domain Labels ---------------------------------------------------
  const sectorLabels = new Map<string, HTMLElement>();
  getLabelPositions().forEach(({ sector, x, y, z, rotZ }) => {
    const el = document.createElement("div");
    el.style.fontFamily = "'Cormorant Garamond', Georgia, serif";
    el.style.fontSize = "12px";
    el.style.letterSpacing = "0.2em";
    el.style.color = textSafeSectorColor(sector.color);
    el.style.opacity = "0.85";
    el.style.transition = "opacity 0.25s ease";
    el.style.userSelect = "none";
    el.textContent = sector.label.toUpperCase();
    el.dataset.sectorId = sector.id;
    sectorLabels.set(sector.id, el);

    const obj = new CSS3DObject(el);
    obj.position.set(x, y, z);
    obj.rotation.z = rotZ;
    cssScene.add(obj);
  });

  // --- State ------------------------------------------------------------------
  let activeSectorId: string | null = null;
  let previewSectorId: string | null = null;

  // Phase 1: Constellation layer
  let activeConstellation: ConstellationGroup | null = null;
  let constellationFadeStart: number | null = null;

  // Phase 2: Armillary rings
  let activeArmillary: ArmillaryRingGroup | null = null;
  let armillarySpringStart: number | null = null;

  // Phase 3: Orbital system (rebuilt when live pipeline items change)
  let orbitalSystem: OrbitalSystem | null = null;
  let pullLines: PullLines | null = null;
  // The last pull-line request, replayed after an orbital rebuild.
  let pullLinesRequest: { itemId: string; relations: ItemRelation[] } | null =
    null;

  function clearConstellation() {
    if (activeConstellation) {
      scene.remove(activeConstellation.group);
      activeConstellation.dispose();
      activeConstellation = null;
      constellationFadeStart = null;
    }
  }

  function clearArmillary() {
    if (activeArmillary) {
      scene.remove(activeArmillary.group);
      activeArmillary.dispose();
      activeArmillary = null;
      armillarySpringStart = null;
    }
  }

  function disposePullLines() {
    if (pullLines) {
      scene.remove(pullLines.group);
      pullLines.group.traverse((child) => {
        if ("geometry" in child && child.geometry) {
          (child.geometry as THREE.BufferGeometry).dispose();
        }
        if ("material" in child && child.material) {
          (child.material as THREE.Material).dispose();
        }
      });
      pullLines = null;
    }
  }

  function clearPullLines() {
    disposePullLines();
    pullLinesRequest = null;
  }

  function findOrbitalBody(
    itemId: string,
  ): { ring: OrbitalRing; index: number } | null {
    if (!orbitalSystem) return null;
    for (const ring of orbitalSystem.rings) {
      const index = ring.items.findIndex((item) => item.id === itemId);
      if (index !== -1) return { ring, index };
    }
    return null;
  }

  function showPullLines(itemId: string, relations: ItemRelation[]) {
    disposePullLines();
    pullLinesRequest = { itemId, relations };
    const body = findOrbitalBody(itemId);
    if (!orbitalSystem || !body) return;
    pullLines = buildPullLines(
      body.ring,
      body.index,
      relations,
      orbitalSystem.rings,
    );
    scene.add(pullLines.group);
    // Mark the body the sidebar selected, the same as clicking it.
    attachSelectionHalo(itemId);
  }

  // Lit = selected or previewed. Only opacities change; nothing is rebuilt.
  function refreshSectorVisuals() {
    const lit = new Set<string>();
    if (activeSectorId) lit.add(activeSectorId);
    if (previewSectorId) lit.add(previewSectorId);
    sectorGroups.forEach((group, id) => {
      setSectorGroupActive(group, lit.has(id));
    });
    sectorLabels.forEach((el, id) => {
      el.style.opacity = lit.has(id) ? "1" : "0.85";
    });
    setEdgeActivity(hubEdges, domainEdges, lit);
  }

  function previewSector(id: string | null) {
    if (previewSectorId === id) return;
    previewSectorId = id;
    refreshSectorVisuals();
  }

  function setActiveSector(id: string | null) {
    if (activeSectorId && activeSectorId !== id) {
      // Selection moved: the previous sector's overlays no longer apply.
      clearConstellation();
      clearArmillary();
      clearPullLines();
      clearSelectionHalo();
    }
    activeSectorId = id;
    refreshSectorVisuals();
  }

  // --- Raycaster for sector click -------------------------------------------
  const raycaster = new THREE.Raycaster();
  configureRaycaster(raycaster);
  const mouse = new THREE.Vector2();

  let pointerDownAt: { x: number; y: number } | null = null;

  function onCanvasPointerDown(e: PointerEvent) {
    pointerDownAt = { x: e.clientX, y: e.clientY };
  }

  function onCanvasClick(e: MouseEvent) {
    const downAt = pointerDownAt;
    pointerDownAt = null;
    if (
      downAt &&
      Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) >
        DRAG_CLICK_TOLERANCE_PX
    ) {
      return; // the end of an orbit drag, not a pick
    }

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Phase 1-3: Try picking concepts, armillary rings, orbital items first
    const pick = pickAny(
      raycaster,
      activeConstellation,
      activeArmillary,
      orbitalSystem,
    );
    if (pick) {
      if (pick.type === "orbital-item") {
        attachSelectionHalo(pick.id);
      } else {
        showSelectionHalo(pick.position);
      }
      if (pick.type === "concept" && onConceptClick) {
        onConceptClick(pick.id as Id<"concepts">);
        return;
      }
      if (pick.type === "orbital-item" && onOrbitalClick) {
        // Infer type from ring label
        const typeMap: Record<string, string> = {
          Sources: "source",
          Extractions: "extraction",
          Hypotheses: "hypothesis",
          Recipes: "recipe",
        };
        onOrbitalClick(
          pick.id,
          typeMap[pick.ringLabel ?? ""] ?? "source",
          pick.label,
        );
        return;
      }
      if (pick.type === "armillary-ring" && onArmillaryClick) {
        const ring = activeArmillary?.rings[pick.ringIndex ?? 0];
        if (ring) {
          onArmillaryClick(ring.label, ring.conceptNames);
        }
        return;
      }
    }

    // Fall through to sector picks
    const hits = raycaster.intersectObjects(sectorFillMeshes);
    if (hits.length > 0) {
      const sectorId = hits[0].object.userData.sectorId as string | undefined;
      if (sectorId) {
        setActiveSector(sectorId);
        if (onSectorClick) onSectorClick(sectorId);
        const sector = SECTORS.find((s) => s.id === sectorId);
        if (sector) focusSector(sector, camera, controls);
      }
    }
  }

  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("click", onCanvasClick);

  // --- Hover tooltip -----------------------------------------------------------
  // Colour, type and border come from the caller's design-system class; the
  // scene only positions the element and toggles its visibility.
  const tooltipEl = document.createElement("div");
  if (options.tooltipClass) tooltipEl.className = options.tooltipClass;
  tooltipEl.style.position = "absolute";
  tooltipEl.style.pointerEvents = "none";
  tooltipEl.style.display = "none";
  cssContainer.appendChild(tooltipEl);

  // Selection halo. When it marks an orbiting body it follows that body.
  let selectionHalo: THREE.Mesh | null = null;
  let haloItemId: string | null = null;
  let haloBody: { ring: OrbitalRing; index: number } | null = null;
  const haloMatrix = new THREE.Matrix4();

  function clearSelectionHalo() {
    haloItemId = null;
    haloBody = null;
    if (selectionHalo) {
      scene.remove(selectionHalo);
      selectionHalo.geometry.dispose();
      (selectionHalo.material as THREE.Material).dispose();
      selectionHalo = null;
    }
  }

  function syncHaloToBody() {
    if (!selectionHalo || !haloBody) return;
    haloBody.ring.mesh.getMatrixAt(haloBody.index, haloMatrix);
    selectionHalo.position.setFromMatrixPosition(haloMatrix);
  }

  function attachSelectionHalo(itemId: string) {
    const body = findOrbitalBody(itemId);
    if (!body) return;
    showSelectionHalo(new THREE.Vector3());
    haloItemId = itemId;
    haloBody = body;
    syncHaloToBody();
  }

  function showSelectionHalo(position: THREE.Vector3) {
    clearSelectionHalo();
    const haloGeo = new THREE.RingGeometry(4, 6, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: COLORS.gold,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    selectionHalo = new THREE.Mesh(haloGeo, haloMat);
    selectionHalo.position.copy(position);
    selectionHalo.lookAt(camera.position);
    scene.add(selectionHalo);
  }

  function hideTooltip() {
    tooltipEl.style.display = "none";
    canvas.style.cursor = "grab";
  }

  let lastHoverTime = 0;
  function onCanvasPointerMove(e: PointerEvent) {
    const now = performance.now();
    if (now - lastHoverTime < 33) return; // throttle ~30fps
    lastHoverTime = now;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const pick = pickAny(
      raycaster,
      activeConstellation,
      activeArmillary,
      orbitalSystem,
    );
    if (pick) {
      tooltipEl.textContent = pick.label;
      tooltipEl.style.display = "block";
      tooltipEl.style.left = `${e.clientX - rect.left + 12}px`;
      tooltipEl.style.top = `${e.clientY - rect.top - 20}px`;
      canvas.style.cursor = "pointer";
    } else {
      hideTooltip();
    }
  }

  canvas.addEventListener("pointermove", onCanvasPointerMove);
  canvas.addEventListener("pointerleave", hideTooltip);

  // --- Resize handler --------------------------------------------------------
  // Sized from the container: the canvas fills it via CSS. A collapsed
  // container (0px) is skipped rather than producing a NaN aspect.
  function onResize() {
    const w = cssContainer.clientWidth;
    const h = cssContainer.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    cssRenderer.setSize(w, h);
    // Also resizes every pass, including the bloom pass's resolution.
    composer.setSize(w, h);
  }

  window.addEventListener("resize", onResize);
  // The layout can resize the canvas without a window resize (breakpoints,
  // sidebar content), so observe the container itself.
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => onResize());
  resizeObserver?.observe(cssContainer);

  // --- Motion preference -----------------------------------------------------
  let reducedMotion = prefersReducedMotion();
  // The user's explicit pause/resume choice, once they have made one. A later
  // change to the OS preference may still stop the rotation, but it must never
  // start it on the user's behalf (WCAG 2.2.2).
  let autoRotateChoice: boolean | null = null;

  const stopReducedMotionWatch = watchReducedMotion((reduced) => {
    reducedMotion = reduced;
    setControlsAutoRotate(
      controls,
      reduced ? false : (autoRotateChoice ?? true),
    );
    if (reduced) {
      // Settle anything mid-pulse at a fixed, readable value.
      sourceNodes.forEach(({ mesh }) => {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
      });
      if (selectionHalo) {
        (selectionHalo.material as THREE.MeshBasicMaterial).opacity = 0.7;
      }
    }
  });

  // --- Animation loop --------------------------------------------------------
  let animId = 0;
  let running = false;
  let documentVisible =
    typeof document === "undefined" ? true : !document.hidden;
  let canvasOnScreen = true;

  // Ambient motion reads an accumulated clock rather than the raw one. Orbits
  // and armillary rings derive their phase from its absolute value, so scaling
  // the raw clock teleports every body the moment the scale changes; scaling
  // the per-frame delta bends the rate and leaves the phase continuous.
  let ambientT = 0;
  let lastFrameT: number | null = null;

  function animate(time = 0) {
    if (!running) return;
    animId = requestAnimationFrame(animate);
    controls.update();

    // State-explaining transitions below keep the real clock.
    const t = time * 0.001;
    const frameDelta = lastFrameT === null ? 0 : Math.max(0, t - lastFrameT);
    lastFrameT = t;
    ambientT += frameDelta * (reducedMotion ? REDUCED_MOTION_TIME_SCALE : 1);

    // Pulse source node emissive intensity (skipped under reduced motion)
    if (!reducedMotion) {
      sourceNodes.forEach(({ mesh }, i) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity =
          0.4 + Math.sin(t * (0.5 + i * 0.05) + i * 0.7) * 0.25;
      });
    }

    // Slow hub rotation (the hub dot)
    hubDot.rotation.y += reducedMotion
      ? 0.002 * REDUCED_MOTION_TIME_SCALE
      : 0.002;

    // Phase 1: Constellation twinkle + fade-in
    if (activeConstellation) {
      // Twinkle is decorative; the fade-in explains that a sector loaded.
      if (!reducedMotion) {
        updateConstellationTime(activeConstellation, t);
      }
      if (constellationFadeStart !== null) {
        const fadeProgress = (time - constellationFadeStart) / 600;
        animateConstellationFadeIn(activeConstellation, fadeProgress);
        if (fadeProgress >= 1) constellationFadeStart = null;
      }
    }

    // Phase 2: Armillary ring rotation + spring
    if (activeArmillary) {
      updateArmillaryRotation(activeArmillary, ambientT);
      if (armillarySpringStart !== null) {
        const elapsed = time - armillarySpringStart;
        const done = animateArmillarySpring(activeArmillary, elapsed);
        if (done) armillarySpringStart = null;
      }
    }

    // Phase 3: Orbital body animation
    if (orbitalSystem) {
      updateOrbits(orbitalSystem, ambientT);
      // Lines and the halo track the bodies they mark.
      pullLines?.update();
      syncHaloToBody();
    }

    // Selection halo pulse (held at a fixed opacity under reduced motion)
    if (selectionHalo) {
      const material = selectionHalo.material as THREE.MeshBasicMaterial;
      material.opacity = reducedMotion ? 0.7 : 0.5 + 0.3 * Math.sin(t * 3);
      selectionHalo.lookAt(camera.position);
    }

    composer.render();
    cssRenderer.render(cssScene, camera);
  }

  // Only render while the canvas is on screen and the tab is visible.
  function syncLoop() {
    const shouldRun = documentVisible && canvasOnScreen;
    if (shouldRun && !running) {
      running = true;
      // No ambient delta across the gap the loop was parked for.
      lastFrameT = null;
      animId = requestAnimationFrame(animate);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(animId);
    }
  }

  const visibilityObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            canvasOnScreen = entry.isIntersecting;
            syncLoop();
          },
          { threshold: 0 },
        );
  visibilityObserver?.observe(canvas);

  function onVisibilityChange() {
    documentVisible = !document.hidden;
    syncLoop();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  syncLoop();

  // --- Cleanup ----------------------------------------------------------------
  return {
    cleanup() {
      running = false;
      cancelAnimationFrame(animId);
      stopReducedMotionWatch();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("pointermove", onCanvasPointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
      tooltipEl.remove();
      clearSelectionHalo();
      clearConstellation();
      clearArmillary();
      clearPullLines();
      orbitalSystem?.dispose();
      controls.dispose();
      scene.traverse((object) => {
        if ("geometry" in object && object.geometry) {
          (object.geometry as THREE.BufferGeometry).dispose();
        }
        if ("material" in object && object.material) {
          const mat = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat))
            mat.forEach((m) => {
              m.dispose();
            });
          else mat.dispose();
        }
      });
      composer.dispose();
      renderer.dispose();
      if (cssRenderer.domElement.parentElement) {
        cssRenderer.domElement.parentElement.removeChild(
          cssRenderer.domElement,
        );
      }
    },
    setActiveSector,
    previewSector,

    // Phase 1: Load constellation for active sector
    loadConstellations(
      sectorId: string,
      concepts: ConstellationConcept[],
      edges: ConstellationEdge[],
    ) {
      clearConstellation();
      const sector = SECTORS.find((s) => s.id === sectorId);
      if (!sector) return;

      activeConstellation = buildConstellations(sector, concepts, edges);
      scene.add(activeConstellation.group);
      constellationFadeStart = performance.now();
    },

    // Phase 2: Load armillary rings for active sector
    loadArmillaryRings(sectorId: string, subTopics: ZodiacSubTopic[]) {
      clearArmillary();
      const sector = SECTORS.find((s) => s.id === sectorId);
      if (!sector || subTopics.length === 0) return;

      activeArmillary = buildArmillaryRings(sector, subTopics);
      scene.add(activeArmillary.group);
      armillarySpringStart = performance.now();
    },

    // Phase 3: Load orbital bodies (rebuilt whenever live pipeline items change)
    loadOrbitalBodies(
      sources: OrbitalSource[],
      extractions: OrbitalExtraction[],
      hypotheses: OrbitalHypothesis[],
      recipes: OrbitalRecipe[],
    ) {
      // Lines and the halo index into the old rings; drop them before the
      // rings go, then replay them against the new system.
      const replayPullLines = pullLinesRequest;
      const replayHaloItemId = haloItemId;
      disposePullLines();
      if (replayHaloItemId) clearSelectionHalo();

      if (orbitalSystem) {
        scene.remove(orbitalSystem.group);
        orbitalSystem.dispose();
      }

      orbitalSystem = buildOrbitalSystem(
        sources,
        extractions,
        hypotheses,
        recipes,
      );
      scene.add(orbitalSystem.group);

      if (replayPullLines) {
        showPullLines(replayPullLines.itemId, replayPullLines.relations);
      }
      if (replayHaloItemId) attachSelectionHalo(replayHaloItemId);
    },

    // Phase 3: Show pull-lines from a selected item to related items
    showPullLines,

    clearPullLines,

    // WCAG 2.2.2 — user control over the auto-rotating orrery
    setAutoRotate(enabled: boolean) {
      autoRotateChoice = enabled;
      setControlsAutoRotate(controls, enabled);
    },

    isAutoRotating() {
      return isControlsAutoRotating(controls);
    },
  };
}
