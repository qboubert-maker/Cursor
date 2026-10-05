import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor, useGLTF, useTexture } from '@react-three/drei'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'
import VolumetricClouds from './VolumetricClouds'
import DataStreams from './DataStreams'
import AffiliateNetwork from './AffiliateNetwork'
import SocialParticles from './SocialParticles'
import ControllerShowcase3D from './ControllerShowcase3D'
import KeyboardMouseShowcase3D from './KeyboardMouseShowcase3D'
import ZeroDelayAppShowcase3D from './ZeroDelayAppShowcase3D'
import FPSBoostShowcase3D from './FPSBoostShowcase3D'
import PremiumUtilityShowcase3D from './PremiumUtilityShowcase3D'
import AimBundleShowcase3D from './AimBundleShowcase3D'
import MultiversalCompatibilityShowcase3D from './MultiversalCompatibilityShowcase3D'
import AboutShowcase3D from './AboutShowcase3D'
import PCModel from './PCModel'
import { SIDE_YAW } from '../lib/layout'
import { padKey, padLeft, padRight, padRim } from '../lib/padLights'
import { quality } from '../lib/quality'
import { rig, scrollProgress } from '../lib/rig'

gsap.registerPlugin(ScrollTrigger)

const preloadModel = useGLTF.preload
const preloadTexture = useTexture.preload

/**
 * Binds the PC's yaw / glass panel and the camera's orbit to the scrollbar.
 * GSAP writes into `rig`; useFrame reads it — scrolling never re-renders React.
 */
function CameraController() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const pointer = useRef({ x: 0, y: 0 })
  const smooth = useRef({ x: 0, y: 0 })
  const target = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [camera])

  useLayoutEffect(() => {
    const trigger = document.getElementById('scroll-container')
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate() {
          scrollProgress.set(this.progress())
        },
        scrollTrigger: {
          trigger,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.16,
          invalidateOnRefresh: true,
        },
      })
      const seg = (vars, start, end, ease = 'sine.inOut') => tl.to(rig, { ...vars, duration: end - start, ease }, start)

      // 01 · HERO (0–15%)
      seg({ camZ: 13.4, travel: 0.1, logo: 1.05, shell: 1, network: 0, social: 0, burst: 0, panel: 0 }, 0, 0.112)

      // 02 · OPEN CHASSIS (15–40%): the tower, with nothing in front of it.
      seg(
        {
          yaw: SIDE_YAW,
          camX: 0.18,
          camY: 0.55,
          camZ: 6.5,
          lookX: 0,
          lookY: 0.14,
          lookZ: 0,
          panel: 1,
          glow: 1.22,
          fov: 34,
          fog: 0.028,
          float: 0.22,
          travel: 0.3,
          logo: 0.88,
          shell: 1,
          network: 0,
          social: 0,
          burst: 0,
          speed: 0,
          clouds: 1,
        },
        0.112,
        0.268,
        'power2.inOut',
      )

      // 03 · AFFILIATES (40–65%): through the bay, into the node void.
      seg(
        {
          camX: -0.42,
          camY: 0.88,
          camZ: 0.35,
          lookX: -0.7,
          lookY: 0.95,
          lookZ: -0.9,
          yaw: 0.5,
          panel: 1,
          fov: 28,
          speed: 1,
          travel: 1.15,
          fog: 0.05,
          glow: 1.35,
          logo: 0.3,
          roll: 0.08,
          parallax: 0.35,
          clouds: 0.5,
          shell: 1,
          network: 0,
          social: 0,
        },
        0.268,
        0.358,
        'power2.in',
      )
      // Leave the affiliate bay by pushing into the black pump face and the logo.
      seg(
        {
          camX: -1.45,
          camY: 1.0,
          camZ: -0.03,
          lookX: 0.04,
          lookY: 1.0,
          lookZ: -0.84,
          yaw: 0.5,
          fov: 24,
          speed: 0.2,
          travel: 0.25,
          fog: 0.018,
          roll: 0,
          parallax: 0.12,
          clouds: 0.2,
          shell: 1,
          network: 0,
          social: 0,
          glow: 1,
          logo: 1.8,
          panel: 1,
        },
        0.358,
        0.378,
        'power2.inOut',
      )
      seg(
        {
          camX: -1.12,
          camY: 1.0,
          camZ: -0.2,
          lookX: 0.04,
          lookY: 1.0,
          lookZ: -0.84,
          fov: 16,
          speed: 0,
          travel: 0,
          fog: 0.006,
          clouds: 0.04,
          shell: 1,
          logo: 2.4,
          glow: 1.2,
        },
        0.378,
        0.4,
        'power2.in',
      )

      // Socials opens out of that black logo field.
      seg(
        {
          camX: -0.15,
          camY: 0.18,
          camZ: 9.2,
          lookX: 0.35,
          lookY: 0.02,
          lookZ: 0,
          fov: 36,
          speed: 0,
          travel: 0,
          fog: 0.034,
          roll: 0,
          clouds: 0.16,
          shell: 0,
          network: 0,
          social: 1,
          burst: 0,
          panel: 0,
          yaw: 0,
        },
        0.4,
        0.462,
        'power2.out',
      )
      seg({ camZ: 8.6, fog: 0.028 }, 0.462, 0.492, 'sine.inOut')

      // Controllers: drop into black, rise, push in close, then spread.
      seg(
        {
          camX: 0,
          camY: 0.15,
          camZ: 7.4,
          lookX: 0,
          lookY: -0.6,
          lookZ: 0,
          fov: 42,
          social: 0,
          network: 0,
          shell: 0,
          clouds: 0.04,
          fog: 0.02,
          speed: 0,
          roll: 0,
          panel: 0,
          controllers: 0.15,
          padSpread: 0,
          padSpin: 0.15,
          padLift: 0,
          desk: 0,
          suck: 0,
          scan: 0,
          kernel: 0,
          kernelOpen: 0,
          fps: 0,
          fpsCount: 0,
          burst: 0,
        },
        0.492,
        0.521,
        'power2.in',
      )
      seg(
        {
          camY: 0.4,
          camZ: 6.4,
          lookY: 0.05,
          fov: 34,
          fog: 0.01,
          controllers: 1,
          padSpin: 1.15,
        },
        0.521,
        0.555,
        'power2.out',
      )
      seg(
        {
          camX: 0.05,
          camY: 1.25,
          camZ: 2.05,
          lookX: 0,
          lookY: 0.72,
          lookZ: 0.05,
          fov: 22,
          padSpin: 1.45,
        },
        0.555,
        0.585,
        'power2.inOut',
      )
      seg(
        {
          camX: 0,
          camY: 0.32,
          camZ: 7.1,
          lookX: 0,
          lookY: 0.12,
          lookZ: 0,
          fov: 36,
          padSpread: 1,
          padSpin: 0.42,
          fog: 0.012,
        },
        0.585,
        0.618,
        'power3.out',
      )

      // Pads leave upward and unmount before the keyboard is allowed in.
      seg(
        {
          padLift: 1,
          camY: 0.62,
          camZ: 8.6,
          lookY: 0.55,
          fov: 34,
        },
        0.618,
        0.627,
        'power2.in',
      )
      seg(
        {
          controllers: 0,
        },
        0.627,
        0.630,
        'none',
      )
      seg(
        {
          desk: 1,
          suck: 0,
          camX: 0,
          camY: 0.3,
          camZ: 6.5,
          lookX: 0,
          lookY: 0.16,
          lookZ: 0,
          fov: 34,
          fog: 0.014,
        },
        0.630,
        0.647,
        'power2.out',
      )
      seg(
        {
          camX: 0.4,
          camZ: 5.6,
          lookX: 0.28,
          lookY: 0.16,
          fov: 32,
        },
        0.647,
        0.657,
        'sine.inOut',
      )
      seg(
        {
          suck: 1,
          kernel: 0.2,
          camX: 0,
          camY: 0.42,
          camZ: 8.2,
          lookX: 0,
          lookY: 0.06,
          fov: 36,
        },
        0.657,
        0.669,
        'power2.inOut',
      )

      // Towers take the stage once the desk has cleared.
      seg(
        {
          desk: 0,
          kernel: 1,
          kernelOpen: 0.2,
          camY: 0.34,
          camZ: 8.6,
          lookY: 0.12,
          fov: 34,
          fog: 0.013,
        },
        0.669,
        0.679,
        'power2.out',
      )
      seg(
        {
          kernelOpen: 1,
          camZ: 8.15,
          lookY: 0.15,
          fov: 32,
        },
        0.679,
        0.688,
        'sine.inOut',
      )
      seg(
        {
          kernel: 0,
          kernelOpen: 0,
          camY: 0.38,
          camZ: 8.3,
          lookY: 0.1,
          fov: 34,
        },
        0.688,
        0.694,
        'power2.inOut',
      )

      // CPUs enter after the towers have dropped away.
      seg(
        {
          suck: 0,
          fps: 1,
          fpsCount: 0.35,
          camX: 0,
          camY: 0.34,
          camZ: 6.4,
          lookX: 0,
          lookY: 0.16,
          lookZ: 0,
          fov: 34,
          fog: 0.012,
        },
        0.694,
        0.700,
        'power2.out',
      )
      seg(
        {
          fpsCount: 1,
          camZ: 5.9,
          lookY: 0.2,
          fov: 32,
        },
        0.700,
        0.703,
        'sine.out',
      )

      // Premium Utility: flash, particle dissolve, then the dual GPU reveal.
      seg(
        {
          fps: 0,
          flash: 1,
          utility: 1,
          gpuIn: 0,
          gpuMacro: 0,
          gpuLock: 0,
          shell: 0,
          clouds: 0.04,
          fog: 0.045,
          social: 0,
          network: 0,
          camX: 0,
          camY: 0.2,
          camZ: 11,
          lookX: 0,
          lookY: 0.04,
          lookZ: 0,
          fov: 46,
        },
        0.703,
        0.709,
        'power2.in',
      )
      seg(
        {
          flash: 0,
          gpuIn: 1,
          fog: 0.014,
          camY: 0.1,
          camZ: 7.2,
          lookY: 0.02,
          fov: 32,
        },
        0.709,
        0.718,
        'power2.out',
      )
      seg(
        {
          gpuMacro: 1,
          camX: 0.72,
          camY: -0.02,
          camZ: 2.85,
          lookX: 0.42,
          lookY: 0,
          lookZ: 0.2,
          fov: 20,
        },
        0.718,
        0.724,
        'power2.inOut',
      )
      seg(
        {
          gpuLock: 1,
          camX: 0,
          camY: 0.28,
          camZ: 6.7,
          lookX: 0,
          lookY: 0.08,
          lookZ: 0,
          fov: 32,
          fog: 0.012,
        },
        0.724,
        0.733,
        'power2.out',
      )
      // Aim bundle: the cards punch past the lens and the camera enters the arena.
      seg(
        {
          gpuExit: 1,
          aim: 1,
          aimChaos: 1,
          aimSnap: 0,
          aimLock: 0,
          gpuMacro: 0,
          camX: 0,
          camY: 0.02,
          camZ: 4.5,
          lookX: 0,
          lookY: 0,
          lookZ: 0,
          fov: 34,
          fog: 0.016,
          clouds: 0,
          shell: 0,
          yaw: 0,
          roll: 0,
          parallax: 0,
          speed: 0,
        },
        0.733,
        0.782,
        'power2.out',
      )
      seg(
        {
          utility: 0,
          gpuIn: 0,
          gpuLock: 0,
          gpuExit: 1,
          aimChaos: 0,
          aimSnap: 1,
          camZ: 3.35,
          fov: 26,
          fog: 0.006,
        },
        0.782,
        0.832,
        'power4.in',
      )
      seg(
        {
          aimLock: 1,
          camZ: 3.5,
          fov: 28,
        },
        0.832,
        0.855,
        'power2.out',
      )
      // The reticle blows out, then the game ring takes the void.
      seg(
        {
          aimBurst: 1,
          aimLock: 0,
          multi: 1,
          multiSpin: 0,
          multiFan: 0,
          camX: 0,
          camY: 0.18,
          camZ: 7.6,
          lookX: 0,
          lookY: 0.25,
          lookZ: 0,
          fov: 40,
          fog: 0.022,
          clouds: 1,
          shell: 0,
          yaw: 0,
          roll: 0,
          parallax: 1,
          speed: 0.4,
        },
        0.855,
        0.885,
        'power2.out',
      )
      seg(
        {
          aim: 0,
          aimSnap: 0,
          aimBurst: 1,
        },
        0.882,
        0.892,
        'power2.in',
      )
      seg(
        {
          multiSpin: 1,
          speed: 0,
          camZ: 6.5,
          lookY: 0.22,
          fov: 32,
          fog: 0.022,
          clouds: 1,
          parallax: 1,
        },
        0.885,
        0.908,
        'none',
      )
      seg(
        {
          multiFan: 1,
          camZ: 5.5,
          camY: 0.02,
          lookY: 0.48,
          fov: 30,
          fog: 0.022,
          clouds: 1,
          parallax: 1,
        },
        0.908,
        0.924,
        'power2.inOut',
      )
      // Cards fold into the center and break into a stream of white light.
      seg(
        {
          aboutDissolve: 1,
          about: 0.35,
          camZ: 7.2,
          camY: 0.28,
          lookY: 0.22,
          fov: 34,
          fog: 0.02,
          speed: 0,
        },
        0.924,
        0.942,
        'power3.out',
      )
      seg(
        {
          multi: 0,
          multiFan: 0,
          multiSpin: 0,
          about: 1,
          aboutDissolve: 1,
          aboutLock: 0.35,
          camX: 0,
          camY: 0.42,
          camZ: 6.6,
          lookX: 0,
          lookY: 0.42,
          lookZ: 0,
          fov: 30,
          fog: 0.016,
          clouds: 0.08,
          shell: 0,
          yaw: 0,
          roll: 0,
          parallax: 0.2,
        },
        0.942,
        0.956,
        'power2.out',
      )
      seg(
        {
          aboutLock: 1,
          camZ: 6.15,
          camY: 0.48,
          lookY: 0.48,
          fov: 28,
          fog: 0.014,
        },
        0.956,
        0.972,
        'sine.inOut',
      )
      seg(
        {
          multi: 0,
          multiFan: 0,
          multiSpin: 0,
          about: 0,
          aboutDissolve: 0,
          aboutLock: 0,
          aimBurst: 0,
          aim: 0,
          aimLock: 0,
          aimSnap: 0,
          aimChaos: 1,
          gpuExit: 0,
          camX: 0,
          camY: 1.05,
          camZ: 16.4,
          lookX: 0,
          lookY: 0.22,
          lookZ: 0,
          yaw: 0.36,
          panel: 0,
          fov: 32,
          speed: 0,
          travel: 0.05,
          fog: 0.018,
          float: 1,
          roll: 0,
          parallax: 1,
          clouds: 1,
          shell: 1,
          network: 0,
          social: 0,
          burst: 0,
          fps: 0,
          utility: 0,
          gpuIn: 0,
          gpuMacro: 0,
          gpuLock: 0,
          glow: 1.4,
          logo: 1.2,
        },
        0.972,
        0.988,
        'power3.inOut',
      )
      seg({ flash: 1, logo: 1.9, glow: 1.6 }, 0.988, 0.994, 'power2.in')
      seg({ flash: 0, logo: 1.15, glow: 1.05, camZ: 14.6 }, 0.994, 1, 'power2.out')
    })
    return () => ctx.revert()
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const sp = smooth.current
    sp.x = THREE.MathUtils.damp(sp.x, pointer.current.x, 2.2, dt)
    sp.y = THREE.MathUtils.damp(sp.y, pointer.current.y, 2.2, dt)

    const portrait = size.width / size.height < 0.9
    const pan = portrait ? 0 : rig.panX
    const shake = rig.speed * 0.08
    const breathe = Math.sin(t * 0.42) * 0.08 * rig.float
    const px = sp.x * 0.55 * rig.parallax
    const py = sp.y * 0.32 * rig.parallax
    const z = rig.camZ * (portrait ? 1.18 : 1)

    camera.position.set(
      rig.camX + pan + px + Math.sin(t * 31.7) * shake,
      rig.camY + breathe + py + Math.cos(t * 27.3) * shake,
      z,
    )
    target.current.set(rig.lookX + px * 0.18, rig.lookY + py * 0.12, rig.lookZ)
    camera.lookAt(target.current)
    camera.rotation.z += rig.roll + Math.sin(t * 0.22) * 0.008 * rig.float

    const fov = rig.fov * (portrait ? 1.18 : 1)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

function Atmosphere() {
  const scene = useThree((s) => s.scene)
  const key = useRef()
  const rim = useRef()
  const fill = useRef()

  useFrame(() => {
    if (scene.fog) scene.fog.density = rig.fog
    const flash = rig.flash
    key.current.intensity = 2.8 + flash * 4.2
    rim.current.intensity = 1.4 + rig.glow * 0.8 + flash * 6
    fill.current.intensity = 0.35 + rig.glow * 0.25
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fogExp2 attach="fog" args={['#000000', rig.fog]} />
      <ambientLight intensity={0.08} color="#ffffff" />
      <directionalLight ref={key} position={[8, 14, 18]} intensity={2.8} color="#ffffff" />
      <directionalLight ref={rim} position={[-10, 6, -8]} intensity={1.4} color="#ffffff" />
      <directionalLight ref={fill} position={[2, -6, 10]} intensity={0.4} color="#ffffff" />
      <primitive object={padKey} />
      <primitive object={padRim} />
      <primitive object={padLeft} />
      <primitive object={padRight} />
      <Environment resolution={32} frames={1}>
        <Lightformer form="rect" intensity={6} position={[0, 12, 10]} scale={[20, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.6} position={[10, 0, 6]} scale={[2, 14, 1]} color="#ffffff" />
      </Environment>
    </>
  )
}

function LaterVisuals() {
  const [band, setBand] = useState(0)
  useEffect(() => {
    const update = (value) => {
      const p = Number(value) || 0
      const next = p >= 0.9 ? 5 : p >= 0.7 ? 4 : p >= 0.6 ? 3 : p >= 0.42 ? 2 : p >= 0.18 ? 1 : 0
      setBand((current) => (current === next ? current : next))
    }
    update(scrollProgress.get())
    return scrollProgress.on('change', update)
  }, [])

  useEffect(() => {
    if (band < 3) return undefined
    const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 120))
    const cancel = window.cancelIdleCallback || window.clearTimeout
    const id = idle(() => {
      preloadModel('/zero-pc.glb', false, false)
      preloadTexture('/zero-mark.png')
      preloadTexture('/apex-3-tkl.webp')
      preloadTexture('/g502.webp')
      preloadTexture('/ryzen9.webp')
      preloadTexture('/i9.webp')
      preloadTexture('/nvidia.webp')
      preloadTexture('/radeon.webp')
    })
    return () => cancel(id)
  }, [band])

  if (band === 0) return null
  return (
    <>
      {band >= 1 && (
        <Suspense fallback={null}>
          <AffiliateNetwork />
          <SocialParticles />
        </Suspense>
      )}
      {band >= 2 && (
        <Suspense fallback={null}>
          <ControllerShowcase3D />
        </Suspense>
      )}
      {band >= 3 && (
        <Suspense fallback={null}>
          <KeyboardMouseShowcase3D />
          <ZeroDelayAppShowcase3D />
        </Suspense>
      )}
      {band >= 4 && (
        <Suspense fallback={null}>
          <FPSBoostShowcase3D />
          <PremiumUtilityShowcase3D />
          <AimBundleShowcase3D />
        </Suspense>
      )}
      {band >= 5 && (
        <Suspense fallback={null}>
          <MultiversalCompatibilityShowcase3D />
          <AboutShowcase3D />
        </Suspense>
      )}
    </>
  )
}

export default function Experience() {
  const [dpr, setDpr] = useState(quality.dpr)

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: quality.antialias, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 32, near: 0.08, far: 180, position: [0, 0.55, 15.5] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#000000', 1)
        gl.debug.checkShaderErrors = false
        gl.shadowMap.enabled = false
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        const boot = document.getElementById('boot')
        if (boot) {
          boot.classList.add('is-done')
          window.setTimeout(() => boot.remove(), 420)
        }
        const context = gl.getContext()
        const info = context.getExtension('WEBGL_debug_renderer_info')
        if (!info) return
        const renderer = context.getParameter(info.UNMASKED_RENDERER_WEBGL) || ''
        if (/uhd|hd graphics|iris|mali-|llvmpipe|swiftshader|basic render/i.test(renderer)) {
          quality.clouds = 28
          setDpr(1)
        }
      }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <CameraController />
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => setDpr((current) => Math.max(1, Math.round((current - 0.2) * 100) / 100))}
        onFallback={() => setDpr(1)}
      />
      <Atmosphere />
      <Suspense fallback={null}>
        <PCModel />
        <VolumetricClouds />
        <DataStreams />
      </Suspense>
      <LaterVisuals />
    </Canvas>
  )
}
