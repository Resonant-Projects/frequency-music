// ZODIAC edge/connection builders — hub→domain and domain→source bezier curves.

import * as THREE from 'three'
import { SECTORS, R, dotWorldPos, type SectorDef } from './zodiac-data'
import { makeHubEdgeMat, makeDomainEdgeMat } from './zodiac-materials'
import { getSectorMidArc } from './zodiac-geometry'

// --- Hub → Domain edges (straight lines from origin to sector inner midpoint) ---

export function buildHubEdges(scene: THREE.Scene): Array<{ line: THREE.Line; sectorId: string }> {
  const edges: Array<{ line: THREE.Line; sectorId: string }> = []

  SECTORS.forEach((sector) => {
    const target = getSectorMidArc(sector, R.sectorInner)
    const pts = [new THREE.Vector3(0, 0, 0), target]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = makeHubEdgeMat(sector.color)
    const line = new THREE.Line(geo, mat)
    scene.add(line)
    edges.push({ line, sectorId: sector.id })
  })

  return edges
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
  )
  const curve = new THREE.QuadraticBezierCurve3(start, control, end)
  const pts = curve.getPoints(segments)
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  return new THREE.Line(geo, mat)
}

export function buildDomainEdges(scene: THREE.Scene): Array<{ line: THREE.Line; sectorId: string }> {
  const edges: Array<{ line: THREE.Line; sectorId: string }> = []

  SECTORS.forEach((sector) => {
    const origin = getSectorMidArc(sector, 200)  // slightly inside sector
    const mat = makeDomainEdgeMat(sector.color)   // one material per sector

    sector.dots.forEach((dot, di) => {
      const pos = dotWorldPos(sector, dot, 30 + di * 10)
      const end = new THREE.Vector3(pos.x, pos.y, pos.z)
      const line = buildBezierEdge(origin, end, 80, mat)
      scene.add(line)
      edges.push({ line, sectorId: sector.id })
    })
  })

  return edges
}

// --- Update edge opacity on sector activation --------------------------------

export function setEdgeActivity(
  hubEdges: Array<{ line: THREE.Line; sectorId: string }>,
  domainEdges: Array<{ line: THREE.Line; sectorId: string }>,
  activeSectorId: string | null,
): void {
  hubEdges.forEach(({ line, sectorId }) => {
    const mat = line.material as THREE.LineBasicMaterial
    mat.opacity = activeSectorId === sectorId ? 0.65 : 0.18
  })
  domainEdges.forEach(({ line, sectorId }) => {
    const mat = line.material as THREE.LineBasicMaterial
    mat.opacity = activeSectorId === sectorId ? 0.55 : 0.14
  })
}
