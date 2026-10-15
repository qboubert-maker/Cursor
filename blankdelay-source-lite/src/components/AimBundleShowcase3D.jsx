import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const PARTICLE_COUNT = 420
const STROKE = 0.012
const ARM = 0.42
const GAP = 0.18

const ARMS = [
  { rest: [-(GAP + ARM / 2), 0, 0], shatter: [-1.6, 0.7, 0.2], size: [ARM, STROKE], spin: 0.4 },
  { rest: [GAP + ARM / 2, 0, 0], shatter: [1.5, -0.55, -0.15], size: [ARM, STROKE], spin: -0.35 },
  { rest: [0, GAP + ARM / 2, 0], shatter: [0.45, 1.55, 0.1], size: [STROKE, ARM], spin: 0.25 },
  { rest: [0, -(GAP + ARM / 2), 0], shatter: [-0.4, -1.4, -0.2], size: [STROKE, ARM], spin: -0.5 },
]

function Crosshair() {
  const root = useRef(null)
  const arms = useRef([])
  const ring = useRef(null)
  const dot = useRef(null)
  const pointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    const show = THREE.MathUtils.clamp(rig.aim, 0, 1)
    root.current.visible = show > 0.04
    if (!root.current.visible) return

    state.mouse.x = pointer.current.x
    state.mouse.y = pointer.current.y

    const snap = THREE.MathUtils.smoothstep(rig.aimSnap, 0, 1)
    const burst = THREE.MathUtils.clamp(rig.aimBurst, 0, 1)
    const track = THREE.MathUtils.smoothstep(rig.aimLock, 0.08, 0.9) * (1 - burst)
    const alpha = 1 - Math.exp(-14 * delta)
    const tx = state.mouse.x * 1.05 * track
    const ty = 0.22 + state.mouse.y * 0.46 * track

    root.current.position.x = THREE.MathUtils.lerp(root.current.position.x, tx, alpha)
    root.current.position.y = THREE.MathUtils.lerp(root.current.position.y, ty, alpha)
    root.current.scale.setScalar(0.52 * (1 + burst * 6))

    const open = 1 - snap
    arms.current.forEach((arm, i) => {
      const spec = ARMS[i]
      arm.position.set(
        THREE.MathUtils.lerp(spec.shatter[0], spec.rest[0], snap) * (1 + burst * 5),
        THREE.MathUtils.lerp(spec.shatter[1], spec.rest[1], snap) * (1 + burst * 5),
        THREE.MathUtils.lerp(spec.shatter[2], 0, snap),
      )
      arm.rotation.z = spec.spin * open
    })

    ring.current.scale.setScalar(THREE.MathUtils.lerp(1.8, 1, snap) * (1 + burst * 2.4))
    ring.current.material.opacity = (0.15 + snap * 0.85) * (1 - burst)
    dot.current.scale.setScalar(0.15 + snap * 0.85)
  })

  return (
    <group ref={root} visible={false}>
      {ARMS.map((arm, i) => (
        <mesh key={i} ref={(node) => (arms.current[i] = node)} position={arm.shatter}>
          <planeGeometry args={arm.size} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={ring}>
        <ringGeometry args={[0.92, 0.934, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={dot}>
        <circleGeometry args={[0.028, 24]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function ParticleField() {
  const points = useRef(null)
  const seeds = useMemo(() => {
    const radius = new Float32Array(PARTICLE_COUNT)
    const phase = new Float32Array(PARTICLE_COUNT)
    const speed = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      radius[i] = 0.4 + Math.random() * 2.8
      phase[i] = Math.random() * Math.PI * 2
      speed[i] = 0.2 + Math.random() * 0.7
    }
    return { radius, phase, speed }
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3))
    return geo
  }, [])

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.aim, 0, 1)
    points.current.visible = show > 0.04
    if (!points.current.visible) return

    const t = state.clock.elapsedTime
    const chaos = THREE.MathUtils.clamp(rig.aimChaos, 0, 1)
    const burst = THREE.MathUtils.clamp(rig.aimBurst, 0, 1)
    const locked = 1 - chaos
    const attr = points.current.geometry.attributes.position
    const arr = attr.array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = seeds.phase[i]
      const spin = t * seeds.speed[i] + phase
      const loose = seeds.radius[i] * (1 + burst * 6)
      const orbit = 0.85 + (i % 5) * 0.08
      const o = i * 3
      arr[o] = Math.cos(spin) * loose * chaos + Math.cos(phase + t * 0.25) * orbit * locked
      arr[o + 1] = Math.sin(spin * 0.8) * loose * 0.65 * chaos + Math.sin(phase + t * 0.25) * orbit * 0.62 * locked + 0.22 * locked
      arr[o + 2] = Math.sin(spin) * loose * 0.35 * chaos
    }
    attr.needsUpdate = true
    points.current.material.opacity = show * (0.25 + chaos * 0.45) * (1 - burst * 0.2)
    points.current.material.size = 1.5 + chaos * 0.8
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
      <pointsMaterial color="#ffffff" size={1.8} transparent opacity={0} depthWrite={false} toneMapped={false} sizeAttenuation={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

export default function AimBundleShowcase3D() {
  const root = useRef(null)

  useFrame(() => {
    root.current.visible = rig.aim > 0.02
  })

  return (
    <group ref={root} visible={false}>
      <ParticleField />
      <Crosshair />
    </group>
  )
}
