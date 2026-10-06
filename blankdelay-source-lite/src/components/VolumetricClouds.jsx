import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { quality } from '../lib/quality'
import { rig } from '../lib/rig'

const TAU = Math.PI * 2
const ATLAS_SIZE = 256

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

const smoothstep = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
  return t * t * (3 - 2 * t)
}

const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x, y) {
  let value = 0
  let amp = 0.5
  let freq = 1
  for (let o = 0; o < 3; o++) {
    value += amp * valueNoise(x * freq, y * freq)
    freq *= 2.03
    amp *= 0.5
  }
  return value / 0.875
}

/**
 * 2x2 atlas of eroded cumulus density fields.
 * RG = density gradient (pseudo surface normal), B = unused, A = density.
 */
function createCloudAtlas() {
  const size = ATLAS_SIZE
  const cell = size / 2
  const density = new Float32Array(size * size)
  const rand = mulberry32(1701)

  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * cell
    const oy = Math.floor(v / 2) * cell
    const puffs = Array.from({ length: 16 + Math.floor(rand() * 8) }, () => {
      const a = rand() * TAU
      const r = Math.pow(rand(), 0.8) * 0.42
      const rx = 0.16 + rand() * 0.2
      return {
        x: Math.cos(a) * r * 1.2,
        y: Math.sin(a) * r * 0.7 + 0.04,
        rx,
        ry: rx * (0.7 + rand() * 0.35),
        w: 0.55 + rand() * 0.6,
      }
    })
    const nx = rand() * 100
    const ny = rand() * 100

    for (let j = 0; j < cell; j++) {
      const y = ((j + 0.5) / cell) * 2 - 1
      for (let i = 0; i < cell; i++) {
        const x = ((i + 0.5) / cell) * 2 - 1
        let sum = 0
        for (let p = 0; p < puffs.length; p++) {
          const pf = puffs[p]
          const dx = (x - pf.x) / pf.rx
          const dy = (y - pf.y) / pf.ry
          sum += pf.w * Math.exp(-(dx * dx + dy * dy))
        }
        let d = 1 - Math.exp(-sum * 1.3)
        const n = fbm(x * 2.4 + nx, y * 2.4 + ny)
        d = smoothstep(0.12, 0.95, d - (n - 0.5) * 0.6)
        d *= 1 - smoothstep(0.72, 0.98, Math.sqrt(x * x + y * y))
        density[(oy + j) * size + ox + i] = d
      }
    }
  }

  const data = new Uint8Array(size * size * 4)
  const gain = cell / 9
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * cell
    const oy = Math.floor(v / 2) * cell
    const at = (i, j) =>
      density[(oy + Math.min(Math.max(j, 0), cell - 1)) * size + ox + Math.min(Math.max(i, 0), cell - 1)]
    for (let j = 0; j < cell; j++) {
      for (let i = 0; i < cell; i++) {
        const gx = Math.max(-1, Math.min(1, (at(i + 1, j) - at(i - 1, j)) * 0.5 * gain))
        const gy = Math.max(-1, Math.min(1, (at(i, j + 1) - at(i, j - 1)) * 0.5 * gain))
        const d = at(i, j)
        const idx = ((oy + j) * size + ox + i) * 4
        data[idx] = Math.round((gx * 0.5 + 0.5) * 255)
        data[idx + 1] = Math.round((gy * 0.5 + 0.5) * 255)
        data[idx + 2] = Math.round(d * 255)
        data[idx + 3] = Math.round(d * 255)
      }
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function buildCloudField() {
  const rand = mulberry32(90210)
  const clouds = []
  const push = (c) =>
    clouds.push({ ...c, variant: Math.floor(rand() * 4), rot: (rand() - 0.5) * 0.7, seed: rand(), depth: 0 })

  // Clear pocket around the tower, then a dark shell the camera can fly through.
  for (let i = 0; i < 240; i++) {
    const a = rand() * TAU
    const e = (rand() - 0.5) * 1.1
    const r = 16 + Math.pow(rand(), 0.65) * 48
    const w = 10 + rand() * 28
    push({
      x: Math.cos(a) * r * 1.15,
      y: Math.sin(e) * r * 0.55,
      z: Math.sin(a) * r * 1.15,
      w,
      h: w * (0.5 + rand() * 0.28),
      alpha: 0.78,
    })
  }

  // Fore/aft tunnel so zooming into the case feels like plunging through clouds.
  for (let i = 0; i < 220; i++) {
    const z = -8 - rand() * 70
    const a = rand() * TAU
    const r = 9 + Math.pow(rand(), 0.7) * 36
    const w = 8 + rand() * 22
    push({
      x: Math.cos(a) * r * 1.25,
      y: Math.sin(a) * r * 0.7,
      z,
      w,
      h: w * (0.55 + rand() * 0.25),
      alpha: 0.7,
    })
  }

  return clouds
}

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec2 aScale;
  attribute float aRot;
  attribute float aVariant;
  attribute float aAlpha;
  attribute float aSeed;

  uniform float uTime;

  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vViewPos;
  varying float vAlpha;
  varying float vRot;

  void main() {
    vec2 cell = vec2(mod(aVariant, 2.0), floor(aVariant / 2.0));
    vUv = (uv + cell) * 0.5;
    vLocal = uv - 0.5;

    vec3 center = aOffset;
    center.x += sin(uTime * 0.05 + aSeed * 31.0) * 1.6;
    center.y += cos(uTime * 0.04 + aSeed * 17.0) * 0.9;

    vec4 mv = modelViewMatrix * vec4(center, 1.0);
    float rot = aRot + uTime * 0.012 * (aSeed - 0.5);
    float c = cos(rot);
    float s = sin(rot);
    vec2 q = position.xy * aScale;
    mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);

    vViewPos = mv.xyz;
    vRot = rot;
    float extent = max(aScale.x, aScale.y);
    vAlpha = aAlpha * smoothstep(0.5, 0.5 + extent * 0.32, -mv.z);

    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLightView;
  uniform float uLightIntensity;
  uniform float uLightRange;
  uniform float uFogDensity;
  uniform float uOpacity;
  uniform vec3 uShadow;
  uniform vec3 uBody;
  uniform vec3 uRim;

  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vViewPos;
  varying float vAlpha;
  varying float vRot;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    float d = tex.a;
    float mask = smoothstep(0.5, 0.36, length(vLocal));
    float alpha = d * mask * vAlpha * uOpacity;
    if (alpha < 0.004) discard;

    vec2 g = tex.rg * 2.0 - 1.0;
    float c = cos(vRot);
    float s = sin(vRot);
    g = vec2(c * g.x - s * g.y, s * g.x + c * g.y);
    vec3 N = normalize(vec3(-g * 2.2, 0.55 + d * 0.8));

    vec3 toLight = uLightView - vViewPos;
    float dist = length(toLight);
    vec3 L = toLight / dist;
    vec3 V = normalize(-vViewPos);
    float atten = uLightIntensity / (1.0 + pow(dist / uLightRange, 2.0));

    float ndl = dot(N, L);
    float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    float forward = clamp(dot(-V, L), 0.0, 1.0);
    float phase = pow(forward, 14.0) * 0.8 + pow(forward, 80.0) * 2.6;

    // Only the rims that face the light on screen catch the silver lining.
    vec2 gDir = g / max(length(g), 0.0001);
    vec2 lDir = L.xy / max(length(L.xy), 0.0001);
    float rimFacing = clamp(dot(-gDir, lDir), 0.0, 1.0);
    float edge = smoothstep(0.0, 0.45, d) * (1.0 - smoothstep(0.45, 1.0, d));
    float silver = phase * edge * mix(0.1, 1.0, rimFacing) * 2.6 + phase * 0.08;
    float spec = pow(max(ndl, 0.0), 6.0);
    float sky = clamp(N.y, 0.0, 1.0) * 0.12;

    vec3 col = mix(uShadow, uBody, clamp(wrap * atten * 1.25 + sky, 0.0, 1.0));
    col += uRim * (silver + spec * 0.35) * atten;

    float depth = -vViewPos.z;
    float fog = 1.0 - exp(-pow(uFogDensity * depth, 2.0));
    col = mix(col, vec3(0.0), fog);

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

export default function VolumetricClouds() {
  const { geometry, material, clouds, buffers, order, lightWorld, lightView, forward } = useMemo(() => {
    const clouds = buildCloudField()
    const count = clouds.length

    const plane = new THREE.PlaneGeometry(1, 1)
    const geometry = new THREE.InstancedBufferGeometry()
    geometry.index = plane.index
    geometry.setAttribute('position', plane.attributes.position)
    geometry.setAttribute('uv', plane.attributes.uv)

    const buffers = {
      offset: new Float32Array(count * 3),
      scale: new Float32Array(count * 2),
      rot: new Float32Array(count),
      variant: new Float32Array(count),
      alpha: new Float32Array(count),
      seed: new Float32Array(count),
    }
    const attach = (name, array, size) => {
      const attr = new THREE.InstancedBufferAttribute(array, size)
      attr.setUsage(THREE.DynamicDrawUsage)
      geometry.setAttribute(name, attr)
    }
    attach('aOffset', buffers.offset, 3)
    attach('aScale', buffers.scale, 2)
    attach('aRot', buffers.rot, 1)
    attach('aVariant', buffers.variant, 1)
    attach('aAlpha', buffers.alpha, 1)
    attach('aSeed', buffers.seed, 1)
    geometry.instanceCount = count

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: createCloudAtlas() },
        uTime: { value: 0 },
        uLightView: { value: new THREE.Vector3() },
        uLightIntensity: { value: 1 },
        uLightRange: { value: 300 },
        uFogDensity: { value: rig.fog },
        uOpacity: { value: 1 },
        uShadow: { value: new THREE.Color('#060606') },
        uBody: { value: new THREE.Color('#4a4a4a') },
        uRim: { value: new THREE.Color('#ffffff') },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
    })

    return {
      geometry,
      material,
      clouds,
      buffers,
      order: clouds.map((_, i) => i),
      lightWorld: new THREE.Vector3(0, 0.4, 0.6),
      lightView: new THREE.Vector3(),
      forward: new THREE.Vector3(),
    }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.uniforms.uMap.value.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const mesh = useRef(null)

  useFrame(({ camera, clock }) => {
    const opacity = rig.clouds
    const visible = opacity > 0.012
    mesh.current.visible = visible
    if (!visible) return

    camera.updateMatrixWorld()
    const u = material.uniforms
    u.uTime.value = clock.elapsedTime
    u.uOpacity.value = opacity
    u.uFogDensity.value = rig.fog
    u.uLightIntensity.value = 0.55 + rig.logo * 0.9 + rig.glow * 0.45 + rig.flash * 2.4
    lightWorld.set(rig.logoX, rig.logoY, rig.logoZ)
    u.uLightView.value.copy(lightView.copy(lightWorld).applyMatrix4(camera.matrixWorldInverse))

    camera.getWorldDirection(forward)
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z
    const drift = rig.travel * 14

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      const wz = c.z + drift
      c.depth = (c.x - cx) * forward.x + (c.y - cy) * forward.y + (wz - cz) * forward.z
    }
    order.sort((a, b) => clouds[b].depth - clouds[a].depth)

    const budget = quality.clouds
    let inFront = 0
    for (let k = 0; k < order.length; k++) {
      if (clouds[order[k]].depth > -8) inFront += 1
    }
    const skip = Math.max(0, inFront - budget)
    const { offset, scale, rot, variant, alpha, seed } = buffers
    let seen = 0
    let n = 0
    for (let k = 0; k < order.length; k++) {
      const c = clouds[order[k]]
      if (c.depth <= -8) continue
      seen += 1
      if (seen <= skip) continue
      offset[n * 3] = c.x
      offset[n * 3 + 1] = c.y
      offset[n * 3 + 2] = c.z + drift
      scale[n * 2] = c.w
      scale[n * 2 + 1] = c.h
      rot[n] = c.rot
      variant[n] = c.variant
      alpha[n] = c.alpha
      seed[n] = c.seed
      n += 1
    }
    geometry.instanceCount = n
    const upload = (attr, count) => {
      attr.clearUpdateRanges()
      if (count > 0) attr.addUpdateRange(0, count)
      attr.needsUpdate = count > 0
    }
    const a = geometry.attributes
    upload(a.aOffset, n * 3)
    upload(a.aScale, n * 2)
    upload(a.aRot, n)
    upload(a.aVariant, n)
    upload(a.aAlpha, n)
    upload(a.aSeed, n)
  })

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />
}
