import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const STREAK_COUNT = 900
const DUST_COUNT = 2600

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

const streakVertex = /* glsl */ `
  attribute float aTail;
  attribute float aSeed;
  uniform float uSpeed;
  uniform float uFog;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.z += aTail * (0.6 + uSpeed * (16.0 + aSeed * 22.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    float fog = exp(-pow(uFog * depth, 2.0));
    vAlpha = uOpacity * (0.04 + uSpeed * 0.96) * (1.0 - aTail * 0.96) * smoothstep(0.5, 6.0, depth) * fog;
  }
`

const streakFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(1.0), vAlpha);
    #include <colorspace_fragment>
  }
`

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFog;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.15 + aSeed * 40.0) * 0.8;
    p.y += cos(uTime * 0.12 + aSeed * 23.0) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    gl_PointSize = clamp((1.0 + aSeed * 2.0) * uPixelRatio * (50.0 / max(depth, 1.0)), 1.0, 6.0 * uPixelRatio);
    float twinkle = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 2.4) + aSeed * 60.0);
    float fog = exp(-pow(uFog * depth, 2.0));
    vAlpha = uOpacity * (0.25 + 0.75 * twinkle) * smoothstep(0.5, 4.0, depth) * fog;
  }
`

const dustFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(1.0), a);
    #include <colorspace_fragment>
  }
`

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
}

/** White "raw data" streaks that stretch with camera velocity, plus drifting particulate. */
export default function DataStreams() {
  const streaks = useMemo(() => {
    const rand = mulberry32(4242)
    const positions = new Float32Array(STREAK_COUNT * 6)
    const tails = new Float32Array(STREAK_COUNT * 2)
    const seeds = new Float32Array(STREAK_COUNT * 2)
    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = rand() * Math.PI * 2
      const r = 0.35 + Math.pow(rand(), 0.55) * 5.8
      const z = -18 + rand() * 36
      const x = Math.cos(a) * r * 1.15
      const y = Math.sin(a) * r * 0.55
      const s = rand()
      for (let j = 0; j < 2; j++) {
        const v = i * 2 + j
        positions.set([x, y, z], v * 3)
        tails[v] = j
        seeds[v] = s
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aTail', new THREE.BufferAttribute(tails, 1))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      uniforms: {
        uSpeed: { value: 0 },
        uFog: { value: rig.fog },
        uOpacity: { value: 1 },
      },
      ...additive,
    })
    return { geometry, material }
  }, [])

  const dust = useMemo(() => {
    const rand = mulberry32(777)
    const positions = new Float32Array(DUST_COUNT * 3)
    const seeds = new Float32Array(DUST_COUNT)
    for (let i = 0; i < DUST_COUNT; i++) {
      const z = 18 - rand() * 48
      positions[i * 3] = (rand() - 0.5) * 36
      positions[i * 3 + 1] = (rand() - 0.5) * 22
      positions[i * 3 + 2] = z
      seeds[i] = rand()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uFog: { value: rig.fog },
        uOpacity: { value: 0.8 },
      },
      ...additive,
    })
    return { geometry, material }
  }, [])

  useEffect(
    () => () => {
      streaks.geometry.dispose()
      streaks.material.dispose()
      dust.geometry.dispose()
      dust.material.dispose()
    },
    [streaks, dust],
  )

  useFrame(({ clock, gl }) => {
    const su = streaks.material.uniforms
    const clear = (1 - THREE.MathUtils.clamp(rig.multi, 0, 1)) * (1 - THREE.MathUtils.clamp(rig.about, 0, 1))
    su.uSpeed.value = rig.speed
    su.uFog.value = rig.fog
    su.uOpacity.value = (0.15 + rig.speed * 0.85) * clear

    const du = dust.material.uniforms
    du.uTime.value = clock.elapsedTime
    du.uPixelRatio.value = gl.getPixelRatio()
    du.uFog.value = rig.fog * 0.8
    du.uOpacity.value = (0.35 + rig.speed * 0.55) * (1 - THREE.MathUtils.clamp(rig.about, 0, 1))
  })

  return (
    <>
      <lineSegments geometry={streaks.geometry} material={streaks.material} frustumCulled={false} renderOrder={4} />
      <points geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={4} />
    </>
  )
}
