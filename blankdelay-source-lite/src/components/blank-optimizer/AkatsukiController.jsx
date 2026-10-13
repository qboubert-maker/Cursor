import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { styleXbox } from '../ControllerShowcase3D.jsx'
import '../../lib/localDraco'

const PS5_URL = `${import.meta.env.BASE_URL}ps5.glb`
const XBOX_URL = `${import.meta.env.BASE_URL}xbox.glb`
const DRACO_URL = `${import.meta.env.BASE_URL}draco/`
const LOGO = `${import.meta.env.BASE_URL}Blank Delay Logo.png`

const XBOX_THEME = {
  'Mesh_body-top-case': ['#14080c', 0.32, 0.55, 0],
  'Mesh_grips-back': ['#0c0608', 0.86, 0.02, 0],
  'Mesh_grips-front': ['#12080c', 0.82, 0.04, 0],
  'Mesh_internal-components': ['#050505', 0.5, 0.2, 0],
  'Mesh_triggers': ['#1a0a0e', 0.32, 0.4, 0],
  'Mesh_bumpers-trans': ['#1c0c10', 0.22, 0.15, 0],
  'Mesh_back-case-trans': ['#080406', 0.3, 0.4, 0],
  'Mesh_back-switches': ['#2a1218', 0.35, 0.45, 0],
  'Mesh_thumbstick-bases': ['#0c0608', 0.4, 0.35, 0],
  'Mesh_thumbstick-domes': ['#14080c', 0.45, 0.2, 0],
  'Mesh_thumbstick-rings': ['#e23b52', 0.32, 0.45, 0.4],
  'Mesh_thumbstick-toppers': ['#1a0c10', 0.72, 0.05, 0],
  'Mesh_d-pad-faceted': ['#c8102e', 0.34, 0.28, 0.22],
  'Mesh_d-pad-cross': ['#ff3b4e', 0.3, 0.22, 0.28],
  'Mesh_d-pad-decals-alphad': ['#1a080c', 0.4, 0.1, 0],
  'Mesh_abxy-buttons-exterior-trans': ['#0a0406', 0.3, 0.4, 0],
  'Mesh_abxy-buttons-trans': ['#e11d38', 0.28, 0.18, 0.38],
  'Mesh_view-menu-share-buttons': ['#ff4d62', 0.32, 0.22, 0.32],
  'Mesh_interposer-buttons': ['#c8102e', 0.3, 0.25, 0.16],
  'Mesh_back-logo-decals': ['#ff3b4e', 0.22, 0.15, 0.85],
  'Mesh_lights-trans': ['#ff3b4e', 0.2, 0.05, 1.4],
  'Mesh_combined-noncustom': ['#0e0608', 0.4, 0.3, 0],
}

function isLightBar(r, g, b) {
  return b > r + 24 && b > g + 8 && b > 60
}

function canvasTextureFrom(canvas, source) {
  const next = new THREE.CanvasTexture(canvas)
  next.colorSpace = THREE.SRGBColorSpace
  next.anisotropy = 8
  next.flipY = source.flipY
  next.wrapS = source.wrapS
  next.wrapT = source.wrapT
  next.needsUpdate = true
  return next
}

function paintShell(data, index, lum) {
  const t = Math.min(1, Math.max(0.35, (lum - 40) / 180))
  data[index] = Math.round(14 + 20 * t)
  data[index + 1] = Math.round(4 + 4 * t)
  data[index + 2] = Math.round(6 + 4 * t)
}

/** Same crack-repair as the controller macro, painted black with a crimson light bar. */
function repairAkatsuki(texture) {
  const image = texture.image
  const w = image.width
  const h = image.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const frame = ctx.getImageData(0, 0, w, h)
  const data = frame.data
  const shell = new Uint8Array(w * h)
  const luma = new Uint8Array(w * h)
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    luma[p] = lum
    const warm = !isLightBar(r, g, b) && lum > 36 && r - b > 4 && r > 55 && g > 40
    if (!warm) continue
    shell[p] = 1
    paintShell(data, i, lum)
  }
  const lightBar = new Uint8Array(w * h)
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (isLightBar(data[i], data[i + 1], data[i + 2])) lightBar[p] = 1
  }
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const p = y * w + x
      if (!lightBar[p]) continue
      let near = 0
      for (let oy = -2; oy <= 2; oy++) {
        const row = (y + oy) * w + x
        for (let ox = -2; ox <= 2; ox++) near += lightBar[row + ox]
      }
      if (near >= 20) continue
      shell[p] = 1
      paintShell(data, p * 4, 210)
    }
  }
  const dist = new Uint16Array(w * h)
  dist.fill(65535)
  for (let p = 0; p < w * h; p++) if (shell[p]) dist[p] = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      let d = dist[p]
      if (x > 0 && dist[p - 1] + 1 < d) d = dist[p - 1] + 1
      if (y > 0 && dist[p - w] + 1 < d) d = dist[p - w] + 1
      dist[p] = d
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x
      let d = dist[p]
      if (x + 1 < w && dist[p + 1] + 1 < d) d = dist[p + 1] + 1
      if (y + 1 < h && dist[p + w] + 1 < d) d = dist[p + w] + 1
      dist[p] = d
    }
  }
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const d = dist[p]
    if (d === 0 || d > 3 || luma[p] > 70) continue
    if (isLightBar(data[i], data[i + 1], data[i + 2])) continue
    paintShell(data, i, 200)
  }
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (!isLightBar(data[i], data[i + 1], data[i + 2])) continue
    data[i] = 214
    data[i + 1] = 24
    data[i + 2] = 46
  }
  ctx.putImageData(frame, 0, 0)
  return canvasTextureFrom(canvas, texture)
}

function fit(clone, size) {
  const box = new THREE.Box3().setFromObject(clone)
  const dims = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const max = Math.max(dims.x, dims.y, dims.z) || 1
  const scale = size / max
  clone.scale.setScalar(scale)
  clone.position.copy(center).multiplyScalar(-scale)
}

function smoothSeamNormals(geometry) {
  const pos = geometry.getAttribute('position')
  const norm = geometry.getAttribute('normal')
  if (!pos || !norm) return
  const acc = new Map()
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 8000)}:${Math.round(pos.getY(i) * 8000)}:${Math.round(pos.getZ(i) * 8000)}`
    let bucket = acc.get(key)
    if (!bucket) {
      bucket = [0, 0, 0, 0, key]
      acc.set(key, bucket)
    }
    bucket[0] += norm.getX(i)
    bucket[1] += norm.getY(i)
    bucket[2] += norm.getZ(i)
    bucket[3] += 1
  }
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 8000)}:${Math.round(pos.getY(i) * 8000)}:${Math.round(pos.getZ(i) * 8000)}`
    const bucket = acc.get(key)
    if (!bucket || bucket[3] < 2) continue
    const len = Math.hypot(bucket[0], bucket[1], bucket[2]) || 1
    norm.setXYZ(i, bucket[0] / len, bucket[1] / len, bucket[2] / len)
  }
  norm.needsUpdate = true
}

function styleAkatsuki(scene) {
  const clone = scene.clone(true)
  fit(clone, 2.4)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = false
    node.receiveShadow = false
    node.geometry = node.geometry.clone()
    smoothSeamNormals(node.geometry)
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source.clone()
    if (material.map) material.map = repairAkatsuki(material.map)
    material.normalMap = null
    material.roughnessMap = null
    material.metalnessMap = null
    material.color = new THREE.Color('#ffffff')
    material.roughness = 0.5
    material.metalness = 0.04
    material.envMapIntensity = 0.55
    if ('clearcoat' in material) {
      material.clearcoat = 0.08
      material.clearcoatRoughness = 0.34
    }
    material.needsUpdate = true
    node.material = material
  })
  return clone
}

function useLogoTexture() {
  const [texture, setTexture] = useState(null)
  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = frame.data
      for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = data[i] + data[i + 1] + data[i + 2] > 90 ? 255 : 0
      }
      ctx.putImageData(frame, 0, 0)
      const next = new THREE.CanvasTexture(canvas)
      next.colorSpace = THREE.SRGBColorSpace
      next.anisotropy = 8
      next.needsUpdate = true
      setTexture(next)
    }
    image.src = LOGO
    return undefined
  }, [])
  return texture
}

function BlankMark({ map }) {
  const mesh = useRef(null)
  const group = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    if (!map || !mesh.current) return undefined
    group.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    const raycaster = new THREE.Raycaster()
    const aim = new THREE.Vector3(0, 0.34, 0.5).unproject(camera)
    const dir = aim.sub(camera.position).normalize()
    raycaster.set(camera.position, dir)
    const hit = raycaster.intersectObject(group, true).find((item) => item.object !== mesh.current && item.object.isMesh)
    if (!hit) return undefined
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    const toCam = new THREE.Vector3(0, 0.15, 5.8).sub(hit.point)
    if (normal.dot(toCam) < 0) normal.negate()
    const parent = mesh.current.parent
    parent.updateWorldMatrix(true, false)
    const localPoint = parent.worldToLocal(hit.point.clone().addScaledVector(normal, 0.02))
    mesh.current.position.copy(localPoint)
    const up = new THREE.Vector3(0, 1, 0)
    const yAxis = up.clone().addScaledVector(normal, -up.dot(normal))
    if (yAxis.lengthSq() < 1e-6) yAxis.set(0, 0, 1)
    yAxis.normalize()
    const xAxis = new THREE.Vector3().crossVectors(yAxis, normal).normalize()
    const worldQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal))
    const parentQuat = new THREE.Quaternion()
    parent.getWorldQuaternion(parentQuat)
    mesh.current.quaternion.copy(parentQuat.invert()).multiply(worldQuat)
    return undefined
  }, [map, group, camera])
  if (!map) return null
  return (
    <mesh ref={mesh} renderOrder={3}>
      <planeGeometry args={[0.34, 0.34]} />
      <meshBasicMaterial map={map} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Pad() {
  const gltf = useGLTF(PS5_URL, DRACO_URL, false)
  const logo = useLogoTexture()
  const model = useMemo(() => styleAkatsuki(gltf.scene), [gltf.scene])
  return (
    <group rotation={[0.28, 0, 0]} position={[0, -0.12, 0]} scale={1.68}>
      <primitive object={model} />
      <BlankMark map={logo} />
    </group>
  )
}

function XboxPad() {
  const gltf = useGLTF(XBOX_URL, DRACO_URL, false)
  const model = useMemo(() => styleXbox(gltf.scene, 2.4, XBOX_THEME), [gltf.scene])
  return (
    <group rotation={[0.28, 0, 0]} position={[0, -0.08, 0]} scale={1.62}>
      <primitive object={model} />
    </group>
  )
}

function rememberFade(group) {
  let count = 0
  group.traverse((node) => {
    if (node.isMesh) count++
  })
  if (group.userData.meshCount === count) return
  group.userData.meshCount = count
  const mats = []
  group.traverse((node) => {
    if (!node.isMesh) return
    const list = Array.isArray(node.material) ? node.material : [node.material]
    for (const mat of list) {
      if (!mat) continue
      mats.push(mat)
      if (mat.userData.fadeOpacity == null) {
        mat.userData.fadeOpacity = mat.opacity
        mat.userData.fadeWrite = mat.depthWrite
        mat.userData.fadeTransparent = mat.transparent
      }
    }
  })
  group.userData.mats = mats
}

function applyFade(group, fade) {
  if (!group) return
  rememberFade(group)
  const full = fade > 0.985
  const show = fade > 0.02
  group.visible = show
  group.scale.setScalar(0.975 + 0.025 * fade)
  if (!show) return
  for (const mat of group.userData.mats) {
    const next = mat.userData.fadeOpacity * (full ? 1 : fade)
    if (mat.opacity !== next) mat.opacity = next
    const transparent = full ? mat.userData.fadeTransparent : true
    if (mat.transparent !== transparent) {
      mat.transparent = transparent
      mat.needsUpdate = true
    }
    const depthWrite = full ? mat.userData.fadeWrite : false
    if (mat.depthWrite !== depthWrite) mat.depthWrite = depthWrite
  }
}

function Pair({ pad }) {
  const ps = useRef(null)
  const xb = useRef(null)
  const mix = useRef(pad === 'xbox' ? 1 : 0)
  const padRef = useRef(pad)
  padRef.current = pad
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    invalidate()
  }, [pad, invalidate])
  useLayoutEffect(() => {
    for (const ref of [ps, xb]) {
      const group = ref.current
      if (!group) continue
      const was = group.visible
      group.visible = true
      group.updateMatrixWorld(true)
      gl.compile(group, camera)
      group.visible = was
    }
  }, [gl, camera])
  useFrame((_, delta) => {
    const goal = padRef.current === 'xbox' ? 1 : 0
    mix.current = THREE.MathUtils.damp(mix.current, goal, 18, Math.min(delta, 1 / 30))
    if (Math.abs(mix.current - goal) < 0.004) mix.current = goal
    applyFade(ps.current, 1 - mix.current)
    applyFade(xb.current, mix.current)
    if (mix.current !== goal) invalidate()
  })
  return (
    <>
      <group ref={ps}>
        <Pad />
      </group>
      <group ref={xb} visible={false}>
        <XboxPad />
      </group>
    </>
  )
}

function Prime() {
  const advance = useThree((state) => state.advance)
  useEffect(() => {
    const frame = window.requestAnimationFrame((now) => advance(now))
    return () => window.cancelAnimationFrame(frame)
  }, [advance])
  return null
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.16} color="#ffd5db" />
      <directionalLight position={[8, 14, 18]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[-10, 6, -8]} intensity={1.15} color="#ff4d62" />
      <directionalLight position={[2, -6, 10]} intensity={0.35} color="#ff8b98" />
      <spotLight position={[0, 7.5, 3.2]} intensity={46} angle={0.38} penumbra={0.45} distance={22} color="#ffffff" />
      <spotLight position={[0, 0.4, 7]} intensity={20} angle={0.65} penumbra={0.7} distance={18} color="#ffd0d6" />
      <spotLight position={[-4, 3.2, 3]} intensity={12} angle={0.45} penumbra={0.8} distance={16} color="#ff3b4e" />
      <spotLight position={[4, 2.4, 3]} intensity={10} angle={0.5} penumbra={0.75} distance={16} color="#ff3b4e" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={5.5} position={[0, 12, 10]} scale={[20, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.8} position={[-10, 2, 4]} scale={[2, 18, 1]} color="#ffc3cc" />
        <Lightformer form="rect" intensity={1.4} position={[10, 0, 6]} scale={[2, 14, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={2} position={[0, 4, 12]} scale={6} color="#ffd0d6" />
      </Environment>
    </>
  )
}

export default function AkatsukiController({ pad = 'ps5', running = true }) {
  return (
    <div className="blank-ds blank-ds--real">
      <Canvas
        frameloop={running ? 'demand' : 'never'}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 34, near: 0.08, far: 180, position: [0, 0.15, 5.8] }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0)
          camera.lookAt(0, 0, 0)
        }}
      >
        <Suspense fallback={null}>
          <Lights />
          <Pair pad={pad} />
          <Prime />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(PS5_URL, DRACO_URL, false)
useGLTF.preload(XBOX_URL, DRACO_URL, false)
