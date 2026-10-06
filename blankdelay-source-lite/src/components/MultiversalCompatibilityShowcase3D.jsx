import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { rig } from '../lib/rig'

const GAMES = [
  { title: 'FORTNITE', cover: '/covers/fortnite.jpg?v=nova' },
  { title: 'GTA 5', cover: '/covers/gta5.jpg?v=nova' },
  { title: 'MINECRAFT', cover: '/covers/minecraft.jpg?v=nova' },
  { title: 'WARZONE', cover: '/covers/warzone.jpg?v=nova' },
  { title: 'APEX', cover: '/covers/apex.jpg?v=nova' },
  { title: 'ROCKET LEAGUE', cover: '/covers/rocket-league.jpg?v=nova' },
  { title: 'CS2', cover: '/covers/cs2.jpg?v=nova' },
]

const COVER_URLS = GAMES.map((game) => game.cover)

export const GAME_BADGES = GAMES.map((game) => game.title)

function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - r)
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  shape.lineTo(x + r, y + h)
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + r)
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return shape
}

function buildGlassFrame() {
  const w = 1.34
  const h = 1.9
  const shape = roundedRectShape(w, h, 0.14)
  const hole = roundedRectShape(1.1, 1.62, 0.08)
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.016,
    bevelSegments: 3,
    curveSegments: 12,
  })
  geometry.center()
  return geometry
}

function buildCoverMask() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 370
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(10, 12, 236, 346, 26)
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

export default function MultiversalCompatibilityShowcase3D() {
  const root = useRef(null)
  const cards = useRef([])
  const rimA = useRef(null)
  const rimB = useRef(null)
  const scratch = useRef({
    ring: new THREE.Vector3(),
    stack: new THREE.Vector3(),
    posed: new THREE.Vector3(),
    core: new THREE.Vector3(0, 0.35, 0.15),
    ringQuat: new THREE.Quaternion(),
    fanQuat: new THREE.Quaternion(),
    euler: new THREE.Euler(),
  })
  const textures = useTexture(COVER_URLS)
  textures.forEach((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
  })
  const frameGeometry = useMemo(() => buildGlassFrame(), [])
  const coverMask = useMemo(() => buildCoverMask(), [])
  const glassMaterials = useMemo(
    () =>
      GAMES.map(
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#f4f7f8',
            roughness: 0.04,
            metalness: 0,
            transmission: 1,
            thickness: 0.55,
            ior: 1.48,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            attenuationColor: '#d5e0e8',
            attenuationDistance: 0.45,
            envMapIntensity: 2.4,
            transparent: true,
            opacity: 1,
            depthWrite: false,
          }),
      ),
    [],
  )

  useFrame((state) => {
    const show = THREE.MathUtils.clamp(rig.multi, 0, 1)
    root.current.visible = show > 0.02
    if (!root.current.visible) return

    const portrait = state.size.width / state.size.height < 0.9
    const wide = state.size.width / state.size.height > 1.7
    const enter = THREE.MathUtils.smoothstep(show, 0.05, 1)
    const fan = THREE.MathUtils.smoothstep(rig.multiFan, 0, 1)
    const dissolve = THREE.MathUtils.clamp(rig.aboutDissolve, 0, 1)
    const gap = portrait ? 0.22 : wide ? 0.36 : 0.3
    const cardScale = portrait ? 0.62 : 1

    cards.current.forEach((card, i) => {
      if (!card) return
      const temp = scratch.current
      const turns = rig.multiSpin * GAMES.length
      let delta = i - turns
      delta = ((delta % GAMES.length) + GAMES.length) % GAMES.length
      if (delta > GAMES.length / 2) delta -= GAMES.length
      const away = Math.abs(delta)
      const spacing = portrait ? 1.15 : wide ? 1.85 : 1.55
      temp.ring.set(delta * spacing, 0.28 - away * 0.02, 0.7 - away * 0.55)
      const offset = i - 3
      temp.stack.set(offset * gap, 1.85 - Math.abs(offset) * 0.02, -1.8 - Math.abs(offset) * 0.1)
      temp.posed.lerpVectors(temp.ring, temp.stack, fan)
      card.position.lerpVectors(temp.posed, temp.core, dissolve)

      const focus = THREE.MathUtils.lerp(Math.max(0, 1 - away * 0.34), 1, fan)
      const coverScale = Math.max(0.62, 1.38 - away * 0.22)
      const fanScale = portrait ? 0.55 : 0.68
      card.scale.setScalar(cardScale * enter * THREE.MathUtils.lerp(coverScale, fanScale, fan) * (1 - dissolve * 0.94))
      card.renderOrder = 30 - Math.round(away * 4)

      temp.euler.set(0, delta * -0.34 * (1 - fan), offset * 0.09 * fan)
      temp.ringQuat.setFromEuler(temp.euler)
      card.quaternion.copy(temp.ringQuat)

      card.traverse((node) => {
        if (!node.isMesh) return
        node.renderOrder = card.renderOrder
        if (!node.userData?.fade || !node.material) return
        node.material.opacity = (0.28 + focus * 0.72) * (1 - dissolve)
      })
    })

    const sweep = Math.sin(state.clock.elapsedTime * 0.55) * 5
    rimA.current.position.x = -6 + sweep
    rimB.current.position.x = 6 - sweep
    rimA.current.intensity = show * 22
    rimB.current.intensity = show * 16
  })

  return (
    <group ref={root} visible={false}>
      <spotLight ref={rimA} position={[-6, 3.2, 5]} angle={0.55} penumbra={0.8} intensity={0} color="#ffffff" distance={22} decay={2} />
      <spotLight ref={rimB} position={[6, 1.4, 3]} angle={0.6} penumbra={0.85} intensity={0} color="#ffffff" distance={22} decay={2} />
      {GAMES.map((game, i) => (
        <group key={game.title} ref={(node) => (cards.current[i] = node)}>
          <mesh geometry={frameGeometry} material={glassMaterials[i]} userData={{ fade: true }} position={[0, 0, -0.02]} />
          <mesh userData={{ fade: true }} position={[0, 0, 0.045]}>
            <planeGeometry args={[1.18, 1.7]} />
            <meshBasicMaterial map={textures[i]} alphaMap={coverMask} transparent opacity={1} toneMapped={false} depthWrite />
          </mesh>
        </group>
      ))}
    </group>
  )
}
