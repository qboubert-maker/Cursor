import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { LOGO_STAGE, LOGO_URL, rig } from '../lib/rig'

function litAt(data, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false
  const i = (y * size + x) * 4
  return data[i] + data[i + 1] + data[i + 2] > 500
}

function measure(image) {
  const size = 180
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data

  let minX = size
  let minY = size
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!litAt(data, size, x, y)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  let pinch = minX
  let thinnest = Infinity
  for (let x = minX + 2; x < maxX - 2; x++) {
    let count = 0
    for (let y = minY; y <= maxY; y++) if (litAt(data, size, x, y)) count++
    if (count > 0 && count < thinnest) {
      thinnest = count
      pinch = x
    }
  }

  let sx = 0
  let sy = 0
  let n = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= pinch; x++) {
      if (!litAt(data, size, x, y)) continue
      sx += x
      sy += y
      n++
    }
  }
  const ccx = sx / Math.max(n, 1)
  const ccy = sy / Math.max(n, 1)
  let radius = 0
  let samples = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= pinch; x++) {
      if (!litAt(data, size, x, y)) continue
      radius += Math.hypot(x - ccx, y - ccy)
      samples++
    }
  }
  radius = (radius / Math.max(samples, 1)) * 1.15

  let top = maxY
  let bot = minY
  for (let y = minY; y <= maxY; y++) {
    if (!litAt(data, size, maxX - 1, y) && !litAt(data, size, maxX, y)) continue
    if (y < top) top = y
    if (y > bot) bot = y
  }

  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const world = (px, py) => [(px - midX) / spanX * 2.7, -((py - midY) / spanY) * 2.35]

  return {
    circle: [...world(ccx, ccy), (radius / spanY) * 2.35],
    apex: world(pinch, ccy),
    baseTop: world(maxX, top),
    baseBot: world(maxX, bot),
  }
}

function createBody(image) {
  const mark = measure(image)
  const [cx, cy, radius] = mark.circle
  const disc = new THREE.Shape()
  disc.absarc(cx, cy, radius, 0, Math.PI * 2, false)
  const wedge = new THREE.Shape()
  wedge.moveTo(mark.apex[0], mark.apex[1])
  wedge.lineTo(mark.baseTop[0], mark.baseTop[1])
  wedge.lineTo(mark.baseBot[0], mark.baseBot[1])
  wedge.closePath()

  const extrude = {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.028,
    bevelSegments: 3,
    curveSegments: 48,
  }
  const discGeo = new THREE.ExtrudeGeometry(disc, extrude)
  const wedgeGeo = new THREE.ExtrudeGeometry(wedge, extrude)
  discGeo.translate(0, 0, -extrude.depth / 2)
  wedgeGeo.translate(0, 0, -extrude.depth / 2)
  const merged = mergeGeometries(discGeo, wedgeGeo)
  discGeo.dispose()
  wedgeGeo.dispose()
  merged.computeVertexNormals()
  const edges = new THREE.EdgesGeometry(merged, 28)
  return { geometry: merged, edges }
}

function mergeGeometries(a, b) {
  const count = a.attributes.position.count + b.attributes.position.count
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  position.set(a.attributes.position.array, 0)
  position.set(b.attributes.position.array, a.attributes.position.count * 3)
  if (a.attributes.normal && b.attributes.normal) {
    normal.set(a.attributes.normal.array, 0)
    normal.set(b.attributes.normal.array, a.attributes.normal.count * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  const index = []
  const pushIndex = (source, offset) => {
    const src = source.index ? source.index.array : null
    const n = source.attributes.position.count
    if (src) {
      for (let i = 0; i < src.length; i++) index.push(src[i] + offset)
    } else {
      for (let i = 0; i < n; i++) index.push(i + offset)
    }
  }
  pushIndex(a, 0)
  pushIndex(b, a.attributes.position.count)
  geometry.setIndex(index)
  return geometry
}

/** Extruded Blank Delay mark: dark chrome, white rim, slow cinematic turn. */
export default function PremiumLogo3D() {
  const map = useTexture(LOGO_URL)
  const group = useRef(null)
  const rim = useRef(null)

  const assets = useMemo(() => createBody(map.image), [map])

  useEffect(
    () => () => {
      assets.geometry.dispose()
      assets.edges.dispose()
    },
    [assets],
  )

  useFrame(() => {
    const show = THREE.MathUtils.clamp(rig.social, 0, 1)
    const emerge = THREE.MathUtils.smoothstep(show, 0.28, 1)
    group.current.visible = emerge > 0.02
    if (emerge <= 0.02) return
    group.current.rotation.set(0, 0, 0)
    group.current.scale.setScalar(0.08 + emerge * 0.64)
    rim.current.material.opacity = 0.25 + emerge * 0.7
  })

  return (
    <group ref={group} position={[LOGO_STAGE.x, LOGO_STAGE.y, LOGO_STAGE.z]} visible={false}>
      <mesh geometry={assets.geometry}>
        <meshPhysicalMaterial
          color="#050505"
          metalness={0.86}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={1}
          envMapIntensity={1.6}
          transparent
          opacity={0.92}
          emissive="#ffffff"
          emissiveIntensity={0.05}
        />
      </mesh>
      <lineSegments ref={rim} geometry={assets.edges}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

useTexture.preload(LOGO_URL)
