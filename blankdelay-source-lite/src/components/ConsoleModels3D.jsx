import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Real-world sizes in decimetres. PS5 Disc Edition 390 x 104 x 260 mm, Series X 151 x 301 x 151 mm.
export const PS5_SIZE = { height: 3.9, depth: 2.6, core: 0.64, coreHeight: 3.62, coreDepth: 2.42, fin: 0.045 }
export const XBOX_SIZE = { width: 1.51, height: 3.01, depth: 1.51, radius: 0.085 }
// Panel outline: corner radii seen from the side, and how the skin turns onto the front.
const PANEL = { frontCorner: 0.5, backCorner: 0.28, wrap: 0.13, lip: 0.1, gap: 0.006 }

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function cornerCut(y, half, radius) {
  const over = Math.max(y - (half - radius), -half + radius - y, 0)
  return over > 0 ? radius - Math.sqrt(Math.max(0, radius * radius - over * over)) : 0
}

/**
 * One PS5 side panel. A thin box is swept along the panel's cross-section: down the
 * side, round the front corner and back over the core's front edge, so only a narrow
 * black strip shows between the two panels. The side flares out towards the top and
 * bows outwards; `bulge` adds the disc drive dome.
 */
function panelGeometry(side, bulge) {
  const { height, depth, core, fin } = PS5_SIZE
  const { frontCorner, backCorner, wrap, lip, gap } = PANEL
  const geometry = new THREE.BoxGeometry(fin, height, 1, 1, 150, 120)
  const pos = geometry.attributes.position
  const half = height / 2
  const shell = core / 2 + gap + fin
  const arc = (Math.PI / 2) * wrap
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const yN = y / half
    // 0 on the outer skin, -fin on the inner face.
    const inset = pos.getX(i) * side - fin / 2
    const front = depth / 2 - cornerCut(y, half, frontCorner)
    const back = -depth / 2 + cornerCut(y, half, backCorner)
    const length = Math.max(0.01, front - wrap - back)
    const d = (pos.getZ(i) + 0.5) * (length + arc + lip)
    let o
    let z
    let no = 1
    let nz = 0
    let along = 1
    if (d <= length) {
      along = d / length
      o = shell
      z = back + d
    } else if (d <= length + arc) {
      const a = (d - length) / wrap
      no = Math.cos(a)
      nz = Math.sin(a)
      o = shell - wrap + wrap * no
      z = front - wrap + wrap * nz
    } else {
      no = 0
      nz = 1
      o = shell - wrap - (d - length - arc)
      z = front
    }
    let out = 0.1 * smoothstep(0.1, 1, yN) ** 1.5 + 0.022 * smoothstep(-0.6, -1, yN) + 0.14 * along * (1 - along)
    if (bulge) {
      const du = (along - 0.7) / 0.21
      const dv = (yN + 0.6) / 0.29
      const d2 = du * du + dv * dv
      if (d2 < 1) out += 0.055 * (1 - d2) ** 2
    }
    pos.setXYZ(i, side * (o + out + inset * no), y, z + inset * nz)
  }
  geometry.computeVertexNormals()
  return geometry
}

function markShape(width) {
  const k = width / 346
  const shape = new THREE.Shape()
  shape.moveTo((143 - 173) * k, 0)
  shape.lineTo((346 - 173) * k, 108 * k)
  shape.lineTo((346 - 173) * k, -108 * k)
  shape.closePath()
  const dot = new THREE.Shape()
  dot.absarc((70 - 173) * k, 0, 70 * k, 0, Math.PI * 2, false)
  return [shape, dot]
}

export function useConsoleMaterials(art) {
  return useMemo(() => {
    const skin = (map) =>
      new THREE.MeshPhysicalMaterial({ map, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.28 })
    return {
      ps5Left: skin(art.skins.ps5Left),
      ps5Right: skin(art.skins.ps5Right),
      xboxFront: skin(art.skins.xboxFront),
      xboxSide: skin(art.skins.xboxSide),
      white: new THREE.MeshPhysicalMaterial({ color: '#f1f1ef', roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
      gloss: new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
      matte: new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.62 }),
      trim: new THREE.MeshStandardMaterial({ color: '#232323', roughness: 0.45 }),
      hole: new THREE.MeshBasicMaterial({ color: '#030303' }),
      vent: new THREE.MeshStandardMaterial({ map: art.vent, bumpMap: art.vent, bumpScale: 6, roughness: 0.55, metalness: 0.1 }),
      glow: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true }),
    }
  }, [art])
}

export function PS5Console({ materials, ...props }) {
  const { height, depth, core, coreHeight, coreDepth } = PS5_SIZE
  const geometry = useMemo(
    () => ({
      left: panelGeometry(-1, true),
      right: panelGeometry(1, false),
      core: new RoundedBoxGeometry(core, coreHeight, coreDepth, 4, 0.08),
      stand: new THREE.CylinderGeometry(0.62, 0.66, 0.07, 64),
    }),
    [core, coreHeight, coreDepth],
  )
  const m = materials
  const face = coreDepth / 2 + 0.004
  // Panel groups follow BoxGeometry: +x, -x, +y, -y, +z, -z.
  const left = [m.white, m.ps5Left, m.white, m.white, m.white, m.white]
  const right = [m.ps5Right, m.white, m.white, m.white, m.white, m.white]
  return (
    <group {...props}>
      <mesh geometry={geometry.left} material={left} />
      <mesh geometry={geometry.right} material={right} />
      <mesh geometry={geometry.core} material={m.gloss} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.124, 0.18, face]} material={m.glow}>
          <boxGeometry args={[0.014, 2.9, 0.004]} />
        </mesh>
      ))}
      <mesh position={[0.07, -0.78, face]} material={m.hole}>
        <boxGeometry args={[0.02, 1.18, 0.004]} />
      </mesh>
      <mesh position={[-0.035, -1.47, face]} material={m.trim}>
        <boxGeometry args={[0.12, 0.06, 0.004]} />
      </mesh>
      <mesh position={[-0.035, -1.47, face + 0.002]} material={m.hole}>
        <boxGeometry args={[0.1, 0.04, 0.004]} />
      </mesh>
      <mesh position={[0.07, -1.47, face]} material={m.hole}>
        <boxGeometry args={[0.06, 0.028, 0.004]} />
      </mesh>
      <mesh position={[0, -1.24, face]} material={m.trim}>
        <boxGeometry args={[0.15, 0.018, 0.004]} />
      </mesh>
      <mesh geometry={geometry.stand} material={m.matte} position={[0, -height / 2 - 0.035, -depth * 0.04]} />
    </group>
  )
}

export function XboxSeriesX({ materials, ...props }) {
  const { width, height, depth, radius } = XBOX_SIZE
  const geometry = useMemo(
    () => ({
      body: new RoundedBoxGeometry(width, height, depth, 5, radius),
      mark: new THREE.ShapeGeometry(markShape(0.09), 12),
      button: new THREE.CylinderGeometry(0.082, 0.082, 0.012, 48),
      dot: new THREE.CylinderGeometry(0.03, 0.03, 0.01, 32),
      foot: new THREE.CylinderGeometry(0.56, 0.58, 0.05, 64),
    }),
    [width, height, depth, radius],
  )
  const m = materials
  const face = depth / 2 + 0.003
  const column = -width / 2 + 0.22
  const top = height / 2
  const body = [m.xboxSide, m.xboxSide, m.vent, m.matte, m.xboxFront, m.xboxSide]
  return (
    <group {...props}>
      <mesh geometry={geometry.body} material={body} />
      <mesh geometry={geometry.button} material={m.gloss} position={[column, top - 0.24, face]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geometry.mark} material={m.glow} position={[column, top - 0.24, face + 0.008]} />
      <mesh position={[column, top - 0.5, face]} material={m.trim}>
        <boxGeometry args={[0.06, 0.035, 0.004]} />
      </mesh>
      <mesh position={[column, top - 1.27, face]} material={m.hole}>
        <boxGeometry args={[0.022, 1.3, 0.004]} />
      </mesh>
      <mesh geometry={geometry.dot} material={m.trim} position={[column, -top + 0.45, face]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh position={[column, -top + 0.24, face]} material={m.trim}>
        <boxGeometry args={[0.062, 0.14, 0.004]} />
      </mesh>
      <mesh position={[column, -top + 0.24, face + 0.002]} material={m.hole}>
        <boxGeometry args={[0.04, 0.115, 0.004]} />
      </mesh>
      <mesh geometry={geometry.foot} material={m.matte} position={[0, -top - 0.025, 0]} />
    </group>
  )
}
