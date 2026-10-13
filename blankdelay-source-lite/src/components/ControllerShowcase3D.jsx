import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import '../lib/localDraco'
import { padKey, padLeft, padRight, padRim } from '../lib/padLights'
import { rig } from '../lib/rig'

const PS5_URL = `${import.meta.env.BASE_URL}ps5.glb`
const XBOX_URL = `${import.meta.env.BASE_URL}xbox.glb`
const DRACO_URL = `${import.meta.env.BASE_URL}draco/`

function fit(clone, size) {
  const box = new THREE.Box3().setFromObject(clone)
  const dims = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const max = Math.max(dims.x, dims.y, dims.z) || 1
  const scale = size / max
  clone.scale.setScalar(scale)
  clone.position.copy(center).multiplyScalar(-scale)
}

const shellImages = new WeakMap()

function isLightBar(r, g, b) {
  return b > r + 24 && b > g + 8 && b > 60
}

function canvasTextureFrom(canvas, source, colorSpace) {
  const next = new THREE.CanvasTexture(canvas)
  next.colorSpace = colorSpace
  next.anisotropy = 8
  next.flipY = source.flipY
  next.wrapS = source.wrapS
  next.wrapT = source.wrapT
  next.needsUpdate = true
  return next
}

function paintShell(data, index, lum, blue) {
  if (!blue) {
    const white = Math.min(255, Math.round(255 * (0.94 + 0.06 * (lum / 255))))
    data[index] = white
    data[index + 1] = white
    data[index + 2] = white
    return
  }
  const t = Math.min(1, Math.max(0.4, (lum - 40) / 180))
  data[index] = Math.round(8 + 14 * t)
  data[index + 1] = Math.round(36 + 34 * t)
  data[index + 2] = Math.round(96 + 54 * t)
}

/** Recolor the shell and bleed that color across the dark UV gutters that read as cracks. */
function repairDualSense(texture, blue = false) {
  const image = texture.image
  let cache = shellImages.get(image)
  if (!cache) {
    cache = {}
    shellImages.set(image, cache)
  }
  const key = blue ? 'blue' : 'white'
  if (cache[key]) return cache[key]
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
    paintShell(data, i, lum, blue)
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
      paintShell(data, p * 4, 210, blue)
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
  const reach = 3
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const d = dist[p]
    if (d === 0 || d > reach || luma[p] > 70) continue
    if (isLightBar(data[i], data[i + 1], data[i + 2])) continue
    paintShell(data, i, 200, blue)
  }
  if (blue) {
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      if (!isLightBar(data[i], data[i + 1], data[i + 2])) continue
      data[i] = 176
      data[i + 1] = 214
      data[i + 2] = 255
    }
  }
  ctx.putImageData(frame, 0, 0)
  const next = canvasTextureFrom(canvas, texture, THREE.SRGBColorSpace)
  cache[key] = next
  return next
}

function smoothSeamNormals(geometry) {
  const pos = geometry.getAttribute('position')
  const norm = geometry.getAttribute('normal')
  if (!pos || !norm) return
  const acc = new Map()
  const keys = new Float64Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const ix = (Math.round(pos.getX(i) * 8000) + 8000) | 0
    const iy = (Math.round(pos.getY(i) * 8000) + 8000) | 0
    const iz = (Math.round(pos.getZ(i) * 8000) + 8000) | 0
    const key = ix * 4294967296 + iy * 65536 + iz
    keys[i] = key
    let bucket = acc.get(key)
    if (!bucket) {
      bucket = [0, 0, 0, 0]
      acc.set(key, bucket)
    }
    bucket[0] += norm.getX(i)
    bucket[1] += norm.getY(i)
    bucket[2] += norm.getZ(i)
    bucket[3] += 1
  }
  for (let i = 0; i < pos.count; i++) {
    const bucket = acc.get(keys[i])
    if (!bucket || bucket[3] < 2) continue
    const len = Math.hypot(bucket[0], bucket[1], bucket[2]) || 1
    norm.setXYZ(i, bucket[0] / len, bucket[1] / len, bucket[2] / len)
  }
  norm.needsUpdate = true
}

function stylePs5(scene, size, blue = false) {
  const clone = scene.clone(true)
  fit(clone, size)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = false
    node.receiveShadow = false
    if (node.geometry) {
      node.geometry = node.geometry.clone()
      smoothSeamNormals(node.geometry)
    }
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source.clone()
    if (material.map) material.map = repairDualSense(material.map, blue)
    material.normalMap = null
    material.roughnessMap = null
    material.metalnessMap = null
    material.color = new THREE.Color('#ffffff')
    material.roughness = blue ? 0.46 : 0.56
    material.metalness = blue ? 0.06 : 0.02
    material.envMapIntensity = blue ? 0.42 : 0.55
    if ('clearcoat' in material) {
      material.clearcoat = blue ? 0.12 : 0
      material.clearcoatRoughness = blue ? 0.28 : 0.4
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

function letterTexture(char) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 256, 256)
  ctx.fillStyle = '#f5f5f5'
  ctx.font = '700 170px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, 128, 136)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function clusterButtonCaps(geometry) {
  const pos = geometry.getAttribute('position')
  const normalAttr = geometry.getAttribute('normal')
  if (!pos || pos.count < 4) return []
  const step = Math.max(1, Math.floor(pos.count / 2400))
  const samples = []
  for (let i = 0; i < pos.count; i += step) {
    samples.push({
      point: new THREE.Vector3().fromBufferAttribute(pos, i),
      normal: normalAttr ? new THREE.Vector3().fromBufferAttribute(normalAttr, i) : new THREE.Vector3(0, 0, 1),
    })
  }
  const centroids = [samples[0].point.clone()]
  while (centroids.length < 4) {
    let best = 0
    let bestD = -1
    for (let i = 0; i < samples.length; i++) {
      let nearest = Infinity
      for (const centroid of centroids) nearest = Math.min(nearest, centroid.distanceToSquared(samples[i].point))
      if (nearest > bestD) {
        bestD = nearest
        best = i
      }
    }
    centroids.push(samples[best].point.clone())
  }
  const assign = new Array(samples.length).fill(0)
  for (let iter = 0; iter < 16; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0
      let bestD = Infinity
      for (let k = 0; k < 4; k++) {
        const d = centroids[k].distanceToSquared(samples[i].point)
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      assign[i] = best
    }
    const counts = [0, 0, 0, 0]
    for (let k = 0; k < 4; k++) centroids[k].set(0, 0, 0)
    for (let i = 0; i < samples.length; i++) {
      centroids[assign[i]].add(samples[i].point)
      counts[assign[i]]++
    }
    for (let k = 0; k < 4; k++) if (counts[k]) centroids[k].multiplyScalar(1 / counts[k])
  }
  return centroids.map((center, k) => {
    const normal = new THREE.Vector3()
    let radius = 0
    let count = 0
    for (let i = 0; i < samples.length; i++) {
      if (assign[i] !== k) continue
      count++
      normal.add(samples[i].normal)
      radius = Math.max(radius, samples[i].point.distanceTo(center))
    }
    if (normal.lengthSq() === 0) normal.set(0, 0, 1)
    normal.normalize()
    const points = []
    for (let i = 0; i < samples.length; i++) if (assign[i] === k) points.push(samples[i].point)
    return { center, normal, radius, count, points }
  })
}

function addXboxLetters(clone) {
  const buttons = clone.getObjectByName('Mesh_abxy-buttons-trans')
  const triggers = clone.getObjectByName('Mesh_triggers')
  const dpad = clone.getObjectByName('Mesh_d-pad-cross')
  if (!buttons?.geometry || !triggers || !dpad) return
  const clusters = clusterButtonCaps(buttons.geometry)
  if (clusters.length < 4) return
  clone.updateMatrixWorld(true)
  const centerOf = (object) => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
  const up = centerOf(triggers).sub(centerOf(clone)).normalize()
  const right = centerOf(buttons).sub(centerOf(dpad)).normalize()
  right.addScaledVector(up, -right.dot(up)).normalize()
  const intoLocal = new THREE.Matrix4().copy(buttons.matrixWorld).invert()
  const upLocal = up.clone().transformDirection(intoLocal).normalize()
  const rightLocal = right.clone().transformDirection(intoLocal).normalize()
  const bodyLocal = buttons.worldToLocal(centerOf(clone).clone())
  for (const cluster of clusters) {
    const outward = cluster.center.clone().sub(bodyLocal).normalize()
    if (cluster.normal.dot(outward) < 0) cluster.normal.negate()
    let peak = -Infinity
    for (const point of cluster.points) peak = Math.max(peak, point.dot(cluster.normal))
    const crown = []
    const band = Math.max(cluster.radius * 0.12, 1e-5)
    for (const point of cluster.points) {
      if (point.dot(cluster.normal) >= peak - band) crown.push(point)
    }
    const top = new THREE.Vector3()
    for (const point of crown) top.add(point)
    if (crown.length) top.multiplyScalar(1 / crown.length)
    else top.copy(cluster.center)
    const sunk = peak - top.dot(cluster.normal)
    if (sunk > 0) top.addScaledVector(cluster.normal, sunk)
    cluster.top = top
  }
  const centroid = clusters.reduce((sum, cluster) => sum.add(cluster.center), new THREE.Vector3()).multiplyScalar(1 / clusters.length)
  const scored = clusters.map((cluster) => {
    const rel = cluster.center.clone().sub(centroid)
    return { ...cluster, u: rel.dot(upLocal), r: rel.dot(rightLocal) }
  })
  scored.sort((a, b) => b.u - a.u)
  const named = [
    [scored[0], 'Y'],
    [scored[scored.length - 1], 'A'],
  ]
  const middle = scored.slice(1, -1).sort((a, b) => b.r - a.r)
  named.push([middle[0], 'B'], [middle[middle.length - 1], 'X'])
  for (const [cluster, char] of named) {
    if (!cluster) continue
    const normal = cluster.normal.clone().normalize()
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(cluster.radius * 0.36, 0.008), 40),
      new THREE.MeshBasicMaterial({
        map: letterTexture(char),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -10,
        polygonOffsetUnits: -10,
      }),
    )
    mesh.position.copy(cluster.top).addScaledVector(normal, cluster.radius * 0.012)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)
    const desired = upLocal.clone().addScaledVector(normal, -upLocal.dot(normal)).normalize()
    const roll = Math.atan2(currentUp.clone().cross(desired).dot(normal), currentUp.dot(desired))
    mesh.rotateZ(roll)
    mesh.renderOrder = 2
    buttons.add(mesh)
  }
}

export function styleXbox(scene, size, finishMap = XBOX_FINISH) {
  const clone = scene.clone(true)
  fit(clone, size)
  clone.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = false
    node.receiveShadow = false
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    const material = source ? source.clone() : new THREE.MeshStandardMaterial()
    const finish = finishMap[node.name] || ['#0b0b0b', 0.4, 0.25, 0]
    material.color = new THREE.Color(finish[0])
    material.roughness = finish[1]
    material.metalness = finish[2]
    material.emissive = new THREE.Color(finish[3] > 0 ? finish[0] : '#000000')
    material.emissiveIntensity = finish[3]
    material.envMapIntensity = finish[3] > 0 ? 0.4 : 1.1
    material.needsUpdate = true
    node.material = material
  })
  addXboxLetters(clone)
  return clone
}

function PhysicalController({ url, size }) {
  const gltf = useGLTF(url, DRACO_URL, false)
  const model = useMemo(() => styleXbox(gltf.scene, size), [gltf.scene, size])
  return <primitive object={model} />
}

function PlayStationController({ size, tone, prepareBlue = false }) {
  const gltf = useGLTF(PS5_URL, DRACO_URL, false)
  const white = useMemo(() => stylePs5(gltf.scene, size, false), [gltf.scene, size])
  const [blue, setBlue] = useState(null)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    if (!prepareBlue) return undefined
    let cancel = false
    const build = () => {
      if (cancel) return
      setBlue(stylePs5(gltf.scene, size, true))
    }
    const idle = window.requestIdleCallback?.(build, { timeout: 600 })
    const timer = idle == null ? window.setTimeout(build, 200) : 0
    return () => {
      cancel = true
      if (idle != null) window.cancelIdleCallback?.(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [gltf.scene, size, prepareBlue])
  useEffect(() => {
    if (!blue) return undefined
    blue.visible = true
    gl.compile(blue, camera)
    return undefined
  }, [blue, gl, camera])
  return (
    <>
      <primitive object={white} visible={tone !== 'sony' || !blue} />
      {blue ? <primitive object={blue} visible={tone === 'sony'} /> : null}
    </>
  )
}

/** Real PS5 DualSense and Xbox Elite pads, posed by the scroll rig. */
export default function ControllerShowcase3D({ pinned = false, focus = 'ps5' }) {
  const root = useRef(null)
  const ps5 = useRef(null)
  const xbox = useRef(null)
  const focusRef = useRef(focus)
  focusRef.current = focus

  useFrame((state) => {
    if (pinned && focusRef.current === 'pair') {
      root.current.visible = true
      const bob = Math.sin(state.clock.elapsedTime * 0.7) * 0.03
      ps5.current.scale.setScalar(0.92)
      xbox.current.scale.setScalar(0.92)
      ps5.current.position.set(-1.28, -0.02 + bob, -0.85)
      xbox.current.position.set(1.28, -0.06 + bob * 0.85, -0.85)
      ps5.current.rotation.set(0.16, 0.28, 0.02)
      xbox.current.rotation.set(0.14, -0.28, -0.02)
      ps5.current.visible = true
      xbox.current.visible = true
      return
    }
    if (pinned) {
      root.current.visible = true
      const xboxOn = focusRef.current === 'xbox'
      const bob = Math.sin(state.clock.elapsedTime * 0.7) * 0.04
      ps5.current.scale.setScalar(1.22)
      xbox.current.scale.setScalar(1.22)
      ps5.current.position.set(0, 0.05 + bob, 0)
      xbox.current.position.set(0, 0.05 + bob, 0)
      ps5.current.rotation.set(0.28, 0, 0)
      xbox.current.rotation.set(0.28, 0, 0)
      ps5.current.visible = !xboxOn
      xbox.current.visible = xboxOn
      return
    }
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
        <PlayStationController size={2.4} prepareBlue={pinned} tone={pinned && focus !== 'pair' ? 'sony' : 'white'} />
      </group>
      <group ref={xbox}>
        <PhysicalController url={XBOX_URL} size={2.4} tone="black" />
      </group>
    </group>
  )
}

useGLTF.preload(PS5_URL, DRACO_URL, false)
useGLTF.preload(XBOX_URL, DRACO_URL, false)
