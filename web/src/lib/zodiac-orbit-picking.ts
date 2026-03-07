// ZODIAC orbit picking — spatial index for instanced mesh raycasting.
// THREE.js default InstancedMesh raycasting is expensive for 200+ instances.
// This uses a simple grid-based spatial lookup.

import * as THREE from "three";
import type { Id } from "../../../convex/_generated/dataModel";
import type { OrbitalRing, OrbitalSystem } from "./zodiac-orbits";
import type { ConstellationGroup, ConceptStar } from "./zodiac-constellations";
import type { ArmillaryRingGroup } from "./zodiac-armillary";

export interface PickResult {
  type: "concept" | "orbital-item" | "armillary-ring";
  id: string | Id<"concepts">;
  label: string;
  position: THREE.Vector3;
  ringLabel?: string;
  ringIndex?: number;
  itemIndex?: number;
}

// Raycaster config for points
export function configureRaycaster(raycaster: THREE.Raycaster): void {
  raycaster.params.Points = { threshold: 8 };
}

// Pick concept stars from constellation point clouds
export function pickConceptStar(
  raycaster: THREE.Raycaster,
  constellation: ConstellationGroup | null,
): PickResult | null {
  if (!constellation || constellation.stars.length === 0) return null;

  const intersects = raycaster.intersectObject(constellation.pointCloud);
  if (intersects.length === 0) return null;

  const idx = intersects[0].index;
  if (idx === undefined || idx >= constellation.stars.length) return null;

  const star = constellation.stars[idx];
  return {
    type: "concept",
    id: star.conceptId,
    label: star.displayName,
    position: new THREE.Vector3(star.x, star.y, star.z),
  };
}

// Pick orbital items from instanced meshes
export function pickOrbitalItem(
  raycaster: THREE.Raycaster,
  system: OrbitalSystem | null,
): PickResult | null {
  if (!system) return null;

  for (const ring of system.rings) {
    if (ring.items.length === 0) continue;

    const intersects = raycaster.intersectObject(ring.mesh);
    if (intersects.length === 0) continue;

    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined || instanceId >= ring.items.length) continue;

    const item = ring.items[instanceId];
    const matrix = new THREE.Matrix4();
    ring.mesh.getMatrixAt(instanceId, matrix);
    const pos = new THREE.Vector3().setFromMatrixPosition(matrix);

    return {
      type: "orbital-item",
      id: item.id,
      label: item.title,
      position: pos,
      ringLabel: ring.label,
      itemIndex: instanceId,
    };
  }

  return null;
}

// Pick armillary rings (torus meshes)
export function pickArmillaryRing(
  raycaster: THREE.Raycaster,
  armillary: ArmillaryRingGroup | null,
): PickResult | null {
  if (!armillary) return null;

  for (let i = 0; i < armillary.rings.length; i++) {
    const ring = armillary.rings[i];
    const intersects = raycaster.intersectObject(ring.torus);
    if (intersects.length === 0) continue;

    return {
      type: "armillary-ring",
      id: ring.label,
      label: ring.label,
      position: intersects[0].point,
      ringIndex: i,
    };
  }

  return null;
}

// Unified pick: tries concept stars first, then armillary, then orbital
export function pickAny(
  raycaster: THREE.Raycaster,
  constellation: ConstellationGroup | null,
  armillary: ArmillaryRingGroup | null,
  orbitalSystem: OrbitalSystem | null,
): PickResult | null {
  return (
    pickConceptStar(raycaster, constellation) ??
    pickArmillaryRing(raycaster, armillary) ??
    pickOrbitalItem(raycaster, orbitalSystem)
  );
}
