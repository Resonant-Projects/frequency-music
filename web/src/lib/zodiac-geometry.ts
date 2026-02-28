// ZODIAC geometry builders — creates all Three.js geometry for the astrolabe disc.
// Coordinate system: SVG angles (BASE=-π/2, clockwise) with Y-flipped to Three.js.
// All radii in world units (same as SVG units, 1:1).

import * as THREE from "three";
import {
  arcMidpoint,
  dotWorldPos,
  PIPELINE_RINGS,
  R,
  SECTORS,
  type SectorDef,
} from "./zodiac-data";
import {
  makeArcMat,
  makeBackgroundDotsMat,
  makeHubMat,
  makeHubRingMat,
  makeHubVioletMat,
  makeOuterRingMat,
  makePipelineRingMat,
  makeSectorFillMat,
  makeSourceMat,
  makeTickMat,
} from "./zodiac-materials";

// --- Helpers -----------------------------------------------------------------

/** Convert polar (SVG convention) to Three.js Vector3.
 *  SVG: angle 0=right, increases clockwise, Y↓.
 *  Three.js: angle 0=right, increases CCW, Y↑.
 *  The Y-flip makes the astrolabe appear identically oriented. */
function polar3(r: number, angle: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(r * Math.cos(angle), -r * Math.sin(angle), z);
}

/** Generate points along a circular arc at radius r, from startAngle to endAngle. */
function arcPoints(
  r: number,
  startAngle: number,
  endAngle: number,
  segments = 64,
  z = 0,
): THREE.Vector3[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = startAngle + (i / segments) * (endAngle - startAngle);
    return polar3(r, a, z);
  });
}

/** Create a Line object along an arc. */
function arcLine(
  r: number,
  startAngle: number,
  endAngle: number,
  mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
  z = 0,
  segments = 64,
): THREE.Line {
  const pts = arcPoints(r, startAngle, endAngle, segments, z);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, mat);
  if (mat instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  return line;
}

/** Create a full circle line. */
function circleLine(
  r: number,
  mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
  z = 0,
): THREE.Line {
  return arcLine(r, 0, Math.PI * 2, mat, z, 128);
}

// --- Sector fills (ring-arc meshes) -----------------------------------------

function createSectorFillGeometry(sector: SectorDef): THREE.BufferGeometry {
  const { startAngle, endAngle } = sector;
  const SEG = 64;
  const verts: THREE.Vector3[] = [];
  const { sectorInner: r1, sectorOuter: r2 } = R;

  // Build a ring-arc using triangle fan/strip
  for (let i = 0; i < SEG; i++) {
    const a0 = startAngle + (i / SEG) * (endAngle - startAngle);
    const a1 = startAngle + ((i + 1) / SEG) * (endAngle - startAngle);
    const p00 = polar3(r1, a0);
    const p01 = polar3(r1, a1);
    const p10 = polar3(r2, a0);
    const p11 = polar3(r2, a1);
    // Two triangles per quad
    verts.push(p00, p10, p01);
    verts.push(p01, p10, p11);
  }

  const geo = new THREE.BufferGeometry().setFromPoints(verts);
  geo.computeVertexNormals();
  return geo;
}

export function buildSectorGroup(
  sector: SectorDef,
  active = false,
): THREE.Group {
  const g = new THREE.Group();

  // Fill mesh (userData.sectorId enables O(1) raycast hit identification)
  const fillGeo = createSectorFillGeometry(sector);
  const fillMat = makeSectorFillMat(sector.color, active);
  const fillMesh = new THREE.Mesh(fillGeo, fillMat);
  fillMesh.userData.sectorId = sector.id;
  g.add(fillMesh);

  // Inner arc (r=175)
  const innerMat = makeArcMat(sector.color, active ? 0.75 : 0.3);
  g.add(arcLine(R.sectorInner, sector.startAngle, sector.endAngle, innerMat));

  // Outer arc (r=265)
  const outerMat = makeArcMat(sector.color, active ? 0.85 : 0.38);
  g.add(arcLine(R.sectorOuter, sector.startAngle, sector.endAngle, outerMat));

  // Radial spoke at start
  const spokePts = [
    polar3(R.sectorInner, sector.startAngle),
    polar3(R.sectorOuter, sector.startAngle),
  ];
  const spokeGeo = new THREE.BufferGeometry().setFromPoints(spokePts);
  const spokeMat = makeArcMat(sector.color, active ? 0.55 : 0.22);
  g.add(new THREE.Line(spokeGeo, spokeMat));

  return g;
}

// --- Source scatter nodes (spheres above disc plane) -------------------------

export function buildSourceNodes(
  scene: THREE.Scene,
): Array<{ mesh: THREE.Mesh; sectorId: string }> {
  const nodes: Array<{ mesh: THREE.Mesh; sectorId: string }> = [];

  SECTORS.forEach((sector) => {
    sector.dots.forEach((dot, di) => {
      const z = 30 + di * 10; // float 30-60 above disc
      const pos = dotWorldPos(sector, dot, z);

      const geo = new THREE.SphereGeometry(3.2, 12, 8);
      const mat = makeSourceMat(sector.color);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { sectorId: sector.id, dotIndex: di, baseZ: z };
      scene.add(mesh);
      nodes.push({ mesh, sectorId: sector.id });
    });
  });

  return nodes;
}

// --- Hub assembly ------------------------------------------------------------

export function buildHub(scene: THREE.Scene): THREE.Mesh {
  // Hub dot (gold emissive sphere)
  const dotGeo = new THREE.SphereGeometry(R.hubDot, 16, 12);
  const dotMat = makeHubMat();
  const hubDot = new THREE.Mesh(dotGeo, dotMat);
  hubDot.position.z = 2; // slightly above disc
  scene.add(hubDot);

  // Hub outer ring (r=36)
  scene.add(circleLine(R.hubOuter, makeHubRingMat(0.88)));

  // Hub violet dashed inner ring (r=22)
  const violetLine = circleLine(R.hubViolet, makeHubVioletMat());
  scene.add(violetLine);

  return hubDot;
}

// --- Pipeline rings (below disc) ---------------------------------------------

export function buildPipelineRings(scene: THREE.Scene): void {
  PIPELINE_RINGS.forEach((ring) => {
    const mat = makePipelineRingMat(ring.color);
    const line = circleLine(ring.r, mat, ring.z);
    scene.add(line);
  });
}

// --- Outer boundary rings ----------------------------------------------------

export function buildOuterRings(scene: THREE.Scene): void {
  // Thin ring r=268
  scene.add(circleLine(R.outerThin, makeOuterRingMat(0.14)));
  // Main ring r=280
  scene.add(circleLine(R.outerMain, makeOuterRingMat(0.28)));
}

// --- Tick marks (degree ring) ------------------------------------------------

export function buildTickMarks(scene: THREE.Scene): void {
  const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
  const majorMat = makeTickMat(true);
  const minorMat = makeTickMat(false);

  TICKS.forEach((deg) => {
    const a = (deg * Math.PI) / 180 - Math.PI / 2;
    const isMajor = deg % 30 === 0;
    const r1 = isMajor ? R.outerThin - 2 : R.outerThin + 1; // 266 or 269
    const r2 = R.outerMain; // 280

    const pts = [polar3(r1, a), polar3(r2, a)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    scene.add(new THREE.Line(geo, isMajor ? majorMat : minorMat));
  });
}

// --- Background scatter point cloud -----------------------------------------

export function buildBackgroundDots(scene: THREE.Scene): void {
  const count = 800;
  const positions = new Float32Array(count * 3);
  const spread = 600;

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.3; // flatter Z distribution
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, makeBackgroundDotsMat());
  scene.add(pts);
}

// --- CSS3D label positions (used by zodiac-scene to place CSS3DObjects) ------

export function getLabelPositions(): Array<{
  sector: SectorDef;
  x: number;
  y: number;
  z: number;
  rotZ: number;
}> {
  return SECTORS.map((sector) => {
    const mid = (sector.startAngle + sector.endAngle) / 2;
    const r = R.arcLabel;
    return {
      sector,
      x: r * Math.cos(mid),
      y: -r * Math.sin(mid),
      z: 5,
      rotZ: -mid + Math.PI / 2, // tangent to arc, Y-flip adjusted
    };
  });
}

// --- Sector midpoint for edge targets ----------------------------------------

export function getSectorMidArc(
  sector: SectorDef,
  r: number,
  z = 0,
): THREE.Vector3 {
  const m = arcMidpoint(r, sector.startAngle, sector.endAngle, z);
  return new THREE.Vector3(m.x, m.y, m.z);
}
