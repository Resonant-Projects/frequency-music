// ZODIAC constellation overlay — concept clusters rendered as star patterns.
// Each concept = a star (THREE.Points), edges between them = constellation lines.
// Cross-domain concepts get gold bezier arcs.

import * as THREE from "three";
import { COLORS, R, SECTORS, type SectorDef } from "./zodiac-data";
import type {
  ConstellationConcept,
  ZodiacConstellationEdge,
} from "./zodiac-types";

export interface ConceptStar {
  name: string;
  displayName: string;
  conceptId: ConstellationConcept["_id"];
  mentionCount: number;
  domain: string;
  x: number;
  y: number;
  z: number;
}

export type ConstellationEdge = ZodiacConstellationEdge;

export interface ConstellationGroup {
  group: THREE.Group;
  stars: ConceptStar[];
  pointCloud: THREE.Points;
  dispose: () => void;
}

// Simple force-repulsion to distribute concepts within a sector wedge
function layoutConcepts(
  sector: SectorDef,
  concepts: ConstellationConcept[],
): ConceptStar[] {
  const { startAngle, endAngle } = sector;
  const rMin = 185;
  const rMax = 255;
  const angPad = 0.05; // radians padding from edges
  const angRange = endAngle - startAngle - angPad * 2;

  // Initial placement: distribute evenly along the wedge
  const stars: ConceptStar[] = concepts.map((c, i) => {
    const t = concepts.length > 1 ? i / (concepts.length - 1) : 0.5;
    const angle = startAngle + angPad + t * angRange;
    const r = rMin + (i % 3) * ((rMax - rMin) / 3) + Math.random() * 15;
    const z = 8 + Math.random() * 12;
    return {
      name: c.name,
      displayName: c.displayName,
      conceptId: c._id,
      mentionCount: c.mentionCount,
      domain: c.domain,
      x: r * Math.cos(angle),
      y: -r * Math.sin(angle),
      z,
    };
  });

  // Simple force repulsion (3 iterations)
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[j].x - stars[i].x;
        const dy = stars[j].y - stars[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 18;
        if (dist < minDist && dist > 0) {
          const force = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          stars[i].x -= nx * force;
          stars[i].y -= ny * force;
          stars[j].x += nx * force;
          stars[j].y += ny * force;
        }
      }
    }
  }

  return stars;
}

// Twinkle shader for concept stars
const TWINKLE_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aOffset;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vAlpha = 0.5 + 0.5 * sin(uTime * 1.5 + aOffset * 6.28);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const TWINKLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(uColor, vAlpha * glow * uAlpha);
  }
`;

export function buildConstellations(
  sector: SectorDef,
  concepts: ConstellationConcept[],
  edges: ConstellationEdge[],
): ConstellationGroup {
  const group = new THREE.Group();
  group.userData.type = "constellation";
  group.userData.sectorId = sector.id;

  if (concepts.length === 0) {
    return {
      group,
      stars: [],
      pointCloud: new THREE.Points(),
      dispose: () => {},
    };
  }

  const stars = layoutConcepts(sector, concepts);

  // Build point cloud with twinkle shader
  const positions = new Float32Array(stars.length * 3);
  const sizes = new Float32Array(stars.length);
  const offsets = new Float32Array(stars.length);

  stars.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = star.z;
    // Size scaled by mention count: 4-14
    sizes[i] = Math.min(4 + star.mentionCount * 0.8, 14);
    offsets[i] = Math.random();
  });

  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pointGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  pointGeo.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 1));

  const pointMat = new THREE.ShaderMaterial({
    vertexShader: TWINKLE_VERTEX,
    fragmentShader: TWINKLE_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(sector.color) },
      uAlpha: { value: 0 }, // starts at 0 for fade-in
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const pointCloud = new THREE.Points(pointGeo, pointMat);
  group.add(pointCloud);

  // Build constellation edge lines
  const starMap = new Map(stars.map((s) => [s.name, s]));
  const linePts: THREE.Vector3[] = [];

  for (const edge of edges) {
    const from = starMap.get(edge.from);
    const to = starMap.get(edge.to);
    if (from && to) {
      linePts.push(
        new THREE.Vector3(from.x, from.y, from.z),
        new THREE.Vector3(to.x, to.y, to.z),
      );
    }
  }

  if (linePts.length > 0) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: sector.color,
      transparent: true,
      opacity: 0, // starts at 0 for fade-in
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);
  }

  // Stars start invisible via uAlpha=0; line materials start at opacity 0
  group.visible = true;

  return {
    group,
    stars,
    pointCloud,
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

// Animate constellation fade-in (call each frame during transition)
export function animateConstellationFadeIn(
  constellation: ConstellationGroup,
  progress: number, // 0-1
): void {
  const alpha = Math.min(progress, 1);
  // Fade in constellation edge lines
  constellation.group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      (child.material as THREE.LineBasicMaterial).opacity = alpha * 0.2;
    }
  });
  // Fade in concept stars via uAlpha uniform (preserves sector color)
  const mat = constellation.pointCloud.material as THREE.ShaderMaterial;
  if (mat.uniforms?.uAlpha) {
    mat.uniforms.uAlpha.value = alpha;
  }
}

// Update twinkle animation (call every frame)
export function updateConstellationTime(
  constellation: ConstellationGroup,
  time: number,
): void {
  const mat = constellation.pointCloud.material as THREE.ShaderMaterial;
  if (mat.uniforms?.uTime) {
    mat.uniforms.uTime.value = time;
  }
}

// Build cross-domain arcs for concepts appearing in multiple sectors
export function buildCrossDomainArcs(
  concepts: Array<{ name: string; domain: string }>,
  starPositions: Map<string, THREE.Vector3>,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.type = "crossDomainArcs";

  // Find concepts that exist in starPositions from different sectors
  // For now, draw gold arcs between same-named concepts across sectors
  const conceptPositions = new Map<string, THREE.Vector3[]>();
  for (const [name, pos] of starPositions) {
    if (!conceptPositions.has(name)) conceptPositions.set(name, []);
    conceptPositions.get(name)!.push(pos);
  }

  for (const [, positions] of conceptPositions) {
    if (positions.length < 2) continue;
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      const curve = new THREE.CubicBezierCurve3(
        start,
        new THREE.Vector3(start.x, start.y, 25),
        new THREE.Vector3(end.x, end.y, 25),
        end,
      );
      const pts = curve.getPoints(24);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: COLORS.gold,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      group.add(new THREE.Line(geo, mat));
    }
  }

  return group;
}
