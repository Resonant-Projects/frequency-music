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

interface OrbitalItem {
  id: string;
  title: string;
  status: string;
  sectorId?: string; // inferred from topics/concepts
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

// Infer which sector an item belongs to from its topics
function inferSectorFromTopics(topics: string[]): string {
  const joined = topics.join(" ").toLowerCase();
  if (joined.includes("math") || joined.includes("ratio") || joined.includes("topolog")) return "math";
  if (joined.includes("wave") || joined.includes("frequency") || joined.includes("reson") || joined.includes("acoust")) return "wave";
  if (joined.includes("psycho") || joined.includes("perception") || joined.includes("consonan")) return "psycho";
  if (joined.includes("geometr") || joined.includes("tonnetz") || joined.includes("symmetry")) return "geometry";
  if (joined.includes("synth") || joined.includes("timbre") || joined.includes("production")) return "synthesis";
  return "music";
}

function getSectorAngleRange(sectorId: string): { start: number; end: number } {
  const sector = SECTORS.find((s) => s.id === sectorId);
  if (!sector) return { start: 0, end: Math.PI * 2 / 6 };
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
    const dummy = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 0);
    return { mesh: dummy, items, radius: ringRadius, label, dispose: () => dummy.dispose() };
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
    const sid = item.sectorId ?? "music";
    if (!sectorGroups.has(sid)) sectorGroups.set(sid, []);
    sectorGroups.get(sid)!.push(i);
  });

  for (const [sectorId, indices] of sectorGroups) {
    const { start, end } = getSectorAngleRange(sectorId);
    indices.forEach((idx, j) => {
      const t = indices.length > 1 ? j / (indices.length - 1) : 0.5;
      angleAttrib[idx] = start + t * (end - start);
      speedAttrib[idx] = 0.02 + Math.random() * 0.01; // slow orbit

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
    color.set(colorAttrib[i * 3], colorAttrib[i * 3 + 1], colorAttrib[i * 3 + 2]);
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

export function buildOrbitalSystem(
  sources: OrbitalSource[],
  extractions: OrbitalExtraction[],
  hypotheses: OrbitalHypothesis[],
  recipes: OrbitalRecipe[],
): OrbitalSystem {
  const group = new THREE.Group();
  group.userData.type = "orbital-system";

  // Map sources to orbital items with sector inference
  const sourceItems: OrbitalItem[] = sources.map((s) => ({
    id: s._id,
    title: s.title ?? "Untitled",
    status: s.status,
    sectorId: inferSectorFromTopics(s.topics ?? []),
  }));

  const extractionItems: OrbitalItem[] = extractions.map((e) => ({
    id: e._id,
    title: `Extraction (${e.topics.slice(0, 2).join(", ")})`,
    status: e.confidence > 0.7 ? "extracted" : "review_needed",
    sectorId: inferSectorFromTopics(e.topics),
  }));

  const hypothesisItems: OrbitalItem[] = hypotheses.map((h) => ({
    id: h._id,
    title: h.title,
    status: h.status,
    sectorId: inferSectorFromTopics(h.concepts ?? []),
  }));

  const recipeItems: OrbitalItem[] = recipes.map((r) => ({
    id: r._id,
    title: r.title,
    status: r.status,
  }));

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
    const baseAngles = ring.mesh.userData.baseAngles as Float32Array | undefined;
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

// Build pull-lines from a clicked item to its related items on other rings
export function buildPullLines(
  clickedRing: OrbitalRing,
  clickedIndex: number,
  relations: ItemRelation[],
  allRings: OrbitalRing[],
): THREE.Group {
  const group = new THREE.Group();
  group.userData.type = "pull-lines";

  // Get clicked item position from instance matrix
  const srcMatrix = new THREE.Matrix4();
  clickedRing.mesh.getMatrixAt(clickedIndex, srcMatrix);
  const srcPos = new THREE.Vector3().setFromMatrixPosition(srcMatrix);

  for (const relation of relations) {
    // Find the target item across all rings
    for (const ring of allRings) {
      const targetIdx = ring.items.findIndex((item) => item.id === relation.id);
      if (targetIdx === -1) continue;

      const tgtMatrix = new THREE.Matrix4();
      ring.mesh.getMatrixAt(targetIdx, tgtMatrix);
      const tgtPos = new THREE.Vector3().setFromMatrixPosition(tgtMatrix);

      // Catmull-Rom curve through midpoint raised above disc
      const midZ = Math.max(srcPos.z, tgtPos.z) + 30;
      const midPoint = new THREE.Vector3(
        (srcPos.x + tgtPos.x) / 2,
        (srcPos.y + tgtPos.y) / 2,
        midZ,
      );

      const curve = new THREE.CatmullRomCurve3([srcPos, midPoint, tgtPos]);
      const pts = curve.getPoints(20);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: COLORS.gold,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      group.add(new THREE.Line(geo, mat));
    }
  }

  return group;
}
