import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, DepthOfField, Vignette } from '@react-three/postprocessing'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RealPS5, RealXbox } from './RealConsoles3D'

const LINES = {
  perf: 'SYSTEM PERFORMANCE REDEFINED.',
  precision: 'SUB-1MS PRECISION. KERNEL-LEVEL SPEED.',
  delay: 'DELAY?',
  blank: 'WE LEFT THAT BLANK.',
}

function makeLogoGeometry() {
  const dot = new THREE.Shape()
  dot.absarc(-0.62, 0, 0.4, 0, Math.PI * 2, false)
  const arrow = new THREE.Shape()
  arrow.moveTo(0.02, 0)
  arrow.lineTo(1.38, 0.64)
  arrow.lineTo(1.38, -0.64)
  arrow.closePath()
  const geometry = new THREE.ExtrudeGeometry([dot, arrow], {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 40,
  })
  geometry.center()
  return geometry
}

function Fog({ cue }) {
  const points = useRef(null)
  const positions = useMemo(() => {
    const data = new Float32Array(280 * 3)
    for (let i = 0; i < 280; i++) {
      data[i * 3] = (Math.random() - 0.5) * 16
      data[i * 3 + 1] = (Math.random() - 0.5) * 8
      data[i * 3 + 2] = (Math.random() - 0.5) * 12
    }
    return data
  }, [])

  useFrame(({ clock }) => {
    points.current.rotation.y = clock.elapsedTime * 0.015
    points.current.material.opacity = 0.22 * cue.fog
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.028} transparent depthWrite={false} sizeAttenuation />
    </points>
  )
}

function GpuCard() {
  const spins = useRef([])
  const body = useMemo(() => new RoundedBoxGeometry(1.15, 2.55, 0.42, 3, 0.06), [])
  useFrame((_, delta) => {
    spins.current.forEach((node) => {
      if (node) node.rotation.z -= delta * 2.4
    })
  })
  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color="#141416" roughness={0.55} metalness={0.35} />
      </mesh>
      {[0.52, -0.52].map((y, index) => (
        <group key={y} position={[0, y, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
          <group ref={(node) => (spins.current[index] = node)}>
            <mesh>
              <cylinderGeometry args={[0.32, 0.32, 0.03, 40]} />
              <meshStandardMaterial color="#141414" metalness={0.85} roughness={0.28} />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} rotation={[0, 0, (i / 7) * Math.PI * 2]} position={[0, 0.02, 0]}>
                <boxGeometry args={[0.07, 0.02, 0.26]} />
                <meshStandardMaterial color="#f2f2f2" metalness={0.55} roughness={0.22} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      <mesh position={[0, -1.32, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.16]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

function Hardware({ cue }) {
  const root = useRef(null)
  const ps5 = useRef(null)
  const xbox = useRef(null)
  const gpu = useRef(null)

  useFrame(({ clock }) => {
    const show = cue.hardware
    root.current.visible = show > 0.04
    root.current.scale.setScalar(0.52 * (0.82 + 0.18 * Math.min(show, 1)))
    const bob = Math.sin(clock.elapsedTime * 0.75) * 0.06
    const spread = cue.spread
    ps5.current.position.set(-1.35 - spread * 1.05, bob, 0.05)
    ps5.current.rotation.set(0, 0.62, 0)
    gpu.current.position.set(0, bob * 0.3 - 0.35, -1.35)
    gpu.current.rotation.set(0.15, -0.2, 0)
    gpu.current.scale.setScalar(0.62)
    xbox.current.position.set(1.35 + spread * 1.05, bob * 0.55 - 0.05, 0.08)
    xbox.current.rotation.set(0, -0.48, 0)
  })

  return (
    <group ref={root}>
      <group ref={ps5}>
        <RealPS5 />
      </group>
      <group ref={xbox}>
        <RealXbox />
      </group>
      <group ref={gpu}>
        <GpuCard />
      </group>
    </group>
  )
}

function MacroField({ cue }) {
  const root = useRef(null)
  const chips = useMemo(
    () => [
      [-0.55, 0.12, 0.1],
      [0.45, -0.05, -0.15],
      [0.05, 0.42, -0.35],
    ],
    [],
  )
  const traces = useMemo(() => {
    const points = [
      new THREE.Vector3(-1.1, -0.02, 0.4),
      new THREE.Vector3(-0.4, -0.02, 0.15),
      new THREE.Vector3(0.1, -0.02, 0.35),
      new THREE.Vector3(0.7, -0.02, -0.05),
      new THREE.Vector3(1.15, -0.02, 0.2),
    ]
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#ffffff' }))
  }, [])

  useFrame(() => {
    const show = cue.macro
    root.current.visible = show > 0.03
    root.current.scale.setScalar(show)
    root.current.rotation.y = cue.orbit * Math.PI * 1.35
    root.current.rotation.x = -0.35 + cue.orbit * 0.15
  })

  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshStandardMaterial color="#070707" metalness={0.8} roughness={0.35} />
      </mesh>
      <primitive object={traces} />
      {chips.map((position, index) => (
        <Chip key={index} position={position} />
      ))}
    </group>
  )
}

function Chip({ position }) {
  const body = useMemo(() => new RoundedBoxGeometry(0.62, 0.07, 0.62, 2, 0.02), [])
  const edges = useMemo(() => new THREE.EdgesGeometry(body), [body])
  return (
    <group position={position}>
      <mesh geometry={body}>
        <meshStandardMaterial color="#050505" metalness={0.85} roughness={0.22} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
      {[-0.28, 0.28].map((z) => (
        <mesh key={z} position={[0, -0.02, z]}>
          <boxGeometry args={[0.5, 0.015, 0.03]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

function Mark({ cue }) {
  const root = useRef(null)
  const geometry = useMemo(() => makeLogoGeometry(), [])
  useFrame(() => {
    const show = cue.logo
    root.current.visible = show > 0.04
    const scale = cue.logoScale * show
    root.current.scale.setScalar(scale)
    root.current.rotation.y = (1 - show) * 0.6
  })
  return (
    <mesh ref={root} geometry={geometry} position={[0, 0.15, 0]}>
      <meshPhysicalMaterial color="#ffffff" metalness={0.18} roughness={0.16} clearcoat={1} clearcoatRoughness={0.08} />
    </mesh>
  )
}

function Sweep({ cue }) {
  const spot = useRef(null)
  const fill = useRef(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const angle = cue.spot * 1.5 - 0.75
    spot.current.position.set(Math.sin(angle) * 5.5, 4.8, 3.2 + Math.cos(angle) * 1.4)
    spot.current.intensity = 55 * cue.hardware * (1 - cue.macro) * (1.05 - cue.ink * 0.35)
    spot.current.target = target
    fill.current.intensity = 0.9 + cue.logo * 0.4
  })
  return (
    <>
      <primitive object={target} position={[0, 0.2, 0]} />
      <spotLight ref={spot} angle={0.5} penumbra={0.7} color="#ffffff" distance={24} decay={2} />
      <ambientLight ref={fill} intensity={0.9} />
      <directionalLight position={[3, 6, 8]} intensity={3.4} color="#ffffff" />
      <directionalLight position={[-6, 4, -4]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[7, 3, -5]} intensity={1.8} color="#ffffff" />
    </>
  )
}

function CameraGrade({ cue }) {
  const dof = useRef(null)
  const look = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    camera.position.set(cue.px, cue.py, cue.pz)
    look.set(cue.lx, cue.ly, cue.lz)
    camera.lookAt(look)
    const effect = dof.current
    if (!effect?.cocMaterial) return
    effect.cocMaterial.focusDistance = camera.position.distanceTo(look)
    effect.cocMaterial.focusRange = cue.focusRange
    effect.bokehScale = cue.bokeh
  })
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={dof} focusDistance={6} focusRange={3.2} bokehScale={1.5} resolutionScale={0.8} />
      <Vignette eskil={false} offset={0.18} darkness={0.72} />
    </EffectComposer>
  )
}

function Scene({ cue }) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 10, 22]} />
      <Sweep cue={cue} />
      <Fog cue={cue} />
      <Hardware cue={cue} />
      <MacroField cue={cue} />
      <Mark cue={cue} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]}>
        <circleGeometry args={[9, 80]} />
        <meshPhysicalMaterial color="#050505" metalness={0.72} roughness={0.42} />
      </mesh>
      <ContactShadows position={[0, -1.2, 0]} opacity={0.55} scale={14} blur={2.6} far={4.5} color="#000000" resolution={256} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[-5, 4, -3]} scale={[7, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[5, 2, -4]} scale={[3, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 5, 3]} scale={[8, 1.2, 1]} target={[0, 0, 0]} />
      </Environment>
      <CameraGrade cue={cue} />
    </>
  )
}

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
}

function Caption({ card, showUrl }) {
  const huge = card === 'delay'
  return (
    <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center px-6 ${huge ? 'top-[16%]' : 'bottom-[12%]'}`}>
      <AnimatePresence mode="wait">
        <motion.p
          key={card}
          {...fade}
          className={`max-w-[920px] text-center font-display leading-[0.95] font-medium text-white uppercase ${
            huge
              ? 'text-[clamp(64px,9vw,120px)] tracking-[0.12em] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.85)]'
              : 'text-[clamp(22px,3.6vw,48px)] tracking-[0.16em] drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)]'
          }`}
        >
          {LINES[card]}
        </motion.p>
      </AnimatePresence>
      <AnimatePresence>
        {showUrl && (
          <motion.p key="url" {...fade} className="mt-5 font-display text-[clamp(13px,1.5vw,18px)] font-medium tracking-[0.42em] text-white">
            BLANKDELAY.COM
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function BlankDelayCommercial() {
  const cue = useMemo(
    () => ({
      px: 2.4,
      py: 1.15,
      pz: 6.5,
      lx: 0,
      ly: 0.15,
      lz: 0,
      spot: 0,
      hardware: 1,
      spread: 0,
      ink: 0,
      macro: 0,
      orbit: 0,
      logo: 0,
      logoScale: 0.15,
      bokeh: 1.4,
      focusRange: 3.4,
      fog: 0.35,
    }),
    [],
  )
  const bar = useRef(null)
  const flash = useRef(null)
  const band = useRef(null)
  const timeline = useRef(null)
  const [card, setCard] = useState('perf')
  const [showUrl, setShowUrl] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    const tl = gsap.timeline({
      onUpdate: () => {
        if (bar.current) bar.current.style.transform = `scaleX(${tl.progress()})`
        const time = tl.time()
        const next = time < 6 ? 'perf' : time < 14 ? 'precision' : time < 21.5 ? 'delay' : 'blank'
        setCard((prev) => (prev === next ? prev : next))
        const url = time >= 25.2
        setShowUrl((prev) => (prev === url ? prev : url))
      },
      onComplete: () => setEnded(true),
    })
    timeline.current = tl

    tl.to(cue, { spot: 1, px: -1.6, py: 1.45, pz: 5.8, duration: 6, ease: 'power1.inOut' }, 0)
    tl.to(cue, { hardware: 0, macro: 1, fog: 0.85, bokeh: 2.1, focusRange: 0.85, duration: 1.15, ease: 'power2.inOut' }, 5.7)
    tl.to(cue, { orbit: 1, px: 0.05, py: 0.55, pz: 1.45, lx: 0, ly: 0.08, lz: 0, duration: 7.4, ease: 'none' }, 6.4)

    tl.to(
      cue,
      {
        macro: 0,
        hardware: 1,
        ink: 1,
        spread: 1,
        fog: 0.28,
        bokeh: 1.5,
        focusRange: 2.8,
        px: 0.15,
        py: 1.35,
        pz: 7.2,
        lx: 0,
        ly: 0.1,
        lz: 0,
        duration: 1.35,
        ease: 'power3.inOut',
      },
      13.7,
    )
    tl.to(cue, { px: -0.35, pz: 6.55, duration: 6.2, ease: 'power1.inOut' }, 14.8)

    tl.fromTo(band.current, { xPercent: -130, opacity: 0 }, { xPercent: 230, opacity: 1, duration: 0.85, ease: 'power2.inOut' }, 20.85)
    tl.fromTo(flash.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power2.in' }, 21.15)
    tl.to(flash.current, { opacity: 0, duration: 0.9, ease: 'power2.out' }, 21.45)
    tl.to(band.current, { opacity: 0, duration: 0.35 }, 21.5)
    tl.to(
      cue,
      {
        hardware: 0,
        ink: 0,
        logo: 1,
        logoScale: 0.78,
        fog: 0.2,
        bokeh: 1.8,
        focusRange: 1.4,
        px: 0,
        py: 0.25,
        pz: 5.2,
        lx: 0,
        ly: 0.15,
        lz: 0,
        duration: 0.9,
        ease: 'expo.out',
      },
      21.35,
    )
    tl.to(cue, { logoScale: 0.7, pz: 4.7, duration: 7.2, ease: 'power1.out' }, 22.4)

    return () => tl.kill()
  }, [cue])

  const replay = () => {
    setEnded(false)
    setShowUrl(false)
    setCard('perf')
    if (flash.current) flash.current.style.opacity = '0'
    if (band.current) band.current.style.opacity = '0'
    timeline.current?.restart()
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 28, near: 0.08, far: 40, position: [2.4, 1.15, 6.5] }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000')
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
          gl.debug.checkShaderErrors = false
        }}
      >
        <Scene cue={cue} />
      </Canvas>

      <Caption card={card} showUrl={showUrl} />
      <div
        ref={band}
        className="pointer-events-none absolute top-0 left-0 h-full w-[58%] opacity-0"
        style={{ background: 'linear-gradient(90deg, transparent, #ffffff 42%, #ffffff 58%, transparent)' }}
      />
      <div ref={flash} className="pointer-events-none absolute inset-0 bg-white opacity-0" />

      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="h-px bg-white/20">
          <div ref={bar} className="h-full origin-left scale-x-0 bg-white" />
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <span className="font-display text-[10px] tracking-[0.32em] text-white/55">BLANK DELAY</span>
          <button
            type="button"
            onClick={replay}
            className={`font-display text-[11px] tracking-[0.28em] uppercase transition-opacity ${ended ? 'text-white opacity-100' : 'text-white/70 opacity-80'} hover:opacity-100`}
          >
            Replay
          </button>
        </div>
      </div>
    </main>
  )
}
