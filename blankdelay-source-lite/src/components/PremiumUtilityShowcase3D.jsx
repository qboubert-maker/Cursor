import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const NVIDIA_URL = '/nvidia.webp'
const RADEON_URL = '/radeon.webp'
const PARTICLE_COUNT = 1400
const CARD_HEIGHT = 1.22

function CardArt({ url }) {
  const texture = useTexture(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const aspect = texture.image.width / texture.image.height
  const width = CARD_HEIGHT * aspect
  return (
    <group>
      <mesh position={[0, -CARD_HEIGHT * 0.58, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[width * 0.42, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[0, -CARD_HEIGHT * 0.02, -0.03]} scale={[1, -0.28, 1]}>
        <planeGeometry args={[width, CARD_HEIGHT]} />
        <meshBasicMaterial map={texture} transparent opacity={0.16} alphaTest={0.05} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, CARD_HEIGHT]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  )
}

function DissolveField() {
  const points = useRef(null)
  const seeds = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const dir = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 0.15 + Math.random() * 3.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * radius * 0.35
      pos[i * 3 + 1] = Math.cos(phi) * radius * 0.35
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius * 0.35
      dir[i * 3] = Math.sin(phi) * Math.cos(theta)
      dir[i * 3 + 1] = Math.cos(phi)
      dir[i * 3 + 2] = Math.sin(phi) * Math.sin(theta)
    }
    return { pos, dir }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(seeds.pos.slice(), 3))
    return geo
  }, [seeds])

  useFrame(() => {
    const burst = THREE.MathUtils.clamp(rig.flash * 0.85 + (1 - rig.gpuIn) * rig.utility * 0.35, 0, 1)
    points.current.visible = burst > 0.04
    if (!points.current.visible) return
    const attr = points.current.geometry.attributes.position
    const arr = attr.array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const o = i * 3
      const spread = 0.2 + burst * 4.2
      arr[o] = seeds.pos[o] + seeds.dir[o] * spread
      arr[o + 1] = seeds.pos[o + 1] + seeds.dir[o + 1] * spread
      arr[o + 2] = seeds.pos[o + 2] + seeds.dir[o + 2] * spread
    }
    attr.needsUpdate = true
    points.current.material.opacity = burst * 0.85
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={2.4} transparent opacity={0} depthWrite={false} toneMapped={false} sizeAttenuation={false} />
    </points>
  )
}

/** RTX 5090 Founders Edition and Radeon RX 9070 XT, locked face-on so the model names read. */
export default function PremiumUtilityShowcase3D() {
  const root = useRef(null)
  const nvidia = useRef(null)
  const radeon = useRef(null)
  const rimA = useRef(null)
  const rimB = useRef(null)

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.utility, 0, 1)
    root.current.visible = show > 0.02
    if (!root.current.visible) return

    const t = state.clock.elapsedTime
    const enter = THREE.MathUtils.smoothstep(rig.gpuIn, 0.02, 1)
    const lock = THREE.MathUtils.smoothstep(rig.gpuLock, 0, 1)
    const pose = THREE.MathUtils.smoothstep(lock, 0.05, 0.62)
    const bob = Math.sin(t * 0.7) * 0.035 * enter

    const rush = rig.gpuExit * rig.gpuExit
    const nx = THREE.MathUtils.lerp(-0.15, -1.72, pose)
    const rx = THREE.MathUtils.lerp(0.15, 1.82, pose)
    const ny = THREE.MathUtils.lerp(-1.6, 0.55, enter) + bob
    const ry = THREE.MathUtils.lerp(-1.6, 0.55, enter) - bob

    nvidia.current.position.set(
      THREE.MathUtils.lerp(nx, -7.2, rush),
      THREE.MathUtils.lerp(ny, 1.6, rush),
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.15, 0, pose), 18, rush),
    )
    radeon.current.position.set(
      THREE.MathUtils.lerp(rx, 7.4, rush),
      THREE.MathUtils.lerp(ry, -0.4, rush),
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.1, 0, pose), 16, rush),
    )

    nvidia.current.rotation.set(
      THREE.MathUtils.lerp(0.35, 0, pose),
      THREE.MathUtils.lerp(0.42, 0, pose) + rush * 0.35,
      THREE.MathUtils.lerp(-0.08, 0, pose) - rush * 0.5,
    )
    radeon.current.rotation.set(
      THREE.MathUtils.lerp(-0.28, 0, pose),
      THREE.MathUtils.lerp(-0.55, 0, pose) - rush * 0.4,
      THREE.MathUtils.lerp(0.06, 0, pose) + rush * 0.45,
    )

    const scale = (0.74 + enter * 0.12) * (1 + rush * 2.6)
    nvidia.current.scale.setScalar(scale)
    radeon.current.scale.setScalar(scale)

    const sweep = Math.sin(t * 0.45) * 4.5
    rimA.current.position.x = -5.5 + sweep
    rimB.current.position.x = 5.5 - sweep
    rimA.current.intensity = show * (16 + rig.gpuMacro * 14)
    rimB.current.intensity = show * (12 + rig.gpuMacro * 10)
  })

  return (
    <group ref={root} visible={false}>
      <spotLight ref={rimA} position={[-5.5, 2.4, 2]} angle={0.55} penumbra={0.7} intensity={0} color="#ffffff" distance={18} decay={2} />
      <spotLight ref={rimB} position={[5.5, 1.2, 1.5]} angle={0.6} penumbra={0.75} intensity={0} color="#ffffff" distance={18} decay={2} />
      <DissolveField />
      <group ref={nvidia}>
        <CardArt url={NVIDIA_URL} />
      </group>
      <group ref={radeon}>
        <CardArt url={RADEON_URL} />
      </group>
    </group>
  )
}
