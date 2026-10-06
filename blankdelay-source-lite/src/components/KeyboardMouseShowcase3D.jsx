import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const KEYBOARD_URL = '/apex-3-tkl.webp'
const MOUSE_URL = '/g502.webp'

function ProductArt({ url, width }) {
  const texture = useTexture(url)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const image = texture.image
  const aspect = image.width / image.height
  return (
    <mesh>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.05} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

/** The Apex 3 TKL and G502 art from the Blank Keyboard Macro app. */
export default function KeyboardMouseShowcase3D() {
  const root = useRef(null)

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.desk, 0, 1)
    const suck = THREE.MathUtils.clamp(rig.suck, 0, 1)
    root.current.visible = show > 0.02 && suck < 0.98
    if (!root.current.visible) return
    const enter = THREE.MathUtils.smoothstep(show, 0.02, 1)
    const bob = Math.sin(state.clock.elapsedTime * 0.45) * 0.012 * enter * (1 - suck)
    root.current.position.y = THREE.MathUtils.lerp(-2.6, 0.08, enter) - suck * 3.1 + bob
    root.current.scale.setScalar(0.94 + enter * 0.06)
  })

  return (
    <group ref={root} visible={false}>
      <group position={[-1.28, 0.18, 0]}>
        <ProductArt url={KEYBOARD_URL} width={3.25} />
      </group>
      <group position={[1.22, 0.02, 0.02]}>
        <ProductArt url={MOUSE_URL} width={1.22} />
      </group>
    </group>
  )
}
