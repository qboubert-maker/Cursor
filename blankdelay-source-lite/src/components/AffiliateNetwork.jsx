import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildNetwork() {
  const rand = mulberry32(481516)
  const count = 46
  const nodes = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const radius = 4.6 + Math.pow(rand(), 0.65) * 7.4
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    nodes[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    nodes[i * 3 + 1] = radius * Math.cos(phi) * 0.78
    nodes[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }

  const links = []
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = nodes[i * 3] - nodes[j * 3]
      const dy = nodes[i * 3 + 1] - nodes[j * 3 + 1]
      const dz = nodes[i * 3 + 2] - nodes[j * 3 + 2]
      if (dx * dx + dy * dy + dz * dz < 42) {
        links.push(nodes[i * 3], nodes[i * 3 + 1], nodes[i * 3 + 2], nodes[j * 3], nodes[j * 3 + 1], nodes[j * 3 + 2])
      }
    }
  }

  const nodeGeometry = new THREE.BufferGeometry()
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodes, 3))
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(links, 3))
  return { nodeGeometry, lineGeometry }
}

/** Swirling affiliate graph. Hidden until the camera enters the void. */
export default function AffiliateNetwork() {
  const group = useRef(null)
  const nodes = useRef(null)
  const lines = useRef(null)
  const { nodeGeometry, lineGeometry } = useMemo(() => buildNetwork(), [])

  useFrame((state, delta) => {
    const amount = THREE.MathUtils.clamp(rig.network * (1 - rig.social), 0, 1)
    const visible = amount > 0.012
    group.current.visible = visible
    if (!visible) return
    const t = state.clock.elapsedTime
    group.current.rotation.y += delta * (0.12 + amount * 0.28)
    group.current.rotation.x = Math.sin(t * 0.17) * 0.12
    group.current.rotation.z = Math.cos(t * 0.11) * 0.06
    nodes.current.material.opacity = amount
    lines.current.material.opacity = amount * 0.55
    nodes.current.material.size = 6.5 + Math.sin(t * 1.4) * 1.4
  })

  return (
    <group ref={group} visible={false}>
      <lineSegments ref={lines} geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </lineSegments>
      <points ref={nodes} geometry={nodeGeometry} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={7} transparent opacity={0} depthWrite={false} toneMapped={false} sizeAttenuation={false} />
      </points>
    </group>
  )
}
