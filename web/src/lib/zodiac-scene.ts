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
import { COLORS, SECTORS } from "./zodiac-data";
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
import type { OrbitalSystem } from "./zodiac-orbits";
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
  setActiveSector: (id: string | null) => void;
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

export function initZodiacScene(
  canvas: HTMLCanvasElement,
  cssContainer: HTMLElement,
  onSectorClick?: (id: string) => void,
  onConceptClick?: (conceptId: Id<"concepts">) => void,
  onOrbitalClick?: (itemId: string, itemType: string, title: string) => void,
  onArmillaryClick?: (label: string, conceptNames: string[]) => void,
): ZodiacHandle {
  // --- Renderer ---------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // CSS3D renderer for domain labels
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
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
  const camera = createCamera(canvas.clientWidth / canvas.clientHeight);
  const controls = createOrbitControls(camera, canvas);

  // --- Post-processing --------------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
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

  // Sector groups (mutable: rebuilt on activation change)
  const sectorGroups = new Map<string, THREE.Group>();
  SECTORS.forEach((sector) => {
    const g = buildSectorGroup(sector, false);
    scene.add(g);
    sectorGroups.set(sector.id, g);
  });

  // Source nodes
  const sourceNodes = buildSourceNodes(scene);

  // Edges
  const hubEdges = buildHubEdges(scene);
  const domainEdges = buildDomainEdges(scene);

  // --- CSS3D Domain Labels ---------------------------------------------------
  getLabelPositions().forEach(({ sector, x, y, z, rotZ }) => {
    const el = document.createElement("div");
    el.style.fontFamily = "'Cormorant Garamond', Georgia, serif";
    el.style.fontSize = "12px";
    el.style.letterSpacing = "0.2em";
    // The violet sectors only reach 4.66:1 on the void at full alpha, so the
    // labels substitute the lighter text-safe violet; gold and cream are fine.
    el.style.color =
      sector.color === COLORS.violet ? COLORS.violetText : sector.color;
    el.style.opacity = "0.85";
    el.style.transition = "opacity 0.25s ease";
    el.style.userSelect = "none";
    el.textContent = sector.label.toUpperCase();
    el.dataset.sectorId = sector.id;

    const obj = new CSS3DObject(el);
    obj.position.set(x, y, z);
    obj.rotation.z = rotZ;
    cssScene.add(obj);
  });

  // --- State ------------------------------------------------------------------
  let activeSectorId: string | null = null;

  // Phase 1: Constellation layer
  let activeConstellation: ConstellationGroup | null = null;
  let constellationFadeStart: number | null = null;

  // Phase 2: Armillary rings
  let activeArmillary: ArmillaryRingGroup | null = null;
  let armillarySpringStart: number | null = null;

  // Phase 3: Orbital system (persistent, loaded once)
  let orbitalSystem: OrbitalSystem | null = null;
  let pullLinesGroup: THREE.Group | null = null;

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

  function clearPullLines() {
    if (pullLinesGroup) {
      scene.remove(pullLinesGroup);
      pullLinesGroup.traverse((child) => {
        if ("geometry" in child && child.geometry) {
          (child.geometry as THREE.BufferGeometry).dispose();
        }
        if ("material" in child && child.material) {
          (child.material as THREE.Material).dispose();
        }
      });
      pullLinesGroup = null;
    }
  }

  function rebuildSectorGroup(sector: (typeof SECTORS)[0], active: boolean) {
    const old = sectorGroups.get(sector.id);
    if (old) {
      old.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          const mat = child.material;
          if (Array.isArray(mat))
            mat.forEach((m) => {
              m.dispose();
            });
          else (mat as THREE.Material).dispose();
        }
      });
      scene.remove(old);
    }
    const g = buildSectorGroup(sector, active);
    scene.add(g);
    sectorGroups.set(sector.id, g);
  }

  function setActiveSector(id: string | null) {
    // Update previous active sector
    if (activeSectorId && activeSectorId !== id) {
      const prev = SECTORS.find((s) => s.id === activeSectorId);
      if (prev) rebuildSectorGroup(prev, false);

      // Update CSS label opacity (scoped to this scene's CSS3D layer)
      cssRenderer.domElement
        .querySelectorAll<HTMLElement>("[data-sector-id]")
        .forEach((el) => {
          if (el.dataset.sectorId === activeSectorId) el.style.opacity = "0.85";
        });

      // Clear overlays from previous sector
      clearConstellation();
      clearArmillary();
      clearPullLines();
      clearSelectionHalo();
    }

    activeSectorId = id;

    if (id) {
      const sector = SECTORS.find((s) => s.id === id);
      if (sector) {
        rebuildSectorGroup(sector, true);
        // Update CSS label
        cssRenderer.domElement
          .querySelectorAll<HTMLElement>("[data-sector-id]")
          .forEach((el) => {
            if (el.dataset.sectorId === id) el.style.opacity = "1";
          });
      }
    }

    setEdgeActivity(hubEdges, domainEdges, id);
  }

  // --- Raycaster for sector click -------------------------------------------
  const raycaster = new THREE.Raycaster();
  configureRaycaster(raycaster);
  const mouse = new THREE.Vector2();

  function onCanvasClick(e: MouseEvent) {
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
      showSelectionHalo(pick.position);
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
    const meshes: THREE.Mesh[] = [];
    sectorGroups.forEach((g) => {
      g.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
    });

    const hits = raycaster.intersectObjects(meshes);
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

  canvas.addEventListener("click", onCanvasClick);

  // --- Hover tooltip (CSS3D) ------------------------------------------------
  const tooltipEl = document.createElement("div");
  tooltipEl.style.cssText =
    "font-family:'JetBrains Mono',monospace;font-size:12px;color:#c8a84b;background:rgba(13,6,32,0.88);border:1px solid rgba(200,168,75,0.35);padding:4px 8px;pointer-events:none;white-space:nowrap;display:none;position:absolute;z-index:100";
  cssContainer.appendChild(tooltipEl);

  // Selection halo
  let selectionHalo: THREE.Mesh | null = null;

  function clearSelectionHalo() {
    if (selectionHalo) {
      scene.remove(selectionHalo);
      selectionHalo.geometry.dispose();
      (selectionHalo.material as THREE.Material).dispose();
      selectionHalo = null;
    }
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

  let lastHoverTime = 0;
  function onCanvasMouseMove(e: MouseEvent) {
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
      tooltipEl.style.display = "none";
      canvas.style.cursor = "grab";
    }
  }

  canvas.addEventListener("mousemove", onCanvasMouseMove);

  // --- Resize handler --------------------------------------------------------
  function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    cssRenderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }

  window.addEventListener("resize", onResize);

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
      canvas.removeEventListener("click", onCanvasClick);
      canvas.removeEventListener("mousemove", onCanvasMouseMove);
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

    // Phase 3: Load orbital bodies (called once on mount)
    loadOrbitalBodies(
      sources: OrbitalSource[],
      extractions: OrbitalExtraction[],
      hypotheses: OrbitalHypothesis[],
      recipes: OrbitalRecipe[],
    ) {
      // Remove old orbital system
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
    },

    // Phase 3: Show pull-lines from a clicked item to related items
    showPullLines(itemId: string, relations: ItemRelation[]) {
      clearPullLines();
      if (!orbitalSystem) return;

      // Find which ring and index the clicked item is in
      for (const ring of orbitalSystem.rings) {
        const idx = ring.items.findIndex((item) => item.id === itemId);
        if (idx !== -1) {
          pullLinesGroup = buildPullLines(
            ring,
            idx,
            relations,
            orbitalSystem.rings,
          );
          scene.add(pullLinesGroup);
          break;
        }
      }
    },

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
