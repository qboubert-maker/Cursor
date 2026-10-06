import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const RYZEN_URL = '/ryzen9.webp'
const INTEL_URL = '/i9.webp'

function Chip({ url, width }) {
  const texture = useTexture(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const aspect = texture.image.width / texture.image.height
  return (
    <mesh>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.05} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

/** Real Ryzen 9 9950X and Core i9-14900K, locked side by side. */
export default function FPSBoostShowcase3D() {
  const root = useRef(null)
  const ryzen = useRef(null)
  const intel = useRef(null)

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.fps, 0, 1)
    root.current.visible = show > 0.02
    if (!root.current.visible) return
    const p = THREE.MathUtils.clamp(rig.fpsCount, 0, 1)
    const present = THREE.MathUtils.smoothstep(show, 0.45, 1)
    const flip = THREE.MathUtils.smoothstep(p, 0.08, 0.62)
    const spread = THREE.MathUtils.smoothstep(p, 0.28, 0.86)
    const bob = Math.sin(state.clock.elapsedTime * 0.7) * 0.02 * spread * present
    root.current.position.y = THREE.MathUtils.lerp(-3.4, 0, present)
    root.current.scale.setScalar(0.94 + present * 0.06)

    ryzen.current.position.set(
      THREE.MathUtils.lerp(-0.05, -1.55, spread),
      THREE.MathUtils.lerp(-1.15, 0.22, THREE.MathUtils.smoothstep(p, 0, 0.55)) + bob,
      THREE.MathUtils.lerp(0.9, 0, spread),
    )
    ryzen.current.rotation.set(
      THREE.MathUtils.lerp(1.25, -0.06, flip),
      THREE.MathUtils.lerp(0.85, 0.08, spread),
      THREE.MathUtils.lerp(-0.35, 0, flip),
    )

    intel.current.position.set(
      THREE.MathUtils.lerp(0.08, 1.55, spread),
      THREE.MathUtils.lerp(1.45, 0.22, THREE.MathUtils.smoothstep(p, 0.12, 0.68)) - bob,
      THREE.MathUtils.lerp(-0.55, 0, spread),
    )
    intel.current.rotation.set(
      THREE.MathUtils.lerp(-1.15, -0.06, flip),
      THREE.MathUtils.lerp(-0.95, 0.08, spread),
      THREE.MathUtils.lerp(0.5, 0, flip),
    )
  })

  return (
    <group ref={root} visible={false}>
      <group ref={ryzen}>
        <Chip url={RYZEN_URL} width={2.05} />
      </group>
      <group ref={intel}>
        <Chip url={INTEL_URL} width={2.05} />
      </group>
    </group>
  )
}
