import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOGO_STAGE, rig, socialRig } from '../lib/rig'

const COUNT = 5600
const SAMPLE = 420
const SCALE = 1.38

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Same silhouette sampling as the Asterion socials marks, drawn in white. */
const DRAW = [
  function tiktok(ctx, s) {
    const path = new Path2D(
      'M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z',
    )
    const vbW = 448
    const vbH = 512
    const scale = (s * 0.84) / vbH
    const ox = (s - vbW * scale) / 2
    const oy = (s - vbH * scale) / 2
    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.translate(ox, oy)
    ctx.scale(scale, scale)
    ctx.fill(path)
    ctx.restore()
  },
  function instagram(ctx, s) {
    const m = s * 0.14
    const box = s - m * 2
    ctx.strokeStyle = '#fff'
    ctx.fillStyle = '#fff'
    ctx.lineWidth = box * 0.11
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    roundRect(ctx, m, m, box, box, box * 0.28)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s * 0.5, s * 0.5, box * 0.23, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(m + box * 0.78, m + box * 0.22, box * 0.055, 0, Math.PI * 2)
    ctx.fill()
  },
  function youtube(ctx, s) {
    const pad = s * 0.12
    const w = s - pad * 2
    const h = w * 0.7
    const x = (s - w) / 2
    const y = (s - h) / 2
    ctx.fillStyle = '#fff'
    roundRect(ctx, x, y, w, h, h * 0.2)
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    const cx = x + w * 0.42
    const cy = y + h * 0.5
    const tw = w * 0.18
    const th = h * 0.26
    ctx.moveTo(cx - tw * 0.2, cy - th)
    ctx.lineTo(cx + tw, cy)
    ctx.lineTo(cx - tw * 0.2, cy + th)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  },
  function discord(ctx, s) {
    const path = new Path2D(
      'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25-1.845-.276-3.68-.276-5.487 0-.164-.393-.406-.874-.618-1.25a.077.077 0 0 0-.078-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.106c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.175 1.095 2.156 2.419 0 1.333-.946 2.419-2.156 2.419z',
    )
    const vb = 24
    const scale = (s * 0.78) / vb
    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.translate((s - vb * scale) / 2, (s - vb * scale) / 2)
    ctx.scale(scale, scale)
    ctx.fill(path)
    ctx.restore()
  },
]

function sampleIcon(draw, seed) {
  const S = SAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, S, S)
  draw(ctx, S)
  const data = ctx.getImageData(0, 0, S, S).data
  const rand = mulberry32(seed)
  const xs = []
  const ys = []
  const es = []
  const cum = []
  let acc = 0

  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const a = data[(y * S + x) * 4 + 3]
      if (a < 120) continue
      const n =
        (data[((y - 1) * S + x) * 4 + 3] < 120 ? 1 : 0) +
        (data[((y + 1) * S + x) * 4 + 3] < 120 ? 1 : 0) +
        (data[(y * S + x - 1) * 4 + 3] < 120 ? 1 : 0) +
        (data[(y * S + x + 1) * 4 + 3] < 120 ? 1 : 0)
      const edge = n > 0
      if (rand() > (edge ? 0.98 : 0.72)) continue
      const w = edge ? 1.8 : 1.35
      xs.push((x / S - 0.5) * 2)
      ys.push((0.5 - y / S) * 2)
      es.push(edge ? 1 : 0)
      acc += w
      cum.push(acc)
    }
  }
  return { xs, ys, es, cum, acc }
}

function pick(samples, rand) {
  const { xs, ys, es, cum, acc } = samples
  const t = rand() * acc
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < t) lo = mid + 1
    else hi = mid
  }
  return { x: xs[lo], y: ys[lo], edge: es[lo] }
}

function buildField() {
  const shapes = DRAW.map((draw, index) => {
    const samples = sampleIcon(draw, 400 + index * 17)
    const rand = mulberry32(80 + index * 13)
    const pos = new Float32Array(COUNT * 3)
    const edge = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      const s = pick(samples, rand)
      const j = s.edge ? 0.004 : 0.01
      pos[i * 3] = (s.x + (rand() - 0.5) * j) * SCALE
      pos[i * 3 + 1] = (s.y + (rand() - 0.5) * j) * SCALE
      pos[i * 3 + 2] = (s.edge ? 0.02 : 0) + (rand() - 0.5) * 0.04
      edge[i] = s.edge
    }
    return { pos, edge }
  })

  const seed = new Float32Array(COUNT)
  const rand = mulberry32(7)
  for (let i = 0; i < COUNT; i++) seed[i] = rand()

  return {
    shapes,
    seed,
    current: new Float32Array(COUNT * 3),
    edge: new Float32Array(COUNT),
  }
}

const vertexShader = /* glsl */ `
  attribute float aEdge;
  varying float vEdge;
  void main() {
    vEdge = aEdge;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float size = mix(4.0, 6.4, aEdge);
    gl_PointSize = size * (9.2 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vEdge;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    float disc = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.28, 0.0, d);
    float alpha = (disc * mix(0.55, 0.95, vEdge) + core * mix(0.45, 0.85, vEdge)) * uOpacity;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const glowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    float glow = smoothstep(1.0, 0.0, d);
    float alpha = glow * glow * 0.16 * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`

export default function SocialParticles() {
  const group = useRef(null)
  const points = useRef(null)
  const glow = useRef(null)
  const field = useMemo(() => buildField(), [])
  const fade = useRef(0)
  const activeId = useRef(0)
  const clock = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(field.current.slice(), 3))
    geo.setAttribute('aEdge', new THREE.BufferAttribute(field.edge.slice(), 1))
    return geo
  }, [field])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033)
    const appear = THREE.MathUtils.clamp(rig.social, 0, 1)
    const id = appear > 0.45 ? socialRig.id : 0
    const want = id > 0 ? 1 : 0
    fade.current += (want - fade.current) * (1 - Math.exp(-(want ? 7.5 : 11) * dt))
    const shown = fade.current
    const visible = shown > 0.015 && appear > 0.2
    group.current.visible = visible
    if (!visible) {
      activeId.current = 0
      return
    }

    if (id > 0 && id !== activeId.current && shown < 0.2) {
      const shape = field.shapes[id - 1]
      const cur = field.current
      for (let i = 0; i < COUNT; i++) {
        const o = i * 3
        const kick = (field.seed[i] - 0.5) * 0.26
        cur[o] = shape.pos[o] + kick
        cur[o + 1] = shape.pos[o + 1] + kick * 0.65
        cur[o + 2] = shape.pos[o + 2]
      }
    }
    if (id > 0) activeId.current = id

    const shape = field.shapes[(activeId.current || 1) - 1]
    const blend = 1 - Math.exp(-10 * dt)
    clock.current += dt
    const t = clock.current
    const pos = points.current.geometry.attributes.position
    const edgeAttr = points.current.geometry.attributes.aEdge
    const arr = pos.array
    const edges = edgeAttr.array
    const cur = field.current

    for (let i = 0; i < COUNT; i++) {
      const o = i * 3
      const sway = Math.sin(t * 0.85 + field.seed[i] * 12.0) * 0.006
      cur[o] += (shape.pos[o] - cur[o]) * blend
      cur[o + 1] += (shape.pos[o + 1] - cur[o + 1]) * blend
      cur[o + 2] += (shape.pos[o + 2] - cur[o + 2]) * blend
      edges[i] += (shape.edge[i] - edges[i]) * blend
      arr[o] = cur[o] + sway
      arr[o + 1] = cur[o + 1] + sway * 0.45
      arr[o + 2] = cur[o + 2]
    }
    pos.needsUpdate = true
    edgeAttr.needsUpdate = true
    points.current.material.uniforms.uOpacity.value = shown
    glow.current.material.uniforms.uOpacity.value = shown
  })

  return (
    <group ref={group} position={[LOGO_STAGE.x, LOGO_STAGE.y, LOGO_STAGE.z]} visible={false}>
      <mesh ref={glow} position={[0, 0, -0.15]}>
        <circleGeometry args={[1.85, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          uniforms={{ uOpacity: { value: 0 } }}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
        />
      </mesh>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          uniforms={{ uOpacity: { value: 0 } }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </points>
    </group>
  )
}
