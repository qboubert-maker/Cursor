import { useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from '../../lib/rig'
import VolumetricClouds from '../VolumetricClouds'

function Drift() {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    camera.position.set(0, 0.62, 14.4)
    camera.lookAt(0, 0.12, -6)
  }, [camera])
  useFrame(() => {
    rig.clouds = 1
    rig.fog = 0.03
    rig.logo = 1
    rig.glow = 0.5
    rig.travel = 0.02
    rig.logoY = 0.35
    rig.logoZ = 0.4
  })
  return null
}

export default function AffiliateSky() {
  const [running, setRunning] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const onVisibility = () => setRunning(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <Canvas
      frameloop={running ? 'always' : 'never'}
      dpr={1}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.08, far: 180, position: [0, 0.62, 14.4] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000', 1)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.02
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    >
      <Drift />
      <VolumetricClouds />
    </Canvas>
  )
}
