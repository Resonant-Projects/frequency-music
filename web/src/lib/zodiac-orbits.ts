// ZODIAC orbital bodies — pipeline items as orbiting instanced meshes.
// Sources (r=160), Extractions (r=128), Hypotheses (r=92), Recipes (r=58).

import * as THREE from "three";
import {
  type ConceptSectors,
  itemSector,
  sourceTopicNames,
} from "./item-sectors";
import { COLORS, R, SECTORS, STATUS_COLORS } from "./zodiac-data";
import type { ItemRelation, PipelineItems } from "./zodiac-types";

export interface OrbitalItem {
  id: string;
  title: string;
  status: string;
  sectorId?: string; // from classified concepts, else topic keywords
}

/** The orbiting bodies, one list per ring, keyed like `PipelineItems`. */
export type OrbitalItemGroups = Record<keyof PipelineItems, OrbitalItem[]>;

/** The sector an orbiting body is drawn in; unplaced items sit in Music. */
export function orbitalItemSector(item: OrbitalItem): string {
  return item.sectorId ?? "music";
}

export interface OrbitalRing {
  mesh: THREE.InstancedMesh;
  items: OrbitalItem[];
  radius: number;
  label: string;
  dispose: () => void;
}

export interface OrbitalSystem {
  group: THREE.Group;
  rings: OrbitalRing[];
  dispose: () => void;
}

const reusableOrbitDummy = new THREE.Object3D();

// Stable per-item value in [0, 1): a live data refresh rebuilds the rings, and
// a body must keep its place and speed across rebuilds instead of re-rolling
// them or shifting when another item arrives or leaves.
function hashUnit(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

function getSectorAngleRange(sectorId: string): { start: number; end: number } {
  const sector = SECTORS.find((s) => s.id === sectorId);
  if (!sector) return { start: 0, end: (Math.PI * 2) / 6 };
  return { start: sector.startAngle, end: sector.endAngle };
}

// Bodies keep this fraction of the sector span clear at each end, so none sits
// on a sector spoke.
const SECTOR_EDGE_MARGIN = 0.08;

function buildOrbitalRing(
  ringRadius: number,
  items: OrbitalItem[],
  geometry: THREE.BufferGeometry,
  label: string,
  z: number,
): OrbitalRing {
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.void,
    emissive: COLORS.gold,
    emissiveIntensity: 0.5,
    metalness: 0.3,
    roughness: 0.7,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.InstancedMesh(geometry, mat, items.length);
  mesh.userData = { type: "orbital-ring", label, ringRadius };

  const baseAngles = new Float32Array(items.length);
  const speeds = new Float32Array(items.length);
  const color = new THREE.Color();

  items.forEach((item, i) => {
    // Phase within the sector and orbital speed both come from the id, so a
    // body's position depends on nothing but itself.
    const { start, end } = getSectorAngleRange(orbitalItemSector(item));
    const phase =
      SECTOR_EDGE_MARGIN +
      hashUnit(`${item.id}:phase`) * (1 - 2 * SECTOR_EDGE_MARGIN);
    const angle = start + phase * (end - start);
    baseAngles[i] = angle;
    speeds[i] = 0.02 + hashUnit(item.id) * 0.01; // slow orbit

    reusableOrbitDummy.position.set(
      ringRadius * Math.cos(angle),
      -ringRadius * Math.sin(angle),
      z,
    );
    reusableOrbitDummy.updateMatrix();
    mesh.setMatrixAt(i, reusableOrbitDummy.matrix);
    mesh.setColorAt(i, color.set(STATUS_COLORS[item.status] ?? COLORS.gold));
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  // Store angle/speed for animation
  mesh.userData.baseAngles = baseAngles;
  mesh.userData.speeds = speeds;
  mesh.userData.zOffset = z;

  return {
    mesh,
    items,
    radius: ringRadius,
    label,
    dispose: () => {
      geometry.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}

/** Pipeline items as orbiting bodies, one list per ring. The sidebar reads
 *  the same lists so its keyboard path names exactly what the scene draws. */
export function buildOrbitalItemGroups(
  items: PipelineItems,
  conceptSectors: ConceptSectors = new Map(),
): OrbitalItemGroups {
  const sourceTopics = sourceTopicNames(items.extractions);
  return {
    sources: items.sources.map((s) => ({
      id: s._id,
      title: s.title ?? "Untitled",
      status: s.status,
      sectorId: itemSector(sourceTopics(s), conceptSectors),
    })),
    extractions: items.extractions.map((e) => ({
      id: e._id,
      title: `Extraction (${e.topics.slice(0, 2).join(", ")})`,
      status: e.confidence > 0.7 ? "extracted" : "review_needed",
      sectorId: itemSector(e.topics, conceptSectors),
    })),
    hypotheses: items.hypotheses.map((h) => ({
      id: h._id,
      title: h.title,
      status: h.status,
      sectorId: itemSector(h.concepts, conceptSectors),
    })),
    recipes: items.recipes.map((r) => ({
      id: r._id,
      title: r.title,
      status: r.status,
    })),
  };
}

export function buildOrbitalSystem(groups: OrbitalItemGroups): OrbitalSystem {
  const group = new THREE.Group();
  group.userData.type = "orbital-system";

  // Build each ring
  const sourcesRing = buildOrbitalRing(
    R.sources,
    groups.sources,
    new THREE.SphereGeometry(1.8, 8, 6),
    "Sources",
    -40,
  );

  const extractionsRing = buildOrbitalRing(
    R.extract,
    groups.extractions,
    new THREE.SphereGeometry(2.5, 8, 6),
    "Extractions",
    -30,
  );

  const hypothesesRing = buildOrbitalRing(
    R.hypothesis,
    groups.hypotheses,
    new THREE.IcosahedronGeometry(3, 0),
    "Hypotheses",
    -20,
  );

  const recipesRing = buildOrbitalRing(
    R.recipe,
    groups.recipes,
    new THREE.OctahedronGeometry(3.5, 0),
    "Recipes",
    -10,
  );

  const rings = [sourcesRing, extractionsRing, hypothesesRing, recipesRing];
  for (const ring of rings) {
    group.add(ring.mesh);
  }

  return {
    group,
    rings,
    dispose: () => {
      rings.forEach((r) => r.dispose());
    },
  };
}

// Update orbital positions each frame
export function updateOrbits(system: OrbitalSystem, time: number): void {
  for (const ring of system.rings) {
    const baseAngles = ring.mesh.userData.baseAngles as
      | Float32Array
      | undefined;
    const speeds = ring.mesh.userData.speeds as Float32Array | undefined;
    const z = ring.mesh.userData.zOffset ?? 0;

    if (!baseAngles || !speeds || ring.items.length === 0) continue;

    for (let i = 0; i < ring.items.length; i++) {
      const angle = baseAngles[i] + time * speeds[i];
      reusableOrbitDummy.position.set(
        ring.radius * Math.cos(angle),
        -ring.radius * Math.sin(angle),
        z,
      );
      reusableOrbitDummy.updateMatrix();
      ring.mesh.setMatrixAt(i, reusableOrbitDummy.matrix);
    }

    ring.mesh.instanceMatrix.needsUpdate = true;
  }
}

const PULL_LINE_SEGMENTS = 20;

export interface PullLines {
  /** Every link in one geometry: a single draw call however many there are. */
  object: THREE.LineSegments;
  /** Re-trace every line from the bodies' current instance matrices. */
  update: () => void;
  dispose: () => void;
}

// Build pull-lines from a clicked item to its related items on other rings.
// The bodies keep orbiting, so the lines are re-traced every frame via
// `update()` rather than baked at build time.
export function buildPullLines(
  clickedRing: OrbitalRing,
  clickedIndex: number,
  relations: ItemRelation[],
  allRings: OrbitalRing[],
): PullLines {
  const targets: Array<{ ring: OrbitalRing; index: number }> = [];
  for (const relation of relations) {
    // Find the target item across all rings
    for (const ring of allRings) {
      const index = ring.items.findIndex((item) => item.id === relation.id);
      if (index !== -1) targets.push({ ring, index });
    }
  }

  // Each link is a curve of PULL_LINE_SEGMENTS segments, two vertices apiece.
  const position = new THREE.BufferAttribute(
    new Float32Array(targets.length * PULL_LINE_SEGMENTS * 2 * 3),
    3,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position);
  const material = new THREE.LineBasicMaterial({
    color: COLORS.gold,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.userData.type = "pull-lines";
  // The geometry moves every frame; a stale bounding sphere would cull it.
  object.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const srcPos = new THREE.Vector3();
  const tgtPos = new THREE.Vector3();
  const midPoint = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const point = new THREE.Vector3();
  // Catmull-Rom curve through a midpoint raised above the disc. The curve
  // holds these vectors by reference, so mutating them re-shapes it.
  const curve = new THREE.CatmullRomCurve3([srcPos, midPoint, tgtPos]);

  function update() {
    clickedRing.mesh.getMatrixAt(clickedIndex, matrix);
    srcPos.setFromMatrixPosition(matrix);
    let vertex = 0;
    for (const target of targets) {
      target.ring.mesh.getMatrixAt(target.index, matrix);
      tgtPos.setFromMatrixPosition(matrix);
      midPoint.set(
        (srcPos.x + tgtPos.x) / 2,
        (srcPos.y + tgtPos.y) / 2,
        Math.max(srcPos.z, tgtPos.z) + 30,
      );
      curve.getPoint(0, prev);
      for (let i = 1; i <= PULL_LINE_SEGMENTS; i++) {
        curve.getPoint(i / PULL_LINE_SEGMENTS, point);
        position.setXYZ(vertex++, prev.x, prev.y, prev.z);
        position.setXYZ(vertex++, point.x, point.y, point.z);
        prev.copy(point);
      }
    }
    position.needsUpdate = true;
  }

  update();
  return {
    object,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
