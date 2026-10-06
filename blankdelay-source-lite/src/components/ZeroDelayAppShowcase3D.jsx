import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const PC_URL = '/zero-pc.glb'
const MARK_URL = '/zero-mark.png'

function fit(clone, size) {
  const box = new THREE.Box3().setFromObject(clone)
  const dims = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const max = Math.max(dims.x, dims.y, dims.z) || 1
  const scale = size / max
  clone.scale.setScalar(scale)
  clone.position.copy(center).multiplyScalar(-scale)
}

function invertAlbedo(texture) {
  const image = texture.image
  const maxEdge = 1024
  const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.width || 1) * scale))
  canvas.height = Math.max(1, Math.round((image.height || 1) * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = frame.data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }
  ctx.putImageData(frame, 0, 0)
  const next = new THREE.CanvasTexture(canvas)
  next.colorSpace = THREE.SRGBColorSpace
  next.anisotropy = 4
  next.flipY = texture.flipY
  next.wrapS = texture.wrapS
  next.wrapT = texture.wrapT
  next.needsUpdate = true
  return next
}

function styleTower(scene, size, tone) {
  const clone = scene.clone(true)
  fit(clone, size)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = true
    node.receiveShadow = true
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source.clone()
    if (tone === 'white' && material.map) material.map = invertAlbedo(material.map)
    material.roughness = tone === 'white' ? 0.58 : 0.42
    material.metalness = tone === 'white' ? 0.06 : 0.28
    material.envMapIntensity = tone === 'white' ? 0.7 : 1.15
    if ('clearcoat' in material) {
      material.clearcoat = 0.65
      material.clearcoatRoughness = 0.16
    }
    material.needsUpdate = true
    node.material = material
  })
  return clone
}

function Tower({ tone }) {
  const gltf = useGLTF(PC_URL, false, false)
  const model = useMemo(() => styleTower(gltf.scene, 2.15, tone), [gltf.scene, tone])
  return <primitive object={model} />
}

function wordTexture(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 250px "Arial Black", Impact, sans-serif'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function CaseWord({ text, color }) {
  const texture = useMemo(() => wordTexture(text, color), [text, color])
  return (
    <mesh>
      <planeGeometry args={[1.15, 0.32]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function Mark() {
  const texture = useTexture(MARK_URL)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const aspect = texture.image.width / texture.image.height
  const width = 1.15
  return (
    <mesh>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

/** Real splatter-case models, black and white, with the Zero Delay mark between them. */
export default function ZeroDelayAppShowcase3D() {
  const root = useRef(null)
  const black = useRef(null)
  const white = useRef(null)
  const mark = useRef(null)

  useFrame((state) => {
    const reveal = THREE.MathUtils.smoothstep(rig.kernel, 0.02, 1)
    const open = THREE.MathUtils.smoothstep(rig.kernelOpen, 0.05, 1)
    root.current.visible = rig.kernel > 0.02
    if (!root.current.visible) return
    const t = state.clock.elapsedTime
    const bob = Math.sin(t * 0.45) * 0.02 * reveal
    const rise = THREE.MathUtils.lerp(-3.6, 0.02, reveal)
    const spread = THREE.MathUtils.lerp(0.35, 1, open)
    black.current.position.set(-2.45 * spread, rise + bob, 0)
    white.current.position.set(2.45 * spread, rise + Math.sin(t * 0.45 + 1) * 0.02 * reveal, 0)
    black.current.rotation.set(-0.04, 0.38 + open * 0.06, 0)
    white.current.rotation.set(-0.04, -0.38 - open * 0.06, 0)
    black.current.scale.setScalar(0.86 + reveal * 0.14)
    white.current.scale.setScalar(0.86 + reveal * 0.14)
    mark.current.position.y = THREE.MathUtils.lerp(2.7, 1.05, open) + bob
    mark.current.scale.setScalar(0.45 + open * 0.4)
    mark.current.visible = open > 0.12
  })

  return (
    <group ref={root} visible={false}>
      <spotLight position={[-2.4, 2.8, 3.4]} angle={0.5} penumbra={0.6} intensity={22} color="#ffffff" distance={14} decay={2} />
      <spotLight position={[2.6, 2.6, 3.2]} angle={0.5} penumbra={0.65} intensity={12} color="#ffffff" distance={14} decay={2} />
      <group ref={black}>
        <Tower tone="black" />
        <group position={[0.18, 0.12, 1.05]}>
          <CaseWord text="BLANK" color="#111111" />
        </group>
      </group>
      <group ref={white}>
        <Tower tone="white" />
        <group position={[-0.05, 0.12, 1.05]}>
          <CaseWord text="DELAY" color="#ffffff" />
        </group>
      </group>
      <group ref={mark} position={[0, 1.05, 1.15]}>
        <Mark />
      </group>
    </group>
  )
}
