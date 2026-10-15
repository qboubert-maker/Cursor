import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { LOGO_URL, rig } from '../lib/rig'

function shieldGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 1.2)
  shape.bezierCurveTo(0.55, 1.16, 0.86, 0.92, 0.9, 0.48)
  shape.lineTo(0.9, -0.05)
  shape.bezierCurveTo(0.9, -0.62, 0.42, -1.05, 0, -1.28)
  shape.bezierCurveTo(-0.42, -1.05, -0.9, -0.62, -0.9, -0.05)
  shape.lineTo(-0.9, 0.48)
  shape.bezierCurveTo(-0.86, 0.92, -0.55, 1.16, 0, 1.2)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 16,
  })
  geo.center()
  return geo
}

const logoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const logoFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    vec4 color = texture2D(uMap, vUv);
    float ink = smoothstep(0.12, 0.42, max(color.r, max(color.g, color.b)));
    if (ink < 0.04) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, ink);
  }
`

function BlankMark() {
  const source = useTexture(LOGO_URL)
  const material = useMemo(() => {
    const map = source.clone()
    map.colorSpace = THREE.SRGBColorSpace
    map.wrapS = THREE.ClampToEdgeWrapping
    map.wrapT = THREE.ClampToEdgeWrapping
    map.offset.set(0.148, 0.287)
    map.repeat.set(0.674, 0.426)
    map.needsUpdate = true
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map } },
      vertexShader: logoVertex,
      fragmentShader: logoFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  }, [source])

  return (
    <mesh position={[0, 0.02, 0.17]} material={material}>
      <planeGeometry args={[1.42, 0.9]} />
    </mesh>
  )
}

export default function AboutShowcase3D() {
  const root = useRef(null)
  const crest = useRef(null)
  const shieldGeo = useMemo(() => shieldGeometry(), [])

  useFrame((state) => {
    const about = THREE.MathUtils.clamp(rig.about, 0, 1)
    const lock = THREE.MathUtils.smoothstep(rig.aboutLock, 0, 1)
    if (!root.current || !crest.current) return
    root.current.visible = about > 0.02
    if (!root.current.visible) return

    const t = state.clock.elapsedTime
    const portrait = state.size.width / state.size.height < 0.9
    const crestShow = THREE.MathUtils.smoothstep(about, 0.08, 0.85)
    crest.current.visible = crestShow > 0.02
    const crestScale = portrait ? 0.32 : 0.78
    crest.current.scale.setScalar(crestScale * crestShow * (0.92 + lock * 0.08))
    crest.current.position.y = (portrait ? 2.15 : 0.72) + Math.sin(t * 0.7) * 0.04
    crest.current.rotation.y = Math.sin(t * 0.28) * 0.08 * lock
    crest.current.rotation.x = 0
  })

  return (
    <group ref={root} visible={false}>
      <group ref={crest} position={[0, 0.72, 0]} visible={false}>
        <mesh geometry={shieldGeo}>
          <meshPhysicalMaterial
            color="#050505"
            roughness={0.18}
            metalness={0.06}
            transmission={0.78}
            thickness={1.1}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.12}
            attenuationColor="#ffffff"
            attenuationDistance={1.6}
            envMapIntensity={1.15}
          />
        </mesh>
        <BlankMark />
        <pointLight position={[0, -0.35, 1.6]} intensity={0.35} distance={4} color="#ffffff" />
      </group>
    </group>
  )
}

useTexture.preload(LOGO_URL)
