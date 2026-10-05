import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import '../lib/localDraco'
import { padKey, padLeft, padRight, padRim } from '../lib/padLights'
import { rig } from '../lib/rig'

const PS5_URL = '/ps5.glb'
const XBOX_URL = '/xbox.glb'

function fit(clone, size) {
  const box = new THREE.Box3().setFromObject(clone)
  const dims = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const max = Math.max(dims.x, dims.y, dims.z) || 1
  const scale = size / max
  clone.scale.setScalar(scale)
  clone.position.copy(center).multiplyScalar(-scale)
}

const whitenedImages = new WeakMap()

function whitenDualSense(texture) {
  const image = texture.image
  const cached = whitenedImages.get(image)
  if (cached) return cached
  const maxEdge = 768
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = frame.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const blue = b > r + 24 && b > g + 8 && b > 60
    const warm = !blue && lum > 36 && r - b > 4 && r > 55 && g > 40
    if (!warm) continue
    const shade = 0.92 + 0.08 * (lum / 255)
    const white = Math.min(255, Math.round(255 * shade))
    data[i] = white
    data[i + 1] = white
    data[i + 2] = white
  }
  ctx.putImageData(frame, 0, 0)
  const next = new THREE.CanvasTexture(canvas)
  next.colorSpace = THREE.SRGBColorSpace
  next.anisotropy = 4
  next.flipY = texture.flipY
  next.wrapS = texture.wrapS
  next.wrapT = texture.wrapT
  next.needsUpdate = true
  whitenedImages.set(image, next)
  return next
}

function stylePs5(scene, size) {
  const clone = scene.clone(true)
  fit(clone, size)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = false
    node.receiveShadow = false
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source.clone()
    if (material.map) material.map = whitenDualSense(material.map)
    material.color = new THREE.Color('#ffffff')
    material.roughness = 0.38
    material.metalness = 0.04
    material.envMapIntensity = 1.35
    if ('clearcoat' in material) {
      material.clearcoat = 0.45
      material.clearcoatRoughness = 0.18
    }
    material.needsUpdate = true
    node.material = material
  })
  return clone
}

const XBOX_FINISH = {
  'Mesh_body-top-case': ['#070707', 0.28, 0.72, 0],
  'Mesh_grips-back': ['#101010', 0.86, 0.02, 0],
  'Mesh_grips-front': ['#121212', 0.82, 0.04, 0],
  'Mesh_internal-components': ['#050505', 0.5, 0.2, 0],
  'Mesh_triggers': ['#161616', 0.32, 0.45, 0],
  'Mesh_bumpers-trans': ['#1c1c1c', 0.22, 0.15, 0],
  'Mesh_back-case-trans': ['#080808', 0.3, 0.4, 0],
  'Mesh_back-switches': ['#2a2a2a', 0.35, 0.5, 0],
  'Mesh_thumbstick-bases': ['#0c0c0c', 0.4, 0.35, 0],
  'Mesh_thumbstick-domes': ['#141414', 0.45, 0.2, 0],
  'Mesh_thumbstick-rings': ['#d0d0d0', 0.3, 0.65, 0.15],
  'Mesh_thumbstick-toppers': ['#1a1a1a', 0.72, 0.05, 0],
  'Mesh_d-pad-faceted': ['#e8e8e8', 0.34, 0.25, 0.05],
  'Mesh_d-pad-cross': ['#f4f4f4', 0.3, 0.2, 0.08],
  'Mesh_d-pad-decals-alphad': ['#111111', 0.4, 0.1, 0],
  'Mesh_abxy-buttons-exterior-trans': ['#0a0a0a', 0.3, 0.4, 0],
  'Mesh_abxy-buttons-trans': ['#f2f2f2', 0.28, 0.12, 0.12],
  'Mesh_view-menu-share-buttons': ['#efefef', 0.32, 0.2, 0.2],
  'Mesh_interposer-buttons': ['#dedede', 0.3, 0.25, 0.08],
  'Mesh_back-logo-decals': ['#ffffff', 0.22, 0.15, 0.85],
  'Mesh_lights-trans': ['#ffffff', 0.2, 0.05, 1.4],
  'Mesh_combined-noncustom': ['#0e0e0e', 0.4, 0.3, 0],
}

function styleXbox(scene, size) {
  const clone = scene.clone(true)
  fit(clone, size)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = false
    node.receiveShadow = false
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source ? source.clone() : new THREE.MeshStandardMaterial()
    const finish = XBOX_FINISH[node.name] || ['#0b0b0b', 0.4, 0.25, 0]
    material.color = new THREE.Color(finish[0])
    material.roughness = finish[1]
    material.metalness = finish[2]
    material.emissive = new THREE.Color(finish[3] > 0 ? finish[0] : '#000000')
    material.emissiveIntensity = finish[3]
    material.envMapIntensity = finish[3] > 0 ? 0.4 : 1.1
    material.needsUpdate = true
    node.material = material
  })
  return clone
}

function PhysicalController({ url, size, tone }) {
  const gltf = useGLTF(url, '/draco/', false)
  const model = useMemo(
    () => (tone === 'white' ? stylePs5(gltf.scene, size) : styleXbox(gltf.scene, size)),
    [gltf.scene, size, tone],
  )
  return <primitive object={model} />
}

/** Real PS5 DualSense and Xbox Elite pads, posed by the scroll rig. */
export default function ControllerShowcase3D() {
  const root = useRef(null)
  const ps5 = useRef(null)
  const xbox = useRef(null)

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.controllers, 0, 1)
    const cleared = rig.padLift > 0.9 || rig.desk > 0.02
    const lit = show > 0.02 && !cleared
    root.current.visible = lit
    padKey.intensity = lit ? 48 * show : 0
    padRim.intensity = lit ? 22 * show : 0
    padLeft.intensity = lit ? 14 : 0
    padRight.intensity = lit ? 10 : 0
    if (!lit) return
    const rise = THREE.MathUtils.smoothstep(show, 0, 1)
    const y = THREE.MathUtils.lerp(-3.4, 0.05, rise) + rig.padLift * 8
    const bob = Math.sin(state.clock.elapsedTime * 0.7) * 0.04 * rise
    const spread = rig.padSpread
    ps5.current.position.set(-0.05 - spread * 2.2, y + bob, 0)
    xbox.current.position.set(0.05 + spread * 2.2, y + bob * 0.8, 0)
    ps5.current.rotation.set(-0.35, rig.padSpin + 0.15, 0)
    xbox.current.rotation.set(-0.35, -rig.padSpin - 0.15, 0)
  })

  return (
    <group ref={root} name="controller-pads" visible={false}>
      <group ref={ps5}>
        <PhysicalController url={PS5_URL} size={2.4} tone="white" />
      </group>
      <group ref={xbox}>
        <PhysicalController url={XBOX_URL} size={2.4} tone="black" />
      </group>
    </group>
  )
}

useGLTF.preload(PS5_URL, '/draco/', false)
useGLTF.preload(XBOX_URL, '/draco/', false)
