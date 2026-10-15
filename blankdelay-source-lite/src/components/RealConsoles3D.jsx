import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const WHITE = { color: '#f3f2ef', roughness: 0.42, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.4 }
const GLOSS = { color: '#070708', roughness: 0.16, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }
const MATTE = { color: '#121212', roughness: 0.78, metalness: 0.04 }

function ps5Profile() {
  const top = 1.95
  const bot = -1.95
  const front = 1.3
  const back = -1.3
  const shape = new THREE.Shape()
  shape.moveTo(back + 0.28, bot)
  shape.lineTo(front - 0.85, bot)
  shape.quadraticCurveTo(front + 0.02, bot + 0.02, front - 0.08, bot + 0.62)
  shape.lineTo(front - 0.22, top - 0.95)
  shape.quadraticCurveTo(front + 0.04, top + 0.02, front - 0.78, top)
  shape.lineTo(back + 0.55, top)
  shape.quadraticCurveTo(back - 0.02, top, back + 0.06, top - 0.5)
  shape.lineTo(back + 0.02, bot + 0.42)
  shape.quadraticCurveTo(back - 0.02, bot, back + 0.28, bot)
  return shape
}

function shellGeometry(bulge) {
  const geometry = new THREE.ExtrudeGeometry(ps5Profile(), {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.016,
    bevelSegments: 2,
    curveSegments: 20,
  })
  geometry.rotateY(Math.PI / 2)
  geometry.translate(0.055, 0, 0)
  if (bulge) {
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const dy = (y + 0.35) / 0.72
      const dz = (z - 0.15) / 0.58
      const d2 = dy * dy + dz * dz
      if (d2 < 1 && x > 0.04) pos.setX(i, x + 0.085 * (1 - d2) * (1 - d2))
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function ventTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1c1c1c'
  ctx.fillRect(0, 0, 512, 512)
  ctx.fillStyle = '#070707'
  const cx = 256
  const cy = 256
  for (let row = -20; row <= 20; row++) {
    for (let col = -20; col <= 20; col++) {
      const x = cx + col * 13 + (row & 1 ? 6.5 : 0)
      const y = cy + row * 11.2
      if ((x - cx) ** 2 + (y - cy) ** 2 > 228 ** 2) continue
      ctx.beginPath()
      ctx.arc(x, y, 2.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.strokeStyle = '#b5b5b5'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(cx, cy, 214, 0, Math.PI * 2)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function RealPS5() {
  const geometry = useMemo(
    () => ({
      disc: shellGeometry(true),
      plain: shellGeometry(false),
      core: new RoundedBoxGeometry(0.34, 3.55, 2.15, 3, 0.04),
    }),
    [],
  )
  return (
    <group>
      <mesh geometry={geometry.disc} position={[-0.24, 0, 0]}>
        <meshPhysicalMaterial {...WHITE} />
      </mesh>
      <mesh geometry={geometry.plain} position={[0.24, 0, 0]} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial {...WHITE} />
      </mesh>
      <mesh geometry={geometry.core}>
        <meshPhysicalMaterial {...GLOSS} />
      </mesh>
      <mesh position={[0, -0.55, 1.1]}>
        <boxGeometry args={[0.22, 0.016, 0.014]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.05, -1.35, 1.09]}>
        <boxGeometry args={[0.09, 0.035, 0.012]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.04, -1.48, 1.09]}>
        <boxGeometry args={[0.07, 0.045, 0.012]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, -2.02, -0.12]} scale={[1.2, 1, 0.72]}>
        <cylinderGeometry args={[0.52, 0.58, 0.07, 48]} />
        <meshStandardMaterial color="#161616" roughness={0.6} />
      </mesh>
    </group>
  )
}

export function RealXbox() {
  const vent = useMemo(() => ventTexture(), [])
  const body = useMemo(() => new RoundedBoxGeometry(1.51, 3.01, 1.51, 4, 0.045), [])
  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial {...MATTE} />
      </mesh>
      <mesh position={[0, 1.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 64]} />
        <meshStandardMaterial map={vent} roughness={0.85} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.54, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.028, 12, 64]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.05, 0.77]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.02, 32]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, 0.782]}>
        <circleGeometry args={[0.028, 24]} />
        <meshBasicMaterial color="#f2f2f2" />
      </mesh>
      <mesh position={[0, -0.15, 0.77]}>
        <boxGeometry args={[0.72, 0.012, 0.008]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      <mesh position={[0.42, -1.15, 0.77]}>
        <boxGeometry args={[0.11, 0.04, 0.01]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
    </group>
  )
}
