// ZODIAC orbital bodies — pipeline items as orbiting instanced meshes.
// Sources (r=160), Extractions (r=128), Hypotheses (r=92), Recipes (r=58).

import * as THREE from "three";
import { COLORS, R, SECTORS, STATUS_COLORS } from "./zodiac-data";
import type {
  ItemRelation,
  OrbitalExtraction,
  OrbitalHypothesis,
  OrbitalRecipe,
  OrbitalSource,
} from "./zodiac-types";

export interface OrbitalItem {
  id: string;
  title: string;
  status: string;
  sectorId?: string; // inferred from topics/concepts
}

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
// a body must keep its orbital speed across rebuilds instead of re-rolling it.
function hashUnit(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

// Infer which sector an item belongs to from its topics
function inferSectorFromTopics(topics: string[]): string {
  const joined = topics.join(" ").toLowerCase();
  if (
    joined.includes("math") ||
    joined.includes("ratio") ||
    joined.includes("topolog")
  )
    return "math";
  if (
    joined.includes("wave") ||
    joined.includes("frequency") ||
    joined.includes("reson") ||
    joined.includes("acoust")
  )
    return "wave";
  if (
    joined.includes("psycho") ||
    joined.includes("perception") ||
    joined.includes("consonan")
  )
    return "psycho";
  if (
    joined.includes("geometr") ||
    joined.includes("tonnetz") ||
    joined.includes("symmetry")
  )
    return "geometry";
  if (
    joined.includes("synth") ||
    joined.includes("timbre") ||
    joined.includes("production")
  )
    return "synthesis";
  return "music";
}

function getSectorAngleRange(sectorId: string): { start: number; end: number } {
  const sector = SECTORS.find((s) => s.id === sectorId);
  if (!sector) return { start: 0, end: (Math.PI * 2) / 6 };
  return { start: sector.startAngle, end: sector.endAngle };
}

function buildOrbitalRing(
  ringRadius: number,
  items: OrbitalItem[],
  geometry: THREE.BufferGeometry,
  label: string,
  z: number,
): OrbitalRing {
  const count = items.length;
  if (count === 0) {
    const dummy = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial(),
      0,
    );
    return {
      mesh: dummy,
      items,
      radius: ringRadius,
      label,
      dispose: () => dummy.dispose(),
    };
  }

  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.void,
    emissive: COLORS.gold,
    emissiveIntensity: 0.5,
    metalness: 0.3,
    roughness: 0.7,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.InstancedMesh(geometry, mat, count);
  mesh.userData = { type: "orbital-ring", label, ringRadius };

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Pre-compute per-instance angles grouped by sector
  const angleAttrib = new Float32Array(count);
  const speedAttrib = new Float32Array(count);
  const colorAttrib = new Float32Array(count * 3);

  // Group items by sector to create density clusters
  const sectorGroups = new Map<string, number[]>();
  items.forEach((item, i) => {
    const sid = orbitalItemSector(item);
    if (!sectorGroups.has(sid)) sectorGroups.set(sid, []);
    sectorGroups.get(sid)!.push(i);
  });

  for (const [sectorId, indices] of sectorGroups) {
    const { start, end } = getSectorAngleRange(sectorId);
    indices.forEach((idx, j) => {
      const t = indices.length > 1 ? j / (indices.length - 1) : 0.5;
      angleAttrib[idx] = start + t * (end - start);
      speedAttrib[idx] = 0.02 + hashUnit(items[idx].id) * 0.01; // slow orbit

      // Color by status
      const statusColor = STATUS_COLORS[items[idx].status] ?? COLORS.gold;
      color.set(statusColor);
      colorAttrib[idx * 3] = color.r;
      colorAttrib[idx * 3 + 1] = color.g;
      colorAttrib[idx * 3 + 2] = color.b;
    });
  }

  // Set instance transforms (positioned at origin, orbit shader moves them)
  items.forEach((_, i) => {
    const angle = angleAttrib[i];
    dummy.position.set(
      ringRadius * Math.cos(angle),
      -ringRadius * Math.sin(angle),
      z,
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // Set instance color from status
    color.set(
      colorAttrib[i * 3],
      colorAttrib[i * 3 + 1],
      colorAttrib[i * 3 + 2],
    );
    mesh.setColorAt(i, color);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  // Store angle/speed for animation
  mesh.userData.baseAngles = angleAttrib;
  mesh.userData.speeds = speedAttrib;
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
  sources: OrbitalSource[],
  extractions: OrbitalExtraction[],
  hypotheses: OrbitalHypothesis[],
  recipes: OrbitalRecipe[],
): {
  sources: OrbitalItem[];
  extractions: OrbitalItem[];
  hypotheses: OrbitalItem[];
  recipes: OrbitalItem[];
} {
  return {
    sources: sources.map((s) => ({
      id: s._id,
      title: s.title ?? "Untitled",
      status: s.status,
      sectorId: inferSectorFromTopics(s.topics ?? []),
    })),
    extractions: extractions.map((e) => ({
      id: e._id,
      title: `Extraction (${e.topics.slice(0, 2).join(", ")})`,
      status: e.confidence > 0.7 ? "extracted" : "review_needed",
      sectorId: inferSectorFromTopics(e.topics),
    })),
    hypotheses: hypotheses.map((h) => ({
      id: h._id,
      title: h.title,
      status: h.status,
      sectorId: inferSectorFromTopics(h.concepts ?? []),
    })),
    recipes: recipes.map((r) => ({
      id: r._id,
      title: r.title,
      status: r.status,
    })),
  };
}

export function buildOrbitalSystem(
  sources: OrbitalSource[],
  extractions: OrbitalExtraction[],
  hypotheses: OrbitalHypothesis[],
  recipes: OrbitalRecipe[],
): OrbitalSystem {
  const group = new THREE.Group();
  group.userData.type = "orbital-system";

  const {
    sources: sourceItems,
    extractions: extractionItems,
    hypotheses: hypothesisItems,
    recipes: recipeItems,
  } = buildOrbitalItemGroups(sources, extractions, hypotheses, recipes);

  // Build each ring
  const sourcesRing = buildOrbitalRing(
    R.sources,
    sourceItems,
    new THREE.SphereGeometry(1.8, 8, 6),
    "Sources",
    -40,
  );

  const extractionsRing = buildOrbitalRing(
    R.extract,
    extractionItems,
    new THREE.SphereGeometry(2.5, 8, 6),
    "Extractions",
    -30,
  );

  const hypothesesRing = buildOrbitalRing(
    R.hypothesis,
    hypothesisItems,
    new THREE.IcosahedronGeometry(3, 0),
    "Hypotheses",
    -20,
  );

  const recipesRing = buildOrbitalRing(
    R.recipe,
    recipeItems,
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
  group: THREE.Group;
  /** Re-trace every line from the bodies' current instance matrices. */
  update: () => void;
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
  const group = new THREE.Group();
  group.userData.type = "pull-lines";

  const links: Array<{ line: THREE.Line; ring: OrbitalRing; index: number }> =
    [];

  for (const relation of relations) {
    // Find the target item across all rings
    for (const ring of allRings) {
      const targetIdx = ring.items.findIndex((item) => item.id === relation.id);
      if (targetIdx === -1) continue;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array((PULL_LINE_SEGMENTS + 1) * 3),
          3,
        ),
      );
      const mat = new THREE.LineBasicMaterial({
        color: COLORS.gold,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      // The geometry moves every frame; a stale bounding sphere would cull it.
      line.frustumCulled = false;
      group.add(line);
      links.push({ line, ring, index: targetIdx });
    }
  }

  const matrix = new THREE.Matrix4();
  const srcPos = new THREE.Vector3();
  const tgtPos = new THREE.Vector3();
  const midPoint = new THREE.Vector3();
  const point = new THREE.Vector3();
  // Catmull-Rom curve through a midpoint raised above the disc. The curve
  // holds these vectors by reference, so mutating them re-shapes it.
  const curve = new THREE.CatmullRomCurve3([srcPos, midPoint, tgtPos]);

  function update() {
    clickedRing.mesh.getMatrixAt(clickedIndex, matrix);
    srcPos.setFromMatrixPosition(matrix);
    for (const link of links) {
      link.ring.mesh.getMatrixAt(link.index, matrix);
      tgtPos.setFromMatrixPosition(matrix);
      midPoint.set(
        (srcPos.x + tgtPos.x) / 2,
        (srcPos.y + tgtPos.y) / 2,
        Math.max(srcPos.z, tgtPos.z) + 30,
      );
      const position = link.line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i <= PULL_LINE_SEGMENTS; i++) {
        curve.getPoint(i / PULL_LINE_SEGMENTS, point);
        position.setXYZ(i, point.x, point.y, point.z);
      }
      position.needsUpdate = true;
    }
  }

  update();
  return { group, update };
}
