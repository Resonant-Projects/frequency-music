// ZODIAC armillary rings — sub-topic orbital bands rendered as tilted torus rings.
// Each sub-topic cluster = a thin torus, items = instanced spheres along the torus.

import * as THREE from "three";
import { R, type SectorDef } from "./zodiac-data";
import type { ZodiacSubTopic } from "./zodiac-types";

export interface ArmillaryRingGroup {
  group: THREE.Group;
  rings: Array<{
    torus: THREE.Mesh;
    label: string;
    conceptNames: string[];
  }>;
  dispose: () => void;
}

const RING_COLORS = ["#8b5cf6", "#c8a84b", "#f5f0e8", "#6366f1"];
const TILT_ANGLES = [15, 30, 45, 60]; // degrees

export function buildArmillaryRings(
  sector: SectorDef,
  subTopics: ZodiacSubTopic[],
): ArmillaryRingGroup {
  const group = new THREE.Group();
  group.userData.type = "armillary";
  group.userData.sectorId = sector.id;

  // Position rings around sector midpoint
  const midAngle = (sector.startAngle + sector.endAngle) / 2;
  const centerR = (R.sectorInner + R.sectorOuter) / 2;
  const cx = centerR * Math.cos(midAngle);
  const cy = -centerR * Math.sin(midAngle);

  const rings: ArmillaryRingGroup["rings"] = [];

  subTopics.forEach((subTopic, i) => {
    const ringRadius = 30 + i * 15; // 30, 45, 60, 75
    const tubeRadius = 1.2;
    const tiltDeg = TILT_ANGLES[i % TILT_ANGLES.length];
    const color = RING_COLORS[i % RING_COLORS.length];

    // Torus geometry
    const torusGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 12, 48);
    const torusMat = new THREE.MeshStandardMaterial({
      color: "#0d0620",
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.6,
      transparent: true,
      opacity: 0.6,
    });

    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.set(cx, cy, 0);
    torus.rotation.x = (tiltDeg * Math.PI) / 180;
    torus.rotation.y = (i * 40 * Math.PI) / 180; // stagger rotation
    torus.userData = {
      type: "armillary-ring",
      sectorId: sector.id,
      subTopicLabel: subTopic.label,
      ringIndex: i,
    };

    // Start at y=0 for spring animation
    torus.userData.targetZ = 10 + i * 18;
    torus.position.z = 0;

    group.add(torus);

    // Add item spheres distributed along the torus
    if (subTopic.itemCount > 0) {
      const sphereCount = Math.min(subTopic.itemCount, 20);
      const sphereGeo = new THREE.SphereGeometry(2, 6, 4);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: "#0d0620",
        emissive: color,
        emissiveIntensity: 0.7,
        metalness: 0.3,
        roughness: 0.7,
      });

      for (let j = 0; j < sphereCount; j++) {
        const angle = (j / sphereCount) * Math.PI * 2;
        const sx = ringRadius * Math.cos(angle);
        const sy = ringRadius * Math.sin(angle);
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.set(sx, sy, 0);
        torus.add(sphere); // child of torus, inherits transforms
      }
    }

    rings.push({
      torus,
      label: subTopic.label,
      conceptNames: subTopic.conceptNames,
    });
  });

  return {
    group,
    rings,
    dispose: () => {
      const disposedMaterials = new Set<THREE.Material>();
      group.traverse((child) => {
        if ("geometry" in child && child.geometry) {
          (child.geometry as THREE.BufferGeometry).dispose();
        }
        if ("material" in child && child.material) {
          const mat = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) {
            mat.forEach((entry) => {
              if (disposedMaterials.has(entry)) return;
              disposedMaterials.add(entry);
              entry.dispose();
            });
          } else if (!disposedMaterials.has(mat)) {
            disposedMaterials.add(mat);
            mat.dispose();
          }
        }
      });
    },
  };
}

// Spring animation: rings rise from z=0 to targetZ with staggered 150ms delay
export function animateArmillarySpring(
  armillary: ArmillaryRingGroup,
  elapsed: number, // ms since animation started
): boolean {
  let allDone = true;

  armillary.rings.forEach((ring, i) => {
    const delay = i * 150;
    const t = Math.max(0, elapsed - delay) / 600; // 600ms per ring
    if (t < 1) allDone = false;

    const ease = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); // ease-out cubic
    const targetZ = ring.torus.userData.targetZ ?? 40;
    ring.torus.position.z = ease * targetZ;
  });

  return allDone;
}

// Slow rotation animation (call every frame)
export function updateArmillaryRotation(
  armillary: ArmillaryRingGroup,
  time: number,
): void {
  armillary.rings.forEach((ring, i) => {
    const speed = 0.08 + i * 0.03; // inner fastest
    ring.torus.rotation.z = time * speed;
  });
}
