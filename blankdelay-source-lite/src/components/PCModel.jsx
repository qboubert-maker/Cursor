import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Decal, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOARD, BOARD_FACE, CPU, FRONT_LOGO, GPU, HALF, POINTS, PUMP, RAM, SHROUD } from '../lib/layout'
import { LOGO_URL, anchors, rig } from '../lib/rig'

const TAU = Math.PI * 2
const PUMP_TOP = BOARD_FACE - PUMP.height
const PUMP_BASE = BOARD_FACE - 0.13
const SHROUD_MID = (SHROUD.top + SHROUD.bottom) / 2

const FAN_SLOTS = [
  { position: [-0.1, 1.985, -1.3], rotation: [-Math.PI / 2, 0, 0] },
  { position: [-0.1, 1.985, -0.1], rotation: [-Math.PI / 2, 0, 0] },
  { position: [-0.1, 1.985, 1.1], rotation: [-Math.PI / 2, 0, 0] },
  { position: [-0.05, -0.72, 2.06], rotation: [0, 0, 0] },
  { position: [-0.05, 0.46, 2.06], rotation: [0, 0, 0] },
  { position: [-0.05, 1.64, 2.06], rotation: [0, 0, 0] },
  { position: [-0.05, 1.25, -2.12], rotation: [0, Math.PI, 0] },
]

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

const smooth01 = (x) => {
  const t = Math.min(Math.max(x, 0), 1)
  return t * t * (3 - 2 * t)
}

/* ───────────────────────────── Procedural textures ───────────────────────────── */

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

function toTexture(canvas, { color = true, repeat = false, anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.anisotropy = anisotropy
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  return texture
}

function whenFontsReady(callback) {
  const fonts = typeof document !== 'undefined' ? document.fonts : null
  if (!fonts) return
  fonts.ready.then(callback, () => {})
  Promise.all([fonts.load('800 60px "Archivo"'), fonts.load('700 30px "JetBrains Mono"')]).then(callback, () => {})
}

function drawTracked(ctx, text, x, y, tracking) {
  let cursor = x
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + tracking
  }
  return cursor - tracking
}

function brushedTexture() {
  const [canvas, ctx] = makeCanvas(512, 512)
  const rand = mulberry32(11)
  ctx.fillStyle = '#8c8c8c'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 3400; i++) {
    const y = rand() * 512
    const x = rand() * 512
    const len = 40 + rand() * 440
    const v = Math.round(96 + rand() * 100)
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.18 + rand() * 0.42})`
    ctx.lineWidth = 0.5 + rand() * 1.1
    for (const shift of [0, -512]) {
      ctx.beginPath()
      ctx.moveTo(x + shift, y)
      ctx.lineTo(x + shift + len, y)
      ctx.stroke()
    }
  }
  return toTexture(canvas, { color: false, repeat: true })
}

function ventTexture() {
  const [canvas, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = '#1c1c1d'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#020202'
  const step = 16
  for (let row = 0; row <= 8; row++) {
    for (let col = 0; col <= 8; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0)
      ctx.beginPath()
      ctx.arc(x, row * step, 5.4, 0, TAU)
      ctx.fill()
    }
  }
  return toTexture(canvas, { repeat: true })
}

function finTexture() {
  const [canvas, ctx] = makeCanvas(64, 64)
  ctx.fillStyle = '#060606'
  ctx.fillRect(0, 0, 64, 64)
  for (let x = 0; x < 64; x += 4) {
    ctx.fillStyle = x % 8 ? '#3a3a3c' : '#2a2a2b'
    ctx.fillRect(x, 0, 1.6, 64)
  }
  return toTexture(canvas, { repeat: true })
}

function pcbTexture() {
  const W = 1024
  const H = 1280
  const [canvas, ctx] = makeCanvas(W, H)
  const texture = toTexture(canvas)
  const zMin = BOARD.z - BOARD.width / 2
  const yMax = BOARD.y + BOARD.height / 2
  const px = (z) => ((z - zMin) / BOARD.width) * W
  const py = (y) => ((yMax - y) / BOARD.height) * H
  const sx = (d) => (d / BOARD.width) * W
  const sy = (d) => (d / BOARD.height) * H

  const draw = () => {
    const rand = mulberry32(31)
    const base = ctx.createLinearGradient(0, 0, W, H)
    base.addColorStop(0, '#0f0f10')
    base.addColorStop(1, '#09090a')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    for (let i = 0; i < 30; i++) ctx.fillRect(rand() * W, rand() * H, 40 + rand() * 240, 30 + rand() * 170)

    ctx.fillStyle = 'rgba(210,210,210,0.2)'
    for (let i = 0; i < 1700; i++) {
      ctx.beginPath()
      ctx.arc(rand() * W, rand() * H, 0.9 + rand() * 1.3, 0, TAU)
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(160,160,160,0.28)'
    for (let i = 0; i < 260; i++) {
      const x = rand() * W
      const y = rand() * H
      const horizontal = rand() > 0.5
      ctx.fillRect(x, y, horizontal ? 9 : 4, horizontal ? 4 : 9)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2

    const socket = 0.76
    ctx.strokeRect(px(CPU.z - socket / 2), py(CPU.y + socket / 2), sx(socket), sy(socket))
    ctx.beginPath()
    ctx.moveTo(px(CPU.z - socket / 2), py(CPU.y - socket / 2 + 0.08))
    ctx.lineTo(px(CPU.z - socket / 2 + 0.08), py(CPU.y - socket / 2))
    ctx.stroke()

    for (const z of RAM.slots) ctx.strokeRect(px(z - 0.052), py(RAM.y + 0.74), sx(0.104), sy(1.48))
    ctx.strokeRect(px(-1.52), py(-0.06), sx(0.98), sy(0.1))
    ctx.strokeRect(px(-1.42), py(0.4), sx(1.15), sy(0.25))
    ctx.strokeRect(px(-1.47), py(-0.83), sx(1.05), sy(0.25))
    ctx.strokeRect(px(0.0), py(-0.66), sx(0.58), sy(0.54))

    ctx.font = '700 15px "JetBrains Mono", monospace'
    ctx.textBaseline = 'middle'
    RAM.slots.forEach((z, i) => {
      ctx.save()
      ctx.translate(px(z) + 2, py(RAM.y - 0.82))
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(['DIMM_A1', 'DIMM_A2', 'DIMM_B1', 'DIMM_B2'][i], 0, 0)
      ctx.restore()
    })
    ctx.fillText('PCIE_X16_1', px(-1.5), py(0.02))
    ctx.fillText('M2_1  PCIE 5.0', px(-1.4), py(0.7))
    ctx.fillText('M2_2', px(-1.45), py(-0.62))
    ctx.fillText('CPU_FAN', px(-0.35), py(1.78))
    ctx.fillText('SYS_FAN1', px(0.25), py(-1.15))
    ctx.fillText('ATX_24P', px(0.42), py(1.38))

    ctx.font = '800 34px "Archivo", "Arial Black", sans-serif'
    ctx.textBaseline = 'alphabetic'
    drawTracked(ctx, 'BLANK DELAY', px(-1.7), py(-1.0), 6)
    ctx.font = '700 14px "JetBrains Mono", monospace'
    drawTracked(ctx, 'ZERO-DELAY SERIES // REV 1.0', px(-1.7), py(-1.08), 2)

    const holes = [
      [-1.72, 1.74],
      [-0.2, 1.74],
      [0.5, 1.74],
      [-1.72, 0.2],
      [0.5, 0.25],
      [-1.72, -1.1],
      [-0.2, -1.1],
      [0.5, -1.1],
    ]
    for (const [z, y] of holes) {
      ctx.fillStyle = '#7d7d7d'
      ctx.beginPath()
      ctx.arc(px(z), py(y), 13, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#050505'
      ctx.beginPath()
      ctx.arc(px(z), py(y), 6.5, 0, TAU)
      ctx.fill()
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, W - 6, H - 6)
    texture.needsUpdate = true
  }

  draw()
  whenFontsReady(draw)
  return texture
}

function gpuPlateTexture(logoImage, aspect) {
  const W = 2048
  const H = 128
  const [canvas, ctx] = makeCanvas(W, H)
  const texture = toTexture(canvas)
  const draw = () => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'
    const lh = 66
    const lw = lh * aspect
    ctx.drawImage(logoImage, 30, (H - lh) / 2, lw, lh)
    ctx.font = '800 60px "Archivo", "Arial Black", sans-serif'
    ctx.textBaseline = 'middle'
    const end = drawTracked(ctx, 'BLANK DELAY', 30 + lw + 44, H / 2 + 3, 16)
    ctx.globalAlpha = 0.55
    ctx.fillRect(end + 46, H / 2 - 1.5, W - end - 380, 3)
    ctx.globalAlpha = 1
    ctx.font = '700 30px "JetBrains Mono", monospace'
    drawTracked(ctx, 'ZERO-DELAY', W - 290, H / 2 + 2, 5)
    texture.needsUpdate = true
  }
  draw()
  whenFontsReady(draw)
  return texture
}

function shroudPlateTexture() {
  const W = 2048
  const H = 256
  const [canvas, ctx] = makeCanvas(W, H)
  const texture = toTexture(canvas)
  const draw = () => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 118px "Archivo", "Arial Black", sans-serif'
    ctx.textBaseline = 'alphabetic'
    drawTracked(ctx, 'BLANK DELAY', 8, 150, 26)
    ctx.globalAlpha = 0.6
    ctx.font = '700 34px "JetBrains Mono", monospace'
    drawTracked(ctx, 'ZERO DELAY. INFINITE ADVANTAGE.', 12, 222, 7)
    ctx.globalAlpha = 1
    texture.needsUpdate = true
  }
  draw()
  whenFontsReady(draw)
  return texture
}

/** Bloom-style halo baked from the logo's own alpha so the glow matches the mark exactly. */
function logoGlowTexture(image, logoW, logoH, pad) {
  const planeW = logoW + pad * 2
  const planeH = logoH + pad * 2
  const W = 512
  const H = Math.round((W * planeH) / planeW)
  const [source, sctx] = makeCanvas(W, H)
  const lw = (logoW / planeW) * W
  const lh = (logoH / planeH) * H
  sctx.drawImage(image, (W - lw) / 2, (H - lh) / 2, lw, lh)

  const [canvas, ctx] = makeCanvas(W, H)
  ctx.globalCompositeOperation = 'lighter'
  const canFilter = typeof ctx.filter === 'string'
  for (const [radius, alpha] of [
    [3, 0.5],
    [9, 0.42],
    [20, 0.38],
    [42, 0.34],
  ]) {
    ctx.globalAlpha = alpha
    if (canFilter) {
      ctx.filter = `blur(${radius}px)`
      ctx.drawImage(source, 0, 0)
    } else {
      const k = Math.max(1, radius / 1.5)
      const [tiny, tctx] = makeCanvas(Math.max(2, Math.round(W / k)), Math.max(2, Math.round(H / k)))
      tctx.drawImage(source, 0, 0, tiny.width, tiny.height)
      ctx.drawImage(tiny, 0, 0, W, H)
    }
  }
  ctx.filter = 'none'
  return { texture: toTexture(canvas, { anisotropy: 4 }), planeW, planeH }
}

function radialTexture() {
  const [canvas, ctx] = makeCanvas(256, 256)
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.12, 'rgba(255,255,255,0.75)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return toTexture(canvas, { anisotropy: 1 })
}

function streakTexture() {
  const [canvas, ctx] = makeCanvas(512, 64)
  const h = ctx.createLinearGradient(0, 0, 512, 0)
  h.addColorStop(0, 'rgba(255,255,255,0)')
  h.addColorStop(0.5, 'rgba(255,255,255,1)')
  h.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = h
  ctx.fillRect(0, 0, 512, 64)
  ctx.globalCompositeOperation = 'destination-in'
  const v = ctx.createLinearGradient(0, 0, 0, 64)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(0.5, 'rgba(0,0,0,1)')
  v.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, 512, 64)
  return toTexture(canvas, { anisotropy: 1 })
}

/* ───────────────────────────── Materials ───────────────────────────── */

/**
 * Tempered glass: reflections are added at full strength while `opacity` only tints
 * whatever sits behind the pane (premultiplied blending with the premultiply step removed).
 */
function glassMaterial({ opacity, envIntensity }) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    metalness: 0,
    roughness: 0.035,
    ior: 1.52,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: envIntensity,
    transparent: true,
    opacity,
    depthWrite: false,
    premultipliedAlpha: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>', '')
  }
  material.customProgramCacheKey = () => 'blank-delay-glass'
  return material
}

function createMaterials(tex) {
  return {
    chassis: new THREE.MeshPhysicalMaterial({
      color: '#3a3a3e',
      metalness: 0.92,
      roughness: 0.62,
      roughnessMap: tex.brushed,
      anisotropy: 0.65,
      envMapIntensity: 1.3,
      clearcoat: 0.25,
      clearcoatRoughness: 0.32,
    }),
    interior: new THREE.MeshStandardMaterial({ color: '#0d0d0e', metalness: 0.35, roughness: 0.72, envMapIntensity: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: '#dedede', metalness: 1, roughness: 0.2, envMapIntensity: 1.6 }),
    heatsink: new THREE.MeshStandardMaterial({
      color: '#303033',
      metalness: 0.9,
      roughness: 0.58,
      roughnessMap: tex.brushed,
      envMapIntensity: 1.15,
    }),
    dark: new THREE.MeshPhysicalMaterial({
      color: '#101011',
      metalness: 0.5,
      roughness: 0.32,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.05,
    }),
    plastic: new THREE.MeshStandardMaterial({ color: '#121213', metalness: 0, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#050505', metalness: 0, roughness: 0.92 }),
    vent: new THREE.MeshStandardMaterial({ map: tex.vent, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.8 }),
    fins: new THREE.MeshStandardMaterial({ map: tex.fins, metalness: 0.7, roughness: 0.45, envMapIntensity: 0.8 }),
    pcb: new THREE.MeshStandardMaterial({ map: tex.pcb, metalness: 0.3, roughness: 0.55, envMapIntensity: 0.7 }),
    tube: new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.62, metalness: 0.05 }),
    cable: new THREE.MeshStandardMaterial({
      color: '#f2f2f2',
      roughness: 0.55,
      metalness: 0,
      emissive: '#ffffff',
      emissiveIntensity: 0.06,
    }),
    glow: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    frit: new THREE.MeshStandardMaterial({ color: '#030303', roughness: 0.25, metalness: 0 }),
    capGlass: new THREE.MeshPhysicalMaterial({
      color: '#060606',
      roughness: 0.12,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    }),
    blade: new THREE.MeshStandardMaterial({ color: '#151517', roughness: 0.38, metalness: 0.15, side: THREE.DoubleSide }),
    glassClear: glassMaterial({ opacity: 0.1, envIntensity: 2.6 }),
    glassSmoked: glassMaterial({ opacity: 0.72, envIntensity: 2.3 }),
  }
}

/* ───────────────────────────── Geometry ───────────────────────────── */

/** Box whose UVs are scaled to world size so tiled textures keep a constant density. */
function box(w, h, d, tile = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d)
  if (tile) {
    const uv = geometry.attributes.uv
    const faces = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ]
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k
        uv.setXY(i, (uv.getX(i) * faces[f][0]) / tile, (uv.getY(i) * faces[f][1]) / tile)
      }
    }
  }
  return geometry
}

const cylinder = (radius, height, segments = 24) => new THREE.CylinderGeometry(radius, radius, height, segments)
const torus = (radius, tube, radial = 8, tubular = 48) => new THREE.TorusGeometry(radius, tube, radial, tubular)
const tubePath = (points, radius, segments = 64) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 10, false)

const _matrix = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _scale = new THREE.Vector3(1, 1, 1)

/** Collects static parts per material and merges each bucket into a single draw call. */
function createBuilder() {
  const buckets = new Map()
  const add = (key, source, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const geometry = source.index ? source.toNonIndexed() : source.clone()
    source.dispose()
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name)
    }
    geometry.clearGroups()
    _matrix.compose(_pos.set(...position), _quat.setFromEuler(_euler.set(...rotation)), _scale)
    geometry.applyMatrix4(_matrix)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(geometry)
  }
  const build = () => {
    const merged = {}
    for (const [key, list] of buckets) {
      merged[key] = mergeGeometries(list, false)
      merged[key].computeBoundingSphere()
      for (const g of list) g.dispose()
    }
    return merged
  }
  return { add, build }
}

function buildStaticParts() {
  const b = createBuilder()
  const { x: HX, y: HY, z: HZ } = HALF
  const F = BOARD_FACE

  // Outer shell
  b.add('chassis', box(2.4, 0.07, 4.6, 1.6), [0, HY - 0.035, 0])
  b.add('chassis', box(2.4, 0.07, 4.6, 1.6), [0, -HY + 0.035, 0])
  b.add('chassis', box(0.05, 4.66, 4.46, 1.6), [HX - 0.025, 0, 0])
  b.add('chassis', box(2.3, 4.66, 0.05, 1.6), [0, 0, -HZ + 0.025])
  b.add('chassis', box(0.05, 4.66, 0.05, 1.6), [-HX + 0.025, 0, -HZ + 0.025])
  b.add('trim', box(0.05, 4.66, 0.05), [-HX + 0.025, 0, HZ - 0.025])
  b.add('trim', box(0.05, 4.66, 0.05), [HX - 0.025, 0, HZ - 0.025])
  b.add('trim', box(2.4, 0.014, 0.014), [0, HY, HZ - 0.007])
  b.add('trim', box(2.4, 0.014, 0.014), [0, -HY, HZ - 0.007])
  b.add('trim', box(0.014, 0.014, 4.6), [-HX + 0.007, HY, 0])
  b.add('trim', box(0.014, 0.014, 4.6), [-HX + 0.007, -HY, 0])
  b.add('vent', box(1.5, 0.008, 3.9, 0.16), [-0.1, HY + 0.003, -0.08])
  for (const x of [-0.92, 0.92]) b.add('trim', box(0.14, 0.07, 4.3), [x, -HY - 0.035, 0])
  for (let i = 0; i < 7; i++) b.add('trim', box(0.9, 0.1, 0.012), [0.18, -0.25 - i * 0.15, -HZ - 0.006])
  b.add('vent', box(1.15, 1.15, 0.01, 0.16), [-0.05, 1.25, -HZ - 0.004])
  b.add('dark', box(0.62, 0.95, 0.012), [0.62, 1.2, -HZ - 0.006])

  // Interior structure
  b.add('interior', box(0.03, 4.5, 4.36), [0.94, 0, 0])
  b.add('interior', box(2.06, 0.04, 4.12), [-0.09, SHROUD.top - 0.02, -0.16])
  b.add('interior', box(2.06, 0.95, 0.04), [-0.09, SHROUD_MID, SHROUD.front])
  b.add('vent', box(0.95, 0.006, 0.7, 0.12), [-0.45, SHROUD.top + 0.001, 1.35])
  b.add('glow', box(0.012, 0.012, 4.1), [SHROUD.outer - 0.016, SHROUD.top - 0.006, -0.16])
  for (const x of [-1.08, 1.08]) b.add('glow', box(0.022, 4.25, 0.02), [x, 0.02, HZ - 0.12])
  b.add('rubber', box(0.02, 1.1, 0.13), [0.925, 1.1, 0.95])
  b.add('rubber', box(0.02, 1.0, 0.13), [0.925, -0.55, 0.95])

  // Motherboard
  b.add('pcb', box(BOARD.thickness, BOARD.height, BOARD.width), [BOARD.x, BOARD.y, BOARD.z])
  b.add('heatsink', box(0.03, 0.66, 0.66, 0.4), [F - 0.015, CPU.y, CPU.z])
  b.add('dark', box(0.1, 0.62, 0.62), [F - 0.08, CPU.y, CPU.z])
  b.add('dark', cylinder(PUMP.radius, PUMP_BASE - PUMP_TOP, 56), [(PUMP_BASE + PUMP_TOP) / 2, CPU.y, CPU.z], [0, 0, Math.PI / 2])
  b.add('trim', torus(PUMP.radius - 0.004, 0.012, 10, 72), [PUMP_TOP + 0.004, CPU.y, CPU.z], [0, Math.PI / 2, 0])
  b.add('glow', torus(PUMP.radius - 0.04, 0.007, 8, 72), [PUMP_TOP - 0.003, CPU.y, CPU.z], [0, Math.PI / 2, 0])
  for (const [dy, dz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    b.add('trim', cylinder(0.022, 0.03, 12), [F - 0.13, CPU.y + dy * 0.27, CPU.z + dz * 0.27], [0, 0, Math.PI / 2])
  }

  for (const z of RAM.slots) {
    b.add('plastic', box(0.06, 1.44, 0.088), [F - 0.03, RAM.y, z])
    b.add('heatsink', box(0.31, RAM.length, RAM.thickness, 0.6), [F - 0.215, RAM.y, z])
    b.add('trim', box(0.008, RAM.length - 0.02, RAM.thickness + 0.004), [F - 0.372, RAM.y, z])
    b.add('glow', box(0.064, RAM.length - 0.08, RAM.thickness - 0.012), [F - 0.408, RAM.y, z])
    for (const end of [-1, 1]) b.add('plastic', box(0.09, 0.05, 0.1), [F - 0.045, RAM.y + end * 0.74, z])
  }

  b.add('heatsink', box(0.24, 0.28, 1.2, 0.5), [F - 0.12, 1.62, CPU.z - 0.15])
  for (let i = 0; i < 8; i++) b.add('interior', box(0.01, 0.22, 0.03), [F - 0.245, 1.62, CPU.z - 0.64 + i * 0.14])
  b.add('heatsink', box(0.24, 1.3, 0.3, 0.5), [F - 0.12, 0.95, -1.42])
  for (let i = 0; i < 8; i++) b.add('interior', box(0.01, 0.03, 0.24), [F - 0.245, 0.42 + i * 0.15, -1.42])
  b.add('dark', box(0.32, 1.2, 0.3), [F - 0.16, 1.05, -1.66])
  b.add('glow', box(0.008, 1.05, 0.014), [F - 0.324, 1.05, -1.53])
  for (let i = 0; i < 10; i++) {
    b.add('heatsink', cylinder(0.028, 0.09, 14), [F - 0.045, 1.4, -1.25 + i * 0.095], [0, 0, Math.PI / 2])
  }

  b.add('heatsink', box(0.05, 0.22, 1.1, 0.4), [F - 0.025, 0.28, -0.85])
  b.add('glow', box(0.006, 0.012, 0.9), [F - 0.052, 0.2, -0.85])
  b.add('heatsink', box(0.05, 0.22, 1.0, 0.4), [F - 0.025, -0.95, -0.95])
  b.add('heatsink', box(0.06, 0.5, 0.52, 0.4), [F - 0.03, -0.92, 0.28])
  b.add('dark', box(0.012, 0.3, 0.32), [F - 0.066, -0.92, 0.28])
  b.add('plastic', box(0.05, 0.05, 0.92), [F - 0.025, -0.11, -1.05])
  b.add('plastic', box(0.12, 0.62, 0.1), [F - 0.06, 1.0, 0.53])
  b.add('plastic', box(0.1, 0.12, 0.26), [F - 0.05, 1.78, -1.62])

  // Graphics card
  const halfT = GPU.thickness / 2
  const gpuSide = GPU.x - GPU.depth / 2
  b.add('chassis', box(GPU.depth, 0.03, GPU.length, 1.2), [GPU.x, GPU.y + halfT - 0.015, GPU.z])
  b.add('plastic', box(GPU.depth - 0.04, 0.04, GPU.length - 0.06), [GPU.x, GPU.y + halfT - 0.05, GPU.z])
  b.add('dark', box(GPU.depth, GPU.thickness - 0.07, GPU.length), [GPU.x, GPU.y - 0.035, GPU.z])
  b.add('trim', box(0.012, 0.012, GPU.length), [gpuSide + 0.006, GPU.y + halfT - 0.072, GPU.z])
  b.add('trim', box(0.012, 0.012, GPU.length), [gpuSide + 0.006, GPU.y - halfT + 0.006, GPU.z])
  b.add('glow', box(0.01, 0.016, GPU.length - 0.2), [gpuSide - 0.004, GPU.y - halfT + 0.06, GPU.z])
  b.add('vent', box(GPU.depth - 0.1, 0.006, GPU.length - 0.2, 0.12), [GPU.x, GPU.y - halfT - 0.002, GPU.z])
  b.add('plastic', box(0.05, 0.1, 0.24), [gpuSide - 0.025, GPU.y + 0.16, 0.25])
  b.add('trim', box(GPU.depth, 0.7, 0.02), [GPU.x, GPU.y, GPU.z - GPU.length / 2 - 0.01])

  // Radiator
  b.add('fins', box(1.2, 0.2, 3.6, 0.1), [-0.1, 2.215, -0.1])
  for (const end of [-1, 1]) b.add('dark', box(1.24, 0.24, 0.12), [-0.1, 2.215, -0.1 + end * 1.86])

  // AIO tubes and fittings
  const tubeA = [
    [0.6, 1.1, CPU.z + 0.29],
    [0.38, 1.2, -0.3],
    [0.22, 1.5, 0.15],
    [0.08, 1.68, 0.9],
    [0.0, 1.8, 1.78],
    [-0.05, 2.14, 1.8],
  ]
  const tubeB = [
    [0.6, 0.9, CPU.z + 0.29],
    [0.36, 0.96, -0.26],
    [0.2, 1.36, 0.2],
    [0.0, 1.58, 0.95],
    [-0.15, 1.72, 1.78],
    [-0.2, 2.14, 1.8],
  ]
  for (const points of [tubeA, tubeB]) {
    b.add('tube', tubePath(points, 0.052))
    b.add('trim', cylinder(0.064, 0.07, 18), [points[0][0], points[0][1], points[0][2] - 0.01], [Math.PI / 2, 0, 0])
  }

  // White sleeved cables
  for (let i = 0; i < 6; i++) {
    const y = 0.76 + i * 0.096
    b.add(
      'cable',
      tubePath(
        [
          [F - 0.06, y, 0.58],
          [F - 0.1, y, 0.74],
          [F - 0.03, y + 0.02, 0.9],
          [0.98, y + 0.03, 0.98],
        ],
        0.021,
        24,
      ),
    )
  }
  for (let i = 0; i < 4; i++) {
    const z = 0.17 + i * 0.05
    b.add(
      'cable',
      tubePath(
        [
          [gpuSide - 0.05, GPU.y + 0.16, z],
          [-0.68, GPU.y + 0.12, z + 0.06],
          [-0.82, -0.8, z + 0.22],
          [-0.68, -1.15, z + 0.42],
          [-0.5, SHROUD.top + 0.02, z + 0.55],
        ],
        0.02,
        48,
      ),
    )
  }
  for (let i = 0; i < 4; i++) {
    const z = -1.7 + i * 0.05
    b.add(
      'cable',
      tubePath(
        [
          [F - 0.1, 1.78, z],
          [F - 0.17, 1.9, z - 0.06],
          [0.97, 1.97, z - 0.12],
        ],
        0.018,
        16,
      ),
    )
  }

  return b.build()
}

function fanGeometries() {
  const s = 0.6
  const c = 0.09
  const shape = new THREE.Shape()
  shape.moveTo(-s + c, -s)
  shape.lineTo(s - c, -s)
  shape.quadraticCurveTo(s, -s, s, -s + c)
  shape.lineTo(s, s - c)
  shape.quadraticCurveTo(s, s, s - c, s)
  shape.lineTo(-s + c, s)
  shape.quadraticCurveTo(-s, s, -s, s - c)
  shape.lineTo(-s, -s + c)
  shape.quadraticCurveTo(-s, -s, -s + c, -s)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.565, 0, TAU, true)
  shape.holes.push(hole)
  const frame = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false, curveSegments: 40 })
  frame.translate(0, 0, -0.125)

  const blade = new THREE.Shape()
  blade.moveTo(0.19, -0.06)
  blade.quadraticCurveTo(0.36, -0.13, 0.545, -0.05)
  blade.quadraticCurveTo(0.535, 0.12, 0.42, 0.2)
  blade.quadraticCurveTo(0.3, 0.12, 0.19, 0.08)
  blade.closePath()
  const bladeBase = new THREE.ExtrudeGeometry(blade, { depth: 0.014, bevelEnabled: false, curveSegments: 10 })
  bladeBase.translate(0, 0, -0.007)
  bladeBase.rotateX(0.5)
  const bladeParts = []
  for (let i = 0; i < 9; i++) {
    const g = bladeBase.clone()
    g.rotateZ((i / 9) * TAU)
    bladeParts.push(g)
  }
  const blades = mergeGeometries(bladeParts, false)
  bladeParts.forEach((g) => g.dispose())
  bladeBase.dispose()

  const hub = cylinder(0.19, 0.2, 40).rotateX(Math.PI / 2)
  const ringFront = torus(0.572, 0.012, 8, 96).translate(0, 0, 0.127)
  const ringBack = torus(0.572, 0.012, 8, 96).translate(0, 0, -0.127)
  const rings = mergeGeometries([ringFront, ringBack], false)
  ringFront.dispose()
  ringBack.dispose()

  return { frame, blades, hub, rings }
}

function chamfer(points, size) {
  const cleaned = []
  for (const p of points) {
    const prev = cleaned[cleaned.length - 1]
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-6) cleaned.push(p)
  }
  if (cleaned.length < 3) return cleaned
  const out = [cleaned[0]]
  for (let i = 1; i < cleaned.length - 1; i++) {
    const [ax, ay] = cleaned[i - 1]
    const [bx, by] = cleaned[i]
    const [cx, cy] = cleaned[i + 1]
    const l1 = Math.hypot(bx - ax, by - ay)
    const l2 = Math.hypot(cx - bx, cy - by)
    if (l1 < 1e-6 || l2 < 1e-6) {
      out.push([bx, by])
      continue
    }
    const k = Math.min(size, l1 * 0.45, l2 * 0.45)
    out.push([bx - ((bx - ax) / l1) * k, by - ((by - ay) / l1) * k], [bx + ((cx - bx) / l2) * k, by + ((cy - by) / l2) * k])
  }
  out.push(cleaned[cleaned.length - 1])
  return out
}

/** PCB copper traces as flat ribbons carrying distance-along-trace for the data pulses. */
function traceGeometry() {
  const rand = mulberry32(2718)
  const traces = []
  const zMin = BOARD.z - BOARD.width / 2 + 0.05
  const zMax = BOARD.z + BOARD.width / 2 - 0.05
  const yMin = BOARD.y - BOARD.height / 2 + 0.05
  const yMax = BOARD.y + BOARD.height / 2 - 0.05
  const clampPoint = ([z, y]) => [Math.min(zMax, Math.max(zMin, z)), Math.min(yMax, Math.max(yMin, y))]

  const socketEdge = CPU.z + 0.34
  for (let i = 0; i < 44; i++) {
    const y = CPU.y - 0.48 + (i / 43) * 0.96
    const dy = ((i % 7) - 3) * 0.016
    const bend = socketEdge + 0.05 + (i % 5) * 0.022
    const pts = [
      [socketEdge, y],
      [bend, y],
      [bend + Math.abs(dy), y + dy],
    ]
    let z = bend + Math.abs(dy)
    if (i % 3 === 0) {
      for (let k = 0; k < 3; k++) {
        pts.push([z + 0.012, y + dy + 0.022], [z + 0.024, y + dy])
        z += 0.024
      }
    }
    pts.push([RAM.slots[i % 4] - 0.03, y + dy])
    traces.push({ pts: chamfer(pts, 0.012), width: 0.0062 })
  }

  for (let i = 0; i < 18; i++) {
    const z = CPU.z - 0.27 + i * 0.03
    const jog = (i - 9) * 0.012
    traces.push({
      pts: chamfer(
        [
          [z, CPU.y - 0.33],
          [z, 0.5],
          [z + jog, 0.43],
          [z + jog, -0.08],
        ],
        0.02,
      ),
      width: 0.006,
    })
  }

  for (let i = 0; i < 78; i++) {
    let z = zMin + rand() * (zMax - zMin)
    let y = yMin + rand() * (yMax - yMin)
    const pts = [[z, y]]
    let horizontal = rand() > 0.5
    const segments = 2 + Math.floor(rand() * 4)
    for (let s = 0; s < segments; s++) {
      const len = 0.08 + rand() * 0.55
      const sign = rand() > 0.5 ? 1 : -1
      if (horizontal) z += len * sign
      else y += len * sign
      ;[z, y] = clampPoint([z, y])
      pts.push([z, y])
      horizontal = !horizontal
    }
    traces.push({ pts: chamfer(pts, 0.03), width: 0.004 + rand() * 0.0065 })
  }

  const x = BOARD_FACE - 0.0016
  const positions = []
  const dist = []
  const length = []
  const seed = []
  const indices = []
  for (const trace of traces) {
    const pts = trace.pts
    const cumulative = [0]
    for (let i = 1; i < pts.length; i++) {
      cumulative.push(cumulative[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    }
    const total = cumulative[cumulative.length - 1]
    if (total < 0.03) continue
    const s = rand()
    const hw = trace.width / 2
    for (let i = 1; i < pts.length; i++) {
      const [z0, y0] = pts[i - 1]
      const [z1, y1] = pts[i]
      const len = Math.hypot(z1 - z0, y1 - y0)
      if (len < 1e-5) continue
      const dz = (z1 - z0) / len
      const dy = (y1 - y0) / len
      const nz = -dy * hw
      const ny = dz * hw
      const az = z0 - dz * hw
      const ay = y0 - dy * hw
      const bz = z1 + dz * hw
      const by = y1 + dy * hw
      const base = positions.length / 3
      const corners = [
        [az + nz, ay + ny, cumulative[i - 1]],
        [az - nz, ay - ny, cumulative[i - 1]],
        [bz + nz, by + ny, cumulative[i]],
        [bz - nz, by - ny, cumulative[i]],
      ]
      for (const [cz, cy, d] of corners) {
        positions.push(x, cy, cz)
        dist.push(d)
        length.push(total)
        seed.push(s)
      }
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1))
  geometry.setAttribute('aLen', new THREE.Float32BufferAttribute(length, 1))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

const traceVertex = /* glsl */ `
  attribute float aDist;
  attribute float aLen;
  attribute float aSeed;
  varying float vDist;
  varying float vLen;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vDist = aDist;
    vLen = aLen;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const traceFragment = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  uniform float uSpeed;
  uniform float uFog;
  varying float vDist;
  varying float vLen;
  varying float vSeed;
  varying float vDepth;

  void main() {
    float velocity = 0.3 + vSeed * 0.28 + uSpeed * 2.6;
    float period = vLen + 0.45 + vSeed * 0.7;
    float head = mod(uTime * velocity + vSeed * 17.0, period);
    float behind = head - vDist;
    float tail = 0.12 + uSpeed * 0.32;
    float pulse = step(0.0, behind) * (1.0 - smoothstep(0.0, tail, behind)) * step(0.33, vSeed);
    float lit = 0.07 + 0.05 * uGlow + pulse * (0.35 + 0.65 * uGlow) * (0.7 + uSpeed * 0.7);
    float fog = exp(-pow(uFog * vDepth, 2.0));
    gl_FragColor = vec4(vec3(lit * fog), 1.0);
    #include <colorspace_fragment>
  }
`

/* ───────────────────────────── Component ───────────────────────────── */

function createAssets(logo) {
  const aspect = logo.image ? logo.image.width / logo.image.height : 1.52
  const textures = {
    brushed: brushedTexture(),
    vent: ventTexture(),
    fins: finTexture(),
    pcb: pcbTexture(),
    gpuPlate: gpuPlateTexture(logo.image, aspect),
    shroudPlate: shroudPlateTexture(),
    radial: radialTexture(),
    streak: streakTexture(),
  }
  const materials = createMaterials(textures)
  const logoW = FRONT_LOGO.width
  const logoH = logoW / aspect
  const halo = logoGlowTexture(logo.image, logoW, logoH, logoW * 0.55)
  textures.halo = halo.texture

  materials.gpuPlate = new THREE.MeshBasicMaterial({
    map: textures.gpuPlate,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  materials.shroudPlate = new THREE.MeshBasicMaterial({
    map: textures.shroudPlate,
    color: new THREE.Color(0.82, 0.82, 0.82),
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  materials.halo = new THREE.MeshBasicMaterial({
    map: textures.halo,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.6,
  })
  materials.flare = new THREE.SpriteMaterial({
    map: textures.radial,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  })
  materials.streak = new THREE.SpriteMaterial({
    map: textures.streak,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  })
  materials.traces = new THREE.ShaderMaterial({
    vertexShader: traceVertex,
    fragmentShader: traceFragment,
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: rig.glow },
      uSpeed: { value: 0 },
      uFog: { value: rig.fog },
    },
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  const geometries = {
    parts: buildStaticParts(),
    fan: fanGeometries(),
    traces: traceGeometry(),
    sideGlass: new THREE.BoxGeometry(0.03, 4.62, 4.42),
    frontGlass: new THREE.BoxGeometry(2.3, 4.66, 0.035),
    shroudSide: new THREE.BoxGeometry(0.04, SHROUD.top - SHROUD.bottom, 4.12),
    pumpCap: new THREE.CylinderGeometry(PUMP.radius - 0.05, PUMP.radius - 0.05, 0.012, 56).rotateZ(Math.PI / 2),
    gpuPlate: new THREE.PlaneGeometry(2.0, 0.125).rotateY(-Math.PI / 2),
    shroudPlate: new THREE.PlaneGeometry(2.5, 0.3125).rotateY(-Math.PI / 2),
    halo: new THREE.PlaneGeometry(halo.planeW, halo.planeH),
  }

  const frit = createBuilder()
  frit.add('frit', box(0.003, 0.18, 4.42), [0.0165, 2.22, 0])
  frit.add('frit', box(0.003, 0.18, 4.42), [0.0165, -2.22, 0])
  frit.add('frit', box(0.003, 4.26, 0.16), [0.0165, 0, 2.13])
  frit.add('frit', box(0.003, 4.26, 0.16), [0.0165, 0, -2.13])
  frit.add('edge', box(0.03, 0.004, 4.42), [0, 2.312, 0])
  frit.add('edge', box(0.03, 0.004, 4.42), [0, -2.312, 0])
  frit.add('edge', box(0.03, 4.62, 0.004), [0, 0, 2.212])
  frit.add('edge', box(0.03, 4.62, 0.004), [0, 0, -2.212])
  const panelParts = frit.build()
  geometries.panelFrit = panelParts.frit
  geometries.panelEdge = panelParts.edge

  return { aspect, textures, materials, geometries, logoW, logoH }
}

function disposeAssets({ textures, materials, geometries }) {
  for (const t of Object.values(textures)) t.dispose()
  for (const m of Object.values(materials)) m.dispose()
  for (const g of Object.values(geometries.parts)) g.dispose()
  for (const g of Object.values(geometries.fan)) g.dispose()
  for (const [key, g] of Object.entries(geometries)) if (key !== 'parts' && key !== 'fan') g.dispose()
}

function FanArray({ geometry, materials, bladesRef }) {
  const frames = useRef(null)
  const hubs = useRef(null)
  const rings = useRef(null)

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    FAN_SLOTS.forEach((slot, i) => {
      m.compose(_pos.set(...slot.position), _quat.setFromEuler(_euler.set(...slot.rotation)), _scale)
      for (const mesh of [frames.current, hubs.current, rings.current, bladesRef.current]) mesh.setMatrixAt(i, m)
    })
    for (const mesh of [frames.current, hubs.current, rings.current, bladesRef.current]) mesh.instanceMatrix.needsUpdate = true
  }, [bladesRef])

  const count = FAN_SLOTS.length
  return (
    <>
      <instancedMesh ref={frames} args={[geometry.frame, materials.plastic, count]} frustumCulled={false} />
      <instancedMesh ref={hubs} args={[geometry.hub, materials.dark, count]} frustumCulled={false} />
      <instancedMesh ref={rings} args={[geometry.rings, materials.glow, count]} frustumCulled={false} />
      <instancedMesh ref={bladesRef} args={[geometry.blades, materials.blade, count]} frustumCulled={false} />
    </>
  )
}

export default function PCModel() {
  const logo = useTexture(LOGO_URL)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const assets = useMemo(() => {
    logo.colorSpace = THREE.SRGBColorSpace
    logo.anisotropy = 8
    return createAssets(logo)
  }, [logo])
  useEffect(() => () => disposeAssets(assets), [assets])

  const { aspect, materials, geometries, logoW, logoH } = assets
  const root = useRef(null)
  const tower = useRef(null)
  const panel = useRef(null)
  const blades = useRef(null)
  const halo = useRef(null)
  const flare = useRef(null)
  const streak = useRef(null)
  const logoLight = useRef(null)
  const interiorLight = useRef(null)
  const lowerLight = useRef(null)
  const frontLogoMat = useRef(null)
  const capLogoMat = useRef(null)
  const shroudLogoMat = useRef(null)

  const scratch = useMemo(
    () => ({
      spin: 0,
      bladeMatrix: new THREE.Matrix4(),
      slotMatrices: FAN_SLOTS.map((slot) =>
        new THREE.Matrix4().compose(
          new THREE.Vector3(...slot.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...slot.rotation)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
      rotation: new THREE.Matrix4(),
      world: new THREE.Vector3(),
      ndc: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const f = rig.float
    const shell = THREE.MathUtils.clamp(rig.shell, 0, 1)
    root.current.visible = shell > 0.02
    if (shell <= 0.02) return
    root.current.scale.setScalar(0.86 + shell * 0.14)

    root.current.position.y = Math.sin(t * 0.8) * 0.11 * f
    root.current.rotation.x = Math.sin(t * 0.5 + 1.3) * 0.016 * f
    root.current.rotation.z = Math.cos(t * 0.62) * 0.012 * f
    tower.current.rotation.y = rig.yaw + Math.sin(t * 0.3) * 0.05 * f

    const p = rig.panel
    const pop = smooth01(p / 0.3)
    const swing = smooth01((p - 0.2) / 0.8)
    const bob = Math.sin(t * 0.9) * 0.035 * swing
    panel.current.position.set(-HALF.x + 0.018 - 0.45 * pop - 0.55 * swing, 0.3 * swing + bob, 2.6 * swing)
    panel.current.rotation.set(0.05 * swing, 0.9 * swing, 0.03 * swing)

    scratch.spin += dt * (7 + rig.speed * 18)
    FAN_SLOTS.forEach((_, i) => {
      scratch.rotation.makeRotationZ(scratch.spin + i * 0.7)
      scratch.bladeMatrix.multiplyMatrices(scratch.slotMatrices[i], scratch.rotation)
      blades.current.setMatrixAt(i, scratch.bladeMatrix)
    })
    blades.current.instanceMatrix.needsUpdate = true

    const glow = rig.glow
    const flash = rig.flash
    materials.glow.color.setScalar(Math.min(1, 0.5 + glow * 0.45))
    materials.cable.emissiveIntensity = 0.04 + glow * 0.05
    const u = materials.traces.uniforms
    u.uTime.value = t
    u.uGlow.value = glow
    u.uSpeed.value = rig.speed
    u.uFog.value = rig.fog

    frontLogoMat.current.emissiveIntensity = 0.75 + rig.logo * 1.25 + flash * 3
    capLogoMat.current.emissiveIntensity = 0.7 + glow * 0.9
    shroudLogoMat.current.emissiveIntensity = 0.55 + glow * 0.6
    interiorLight.current.intensity = 5.5 * glow
    lowerLight.current.intensity = 2.4 * glow

    halo.current.material.opacity = Math.min(1, 0.32 + rig.logo * 0.3 + flash * 0.9)
    halo.current.scale.setScalar(1 + flash * 0.55)

    root.current.updateMatrixWorld(true)
    const world = scratch.world
    world.set(0, FRONT_LOGO.y, HALF.z + 0.12).applyMatrix4(tower.current.matrixWorld)
    rig.logoX = world.x
    rig.logoY = world.y
    rig.logoZ = world.z

    logoLight.current.position.copy(world)
    logoLight.current.intensity = 0.8 * rig.logo + flash * 70
    flare.current.position.copy(world)
    streak.current.position.copy(world)
    const flareVisible = flash > 0.004
    flare.current.visible = flareVisible
    streak.current.visible = flareVisible
    if (flareVisible) {
      flare.current.material.opacity = Math.min(1, flash * 1.2)
      flare.current.scale.setScalar(3 + flash * 16)
      streak.current.material.opacity = Math.min(1, flash * 1.1)
      streak.current.scale.set(6 + flash * 46, 0.22 + flash * 0.5, 1)
    }

    const project = (local, out) => {
      scratch.ndc.set(...local).applyMatrix4(tower.current.matrixWorld).project(camera)
      const v = scratch.ndc
      out.visible = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15
      out.x = (v.x * 0.5 + 0.5) * size.width
      out.y = (-v.y * 0.5 + 0.5) * size.height
    }
    project(POINTS.pumpTop, anchors.cpu)
    project(POINTS.gpuEdge, anchors.gpu)
  })

  const g = geometries.parts
  const decalDepth = 0.02

  return (
    <group ref={root}>
      <group ref={tower} rotation={[0, rig.yaw, 0]}>
        <mesh geometry={g.chassis} material={materials.chassis} />
        <mesh geometry={g.interior} material={materials.interior} />
        <mesh geometry={g.trim} material={materials.trim} />
        <mesh geometry={g.heatsink} material={materials.heatsink} />
        <mesh geometry={g.dark} material={materials.dark} />
        <mesh geometry={g.plastic} material={materials.plastic} />
        <mesh geometry={g.rubber} material={materials.rubber} />
        <mesh geometry={g.vent} material={materials.vent} />
        <mesh geometry={g.fins} material={materials.fins} />
        <mesh geometry={g.pcb} material={materials.pcb} />
        <mesh geometry={g.tube} material={materials.tube} />
        <mesh geometry={g.cable} material={materials.cable} />
        <mesh geometry={g.glow} material={materials.glow} />
        <mesh geometry={geometries.traces} material={materials.traces} />

        <FanArray geometry={geometries.fan} materials={materials} bladesRef={blades} />

        <mesh geometry={geometries.pumpCap} material={materials.capGlass} position={[PUMP_TOP - 0.004, CPU.y, CPU.z]}>
          <Decal
            position={[-0.006, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[0.3, 0.3 / aspect, 0.01]}
            map={logo}
            depthTest
            polygonOffsetFactor={-4}
            renderOrder={1}
          >
            <meshStandardMaterial
              ref={capLogoMat}
              map={logo}
              color="#000000"
              emissive="#ffffff"
              emissiveMap={logo}
              emissiveIntensity={1.4}
              transparent
              depthWrite={false}
              toneMapped={false}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </Decal>
        </mesh>

        <mesh geometry={geometries.shroudSide} material={materials.interior} position={[SHROUD.outer + 0.02, SHROUD_MID, -0.16]}>
          <Decal
            position={[-0.02, 0, -1.42]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[0.5, 0.5 / aspect, decalDepth]}
            map={logo}
            depthTest
            polygonOffsetFactor={-4}
            renderOrder={1}
          >
            <meshStandardMaterial
              ref={shroudLogoMat}
              map={logo}
              color="#000000"
              emissive="#ffffff"
              emissiveMap={logo}
              emissiveIntensity={1}
              transparent
              depthWrite={false}
              toneMapped={false}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </Decal>
        </mesh>
        <mesh geometry={geometries.shroudPlate} material={materials.shroudPlate} position={[SHROUD.outer - 0.003, SHROUD_MID, 0.18]} renderOrder={1} />
        <mesh
          geometry={geometries.gpuPlate}
          material={materials.gpuPlate}
          position={[GPU.x - GPU.depth / 2 - 0.003, GPU.y + 0.03, GPU.z + 0.25]}
          renderOrder={1}
        />

        <mesh geometry={geometries.frontGlass} material={materials.glassSmoked} position={[0, 0, HALF.z - 0.0195]} renderOrder={2}>
          <Decal
            position={[0, FRONT_LOGO.y, 0.0175]}
            rotation={[0, 0, 0]}
            scale={[logoW, logoH, decalDepth]}
            map={logo}
            depthTest
            polygonOffsetFactor={-4}
            renderOrder={3}
          >
            <meshStandardMaterial
              ref={frontLogoMat}
              map={logo}
              color="#000000"
              emissive="#ffffff"
              emissiveMap={logo}
              emissiveIntensity={2}
              roughness={0.2}
              metalness={0}
              transparent
              depthWrite={false}
              toneMapped={false}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </Decal>
        </mesh>
        <mesh ref={halo} geometry={geometries.halo} material={materials.halo} position={[0, FRONT_LOGO.y, HALF.z + 0.006]} renderOrder={4} />

        <group ref={panel} position={[-HALF.x + 0.018, 0, 0]}>
          <mesh geometry={geometries.sideGlass} material={materials.glassClear} renderOrder={2} />
          <mesh geometry={geometries.panelFrit} material={materials.frit} />
          <mesh geometry={geometries.panelEdge} material={materials.trim} />
        </group>

        <pointLight ref={interiorLight} position={[-0.35, 0.65, 0.1]} intensity={4} distance={6} decay={2} color="#ffffff" />
        <pointLight ref={lowerLight} position={[-0.55, -0.95, 0.6]} intensity={2} distance={3.5} decay={2} color="#ffffff" />
      </group>

      <pointLight ref={logoLight} intensity={1} distance={16} decay={1.6} color="#ffffff" />
      <sprite ref={flare} material={materials.flare} renderOrder={6} visible={false} />
      <sprite ref={streak} material={materials.streak} renderOrder={6} visible={false} />
    </group>
  )
}

useTexture.preload(LOGO_URL)
