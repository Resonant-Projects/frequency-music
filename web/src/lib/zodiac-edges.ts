// ZODIAC edge/connection builders — hub→domain and domain→source bezier curves.

import * as THREE from "three";
import { dotWorldPos, R, SECTORS } from "./zodiac-data";
import { getSectorMidArc } from "./zodiac-geometry";
import { makeEdgeMat } from "./zodiac-materials";

type SectorEdge = { line: THREE.Line; sectorId: string };

// Resting / lit opacity per edge kind; a sector's edges light with it.
const EDGE_OPACITY = {
  hub: { rest: 0.18, lit: 0.65 },
  domain: { rest: 0.14, lit: 0.55 },
} as const;

// --- Hub → Domain edges (straight lines from origin to sector inner midpoint) ---

export function buildHubEdges(scene: THREE.Scene): SectorEdge[] {
  const edges: SectorEdge[] = [];

  SECTORS.forEach((sector) => {
    const target = getSectorMidArc(sector, R.sectorInner);
    const pts = [new THREE.Vector3(0, 0, 0), target];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = makeEdgeMat(sector.color, EDGE_OPACITY.hub.rest);
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    edges.push({ line, sectorId: sector.id });
  });

  return edges;
}

// --- Domain → Source edges (quadratic bezier arcing upward through Z space) ---

function buildBezierEdge(
  start: THREE.Vector3,
  end: THREE.Vector3,
  controlZ: number,
  mat: THREE.LineBasicMaterial,
  segments = 32,
): THREE.Line {
  const control = new THREE.Vector3(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    controlZ,
  );
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const pts = curve.getPoints(segments);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, mat);
}

export function buildDomainEdges(scene: THREE.Scene): SectorEdge[] {
  const edges: SectorEdge[] = [];

  SECTORS.forEach((sector) => {
    const origin = getSectorMidArc(sector, 200); // slightly inside sector
    // One material per sector
    const mat = makeEdgeMat(sector.color, EDGE_OPACITY.domain.rest);

    sector.dots.forEach((dot, di) => {
      const pos = dotWorldPos(sector, dot, 30 + di * 10);
      const end = new THREE.Vector3(pos.x, pos.y, pos.z);
      const line = buildBezierEdge(origin, end, 80, mat);
      scene.add(line);
      edges.push({ line, sectorId: sector.id });
    });
  });

  return edges;
}

// --- Update edge opacity on sector activation --------------------------------

/** Light or rest one sector's edges. */
export function setSectorEdgesActive(
  hubEdges: SectorEdge[],
  domainEdges: SectorEdge[],
  sectorId: string,
  active: boolean,
): void {
  const state = active ? "lit" : "rest";
  for (const edge of hubEdges) {
    if (edge.sectorId !== sectorId) continue;
    (edge.line.material as THREE.LineBasicMaterial).opacity =
      EDGE_OPACITY.hub[state];
  }
  for (const edge of domainEdges) {
    if (edge.sectorId !== sectorId) continue;
    (edge.line.material as THREE.LineBasicMaterial).opacity =
      EDGE_OPACITY.domain[state];
  }
}
