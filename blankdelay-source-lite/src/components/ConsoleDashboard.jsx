import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import { ArrowUpRight, Eye, EyeOff, Minus, Square, X } from 'lucide-react'
import DiscordIcon from './icons/DiscordIcon'
import { DISCORD_URL } from '../lib/content'
import { loadConsoleArt } from '../lib/consoleArt'
import { PS5Console, PS5_SIZE, XBOX_SIZE, XboxSeriesX, useConsoleMaterials } from './ConsoleModels3D'

const FOV = 30
const DISTANCE = 12.5
const TILT = THREE.MathUtils.degToRad(8)
const DESIGN_HEIGHT = 900
const DESIGN_ASPECT = 1.6
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
// CSS pixels per world unit on the HUD plane at the design size. drei draws one CSS
// pixel as distanceFactor / 400 world units, so this factor renders the panels 1:1.
const PX = DESIGN_HEIGHT / (2 * DISTANCE * TAN)
const DISTANCE_FACTOR = 400 / PX
const px = (value) => value / PX

const SCALE = 0.88
const FLOOR = -1.9
const HOVER = 0.12
const PAPER = '#e4ddd3'
const INK = '#141210'
const KEY_LENGTH = 28
const DEVICE_ID = '2430-000E-EA17-EDF7'

// Each console floats HOVER above the floor, measured from the bottom of its stand or foot.
const STAGE = {
  ps5: {
    position: [-2.12, FLOOR + HOVER + (PS5_SIZE.height / 2 + 0.07) * SCALE, 0.3],
    rotation: [0, 0.5, 0],
    spinIn: 1,
    hit: [1.2, 4.1, 2.8],
    shadow: [2.1, 3.3],
  },
  xbox: {
    position: [0.12, FLOOR + HOVER + (XBOX_SIZE.height / 2 + 0.05) * SCALE, 0],
    rotation: [0, -0.42, 0],
    spinIn: -1,
    hit: [1.6, 3.2, 1.6],
    shadow: [2.3, 2.3],
  },
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useConsoleArt() {
  // null while painting, false if painting failed (the page still works without art).
  const [art, setArt] = useState(null)
  useEffect(() => {
    let live = true
    loadConsoleArt().then(
      (result) => live && setArt(result),
      () => live && setArt(false),
    )
    return () => {
      live = false
    }
  }, [])
  return art
}

function Mark({ className = '' }) {
  return (
    <svg viewBox="0 0 346 216" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="70" cy="108" r="70" />
      <path d="M143 108 346 0v216z" />
    </svg>
  )
}

const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const backdropFragment = /* glsl */ `
  uniform sampler2D uArt;
  uniform vec2 uCover;
  uniform vec2 uShift;
  uniform float uReveal;
  uniform float uPaperIn;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec4 art = texture2D(uArt, (vUv - 0.5) * uCover + 0.5 + uShift);
    vec2 v = vUv - 0.5;
    float tooth = hash(floor(gl_FragCoord.xy)) - 0.5;
    vec3 paper = uPaper * (1.0 + (art.b - 0.5) / 3.0 + tooth * 0.02) * (1.0 - dot(v, v) * 0.3);
    float ink = pow(art.r, 0.72) * smoothstep(art.g, art.g + 0.035, uReveal);
    vec3 color = mix(uPaper * 0.985, mix(paper, uInk, ink), uPaperIn);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

function Backdrop({ art, motion }) {
  const material = useMemo(() => {
    const blank = new THREE.DataTexture(new Uint8Array([0, 255, 128, 255]), 1, 1)
    blank.needsUpdate = true
    return new THREE.ShaderMaterial({
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uArt: { value: blank },
        uCover: { value: new THREE.Vector2(1, 1) },
        uShift: { value: new THREE.Vector2() },
        uReveal: { value: 0 },
        uPaperIn: { value: 0 },
        uPaper: { value: new THREE.Color(PAPER) },
        uInk: { value: new THREE.Color(INK) },
      },
    })
  }, [])

  useEffect(() => {
    if (art) material.uniforms.uArt.value = art.backdrop
  }, [art, material])

  useFrame(({ size }) => {
    const u = material.uniforms
    const image = u.uArt.value.image
    const screen = size.width / size.height
    const picture = image.width / image.height
    // Cover the screen, with a small margin so the parallax never shows an edge.
    u.uCover.value.set(screen > picture ? 0.985 : (0.985 * screen) / picture, screen > picture ? (0.985 * picture) / screen : 0.985)
    u.uShift.value.set(motion.pointer.x * 0.006, motion.pointer.y * 0.005)
    u.uReveal.value = motion.ink
    u.uPaperIn.value = motion.paper
  })

  return (
    <mesh frustumCulled={false} renderOrder={-10} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(0.05, 0.045, 0.04, pow(1.0 - smoothstep(0.0, 1.0, d), 1.8) * uOpacity);
  }
`

function useShadowMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: shadowFragment,
      }),
    [],
  )
}

/**
 * GSAP drives where each console wants to be (a slow sine float, hover lift, spin),
 * and the frame loop lerps the real transform towards it, so every input blends
 * into one soft, physical motion.
 */
function FloatingConsole({ id, motion, children }) {
  const stage = STAGE[id]
  const body = useRef()
  const shadow = useRef()
  const shadowMaterial = useShadowMaterial()
  const sim = useMemo(
    () => ({ target: { y: 0, rx: 0, ry: 0, rz: 0, lift: 0, spin: 0 }, y: 0, rx: 0, ry: 0, rz: 0, spin: 0, follow: 0, drag: null }),
    [],
  )

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = sim.target
    const phase = id === 'ps5' ? 0 : 1
    const float = [
      gsap.fromTo(t, { y: -0.05 }, { y: 0.06, duration: 2.9 + phase * 0.55, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo(t, { rz: -0.02 }, { rz: 0.02, duration: 3.7 + phase * 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo(t, { rx: -0.016 }, { rx: 0.014, duration: 4.4 - phase * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
      gsap.fromTo(t, { ry: -0.06 }, { ry: 0.06, duration: 6.3 - phase * 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    ]
    float.forEach((tween, i) => tween.progress((phase * 0.43 + i * 0.27) % 1))
    return () => {
      float.forEach((tween) => tween.kill())
      gsap.killTweensOf(t)
    }
  }, [id, sim])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const ease = 1 - Math.exp(-dt * 4)
    const t = sim.target
    sim.y += (t.y + t.lift + motion.signal * motion.signal * 0.16 - sim.y) * ease
    sim.rx += (t.rx - sim.rx) * ease
    sim.ry += (t.ry - sim.ry) * ease
    sim.rz += (t.rz - sim.rz) * ease
    sim.spin += (t.spin - sim.spin) * (1 - Math.exp(-dt * 9))
    sim.follow += (motion.pointer.x - sim.follow) * (1 - Math.exp(-dt * 2.2))
    const lean = (motion.pointer.x - sim.follow) * 0.2
    const enter = motion[id]
    const away = 1 - enter

    const [x, y, z] = stage.position
    body.current.position.set(x, y + sim.y - away * 6.5, z)
    body.current.rotation.set(
      stage.rotation[0] + sim.rx - motion.pointer.y * 0.05,
      stage.rotation[1] + sim.ry + sim.follow * 0.2 + sim.spin + away * 0.9 * stage.spinIn,
      sim.rz - lean,
    )
    body.current.scale.setScalar(SCALE * (0.94 + 0.06 * enter))

    const rise = Math.max(0, sim.y)
    shadowMaterial.uniforms.uOpacity.value = enter * enter * Math.max(0.12, 0.5 - rise * 1.6)
    shadow.current.scale.set(stage.shadow[0] * (1 + rise * 0.7), stage.shadow[1] * (1 + rise * 0.7), 1)
  })

  const hover = (on) => {
    gsap.to(sim.target, { lift: on ? 0.14 : 0, duration: 0.8, ease: 'power3.out', overwrite: 'auto' })
    document.body.style.cursor = on ? 'grab' : ''
  }

  const handlers = {
    onPointerOver: (event) => {
      event.stopPropagation()
      hover(true)
    },
    onPointerOut: () => {
      if (!sim.drag) hover(false)
    },
    onPointerDown: (event) => {
      event.stopPropagation()
      event.target.setPointerCapture(event.pointerId)
      sim.drag = { x: event.clientX }
      gsap.killTweensOf(sim.target, 'spin')
      document.body.style.cursor = 'grabbing'
    },
    onPointerMove: (event) => {
      if (!sim.drag) return
      sim.target.spin += (event.clientX - sim.drag.x) * 0.012
      sim.drag.x = event.clientX
    },
    onPointerUp: (event) => {
      if (!sim.drag) return
      sim.drag = null
      event.target.releasePointerCapture(event.pointerId)
      const turn = Math.PI * 2
      gsap.to(sim.target, { spin: Math.round(sim.target.spin / turn) * turn, duration: 1.8, ease: 'elastic.out(1, 0.45)' })
      hover(false)
    },
  }

  return (
    <>
      <group ref={body}>
        {children}
        <mesh {...handlers}>
          <boxGeometry args={stage.hit} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={shadow} material={shadowMaterial} position={[stage.position[0], FLOOR + 0.002, stage.position[2]]} rotation={[-Math.PI / 2, 0, stage.rotation[1]]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  )
}

function Consoles({ art, motion }) {
  const materials = useConsoleMaterials(art)
  useFrame(({ clock }) => {
    const breathe = Math.sin(clock.elapsedTime * 1.4) * 0.5 + 0.5
    materials.glow.opacity = Math.min(1, 0.55 + breathe * 0.35 + motion.signal * 0.6)
  })
  return (
    <>
      <FloatingConsole id="ps5" motion={motion}>
        <PS5Console materials={materials} />
      </FloatingConsole>
      <FloatingConsole id="xbox" motion={motion}>
        <XboxSeriesX materials={materials} />
      </FloatingConsole>
    </>
  )
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#fffaf2', '#8d857b', 0.5]} />
      <directionalLight position={[-5, 8, 7]} intensity={2.3} color="#fff8ef" />
      <directionalLight position={[6, 3, 5]} intensity={0.55} />
      <directionalLight position={[2, 5, -8]} intensity={1.5} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#57514a']} />
        <Lightformer form="rect" intensity={3} position={[-5, 6, 5]} scale={[8, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} position={[6, 2, 5]} scale={[4, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.2} position={[0, 5, -7]} scale={[10, 2.5, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.8} position={[0, -6, 2]} scale={6} target={[0, 0, 0]} color="#efe7da" />
      </Environment>
    </>
  )
}

function TitleStack() {
  return (
    <div className="absolute top-0 left-0 w-[400px] text-[#151311]">
      <p data-rise className="font-display text-[9.5px] font-extrabold tracking-[0.36em]">
        HOUZEN STUDIOS
      </p>
      <div data-rise className="mt-[18px]">
        <Mark className="h-[10px] w-auto" />
      </div>
      <h1 className="mt-[22px] font-serif">
        <span data-rise className="block text-[82px] leading-[0.8] font-black tracking-[-0.012em]">
          BLANK
        </span>
        <span data-rise className="mt-[14px] block pl-[4px] text-[24px] leading-none font-bold tracking-[0.66em]">
          DELAY
        </span>
      </h1>
      <p data-rise className="mt-[30px] font-display text-[10.5px] font-extrabold tracking-[0.34em]">
        BE SUPERIOR
      </p>
      <p data-rise className="mt-[9px] font-serif text-[19px] leading-none text-[#151311]/75 italic">
        Console Controller Macro
      </p>
    </div>
  )
}

function LicenseForm({ onActivate }) {
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const field = useRef(null)
  const shell = useRef(null)
  const button = useRef(null)

  const submit = (event) => {
    event.preventDefault()
    if (!key) {
      gsap.fromTo(shell.current, { x: 0 }, { keyframes: { x: [-7, 7, -5, 5, -2, 0] }, duration: 0.45, ease: 'power1.inOut' })
      field.current.focus()
      return
    }
    gsap.fromTo(button.current, { scale: 0.97 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
    onActivate()
  }

  return (
    <form onSubmit={submit} noValidate className="absolute top-0 right-0 w-[316px] text-[#151311]">
      <p data-rise className="font-display text-[9.5px] font-extrabold tracking-[0.36em] text-black/45">
        HOUZEN STUDIOS
      </p>
      <h2 data-rise className="mt-[12px] font-serif text-[44px] leading-none font-medium tracking-[-0.02em]">
        Welcome back
      </h2>
      <p data-rise className="mt-[12px] text-[12.5px] text-black/50">
        Activate your key to unlock <span className="font-semibold text-black/80">Blank Delay</span>.
      </p>

      <div data-rise className="mt-[28px]">
        <div className="flex items-center justify-between font-display text-[8.5px] font-bold tracking-[0.28em] text-black/40">
          <label htmlFor="console-license">LICENSE KEY</label>
          <span>REQUIRED</span>
        </div>
        <div
          ref={shell}
          className="relative mt-[8px] rounded-[9px] bg-[#f7f4ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_26px_-16px_rgba(45,35,25,0.45)] ring-1 ring-black/10"
        >
          <input
            id="console-license"
            ref={field}
            name="license"
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, KEY_LENGTH))}
            maxLength={KEY_LENGTH}
            placeholder="••••••••••••••••••••"
            autoComplete="off"
            spellCheck={false}
            className="h-[48px] w-full rounded-[9px] border border-white/20 bg-white/5 pr-[110px] pl-[15px] font-mono text-[12.5px] tracking-[0.16em] text-[#151311] caret-[#151311] outline-none placeholder:tracking-[0.04em] placeholder:text-[#151311] focus-visible:border-black/25"
          />
          <span className="pointer-events-none absolute top-1/2 right-[42px] -translate-y-1/2 rounded-full border border-black/15 bg-black/[0.03] px-[7px] py-[3px] font-display text-[8px] font-bold tracking-[0.16em] text-black/45">
            28 SNIPE
          </span>
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? 'Hide license key' : 'Show license key'}
            aria-pressed={visible}
            className="absolute top-1/2 right-[10px] grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-full text-black/45 transition-colors hover:bg-black/5 hover:text-black/80"
          >
            {visible ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
          </button>
        </div>
      </div>

      <button
        ref={button}
        data-rise
        type="submit"
        className="group mt-[14px] flex h-[46px] w-full items-center gap-[9px] rounded-[9px] bg-linear-to-b from-[#2d2a27] to-[#0c0b0a] px-[16px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_28px_-14px_rgba(20,15,10,0.7)] transition-[filter] hover:brightness-125"
      >
        Activate securely
        <span aria-hidden="true" className="ml-auto font-mono text-[15px] tracking-[0.08em] transition-transform duration-300 group-hover:translate-x-[3px]">
          &gt;
        </span>
        <ArrowUpRight className="h-[14px] w-[14px] transition-transform duration-300 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" />
      </button>

      <p data-rise className="mt-[16px] text-center text-[10.5px] text-black/35">
        1 to 3 Asc erase Click home
      </p>
      <a
        data-rise
        href={DISCORD_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-[10px] flex h-[44px] w-full items-center justify-center gap-[9px] rounded-[9px] border border-white bg-white/40 text-[12.5px] font-semibold text-black/80 shadow-[0_10px_24px_-18px_rgba(45,35,25,0.6)] transition-colors hover:bg-white/70"
      >
        <DiscordIcon className="h-[15px] w-[15px]" />
        Discord
      </a>
    </form>
  )
}

function StatusFooter() {
  return (
    <div className="absolute right-0 bottom-0 w-[316px] text-[10.5px] text-black/40">
      <div data-rise className="flex items-center justify-between border-t border-black/10 pt-[11px]">
        <span>Device</span>
        <span className="font-mono text-[10px] tracking-[0.12em] text-black/55">{DEVICE_ID}</span>
      </div>
      <div data-rise className="mt-[14px] flex items-center justify-between">
        <span className="flex items-center gap-[7px]">
          <i className="block h-[5px] w-[5px] rounded-full bg-[#151311]" />
          New content: <b className="font-semibold text-black/75">online</b>
        </span>
        <span>Now Now</span>
        <span>
          Get code/<b className="font-semibold text-black/75">ACTIVE</b>
        </span>
      </div>
    </div>
  )
}

// Panels mount into a fixed overlay. drei otherwise appends them to R3F's event target,
// which only appears after the first render, so every panel would remount once.
function Panel({ position, swing, motion, overlay, children }) {
  const group = useRef()
  useFrame(() => {
    const away = 1 - motion.ui
    group.current.rotation.y = away * swing
    group.current.position.z = position[2] - away * 0.6
  })
  return (
    <group ref={group} position={position}>
      <Html transform distanceFactor={DISTANCE_FACTOR} portal={overlay} zIndexRange={[100, 0]}>
        <div className="relative h-0 w-0" style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </Html>
    </group>
  )
}

function Hud({ layout, motion, overlay }) {
  const group = useRef()
  useFrame(({ camera }) => {
    group.current.quaternion.copy(camera.quaternion)
  })

  const activate = () => gsap.fromTo(motion, { signal: 1 }, { signal: 0, duration: 1.6, ease: 'power2.out' })
  const { hw, hh } = layout
  const right = hw - px(46)
  return (
    <group ref={group}>
      <Panel motion={motion} overlay={overlay} swing={0.34} position={[-hw + px(46), hh - px(36), 0]}>
        <TitleStack />
      </Panel>
      <Panel motion={motion} overlay={overlay} swing={-0.2} position={[right - px(316), hh - px(58), 0]}>
        <div data-rise className="absolute top-0 left-0 flex items-center gap-[9px] font-display text-[9.5px] font-extrabold tracking-[0.32em] whitespace-nowrap text-[#151311]">
          <Mark className="h-[7px] w-auto" />
          BLANK DELAY
        </div>
      </Panel>
      <Panel motion={motion} overlay={overlay} swing={-0.38} position={[right, hh - px(246), 0]}>
        <LicenseForm onActivate={activate} />
      </Panel>
      <Panel motion={motion} overlay={overlay} swing={-0.2} position={[right, -hh + px(40), 0]}>
        <StatusFooter />
      </Panel>
    </group>
  )
}

function useIntro(art, motion) {
  useEffect(() => {
    if (art === null) return
    let cancelled = false
    let timeline
    const fonts = Promise.race([
      Promise.all(
        ['900 82px "Playfair Display"', '500 44px "Playfair Display"', 'italic 400 19px "Playfair Display"', '800 10px Archivo', '500 13px Inter'].map(
          (font) => document.fonts.load(font),
        ),
      ),
      new Promise((resolve) => setTimeout(resolve, 1400)),
    ]).catch(() => {})

    fonts.then(() => {
      if (cancelled) return
      const items = document.querySelectorAll('[data-console] [data-rise]')
      const ink = art ? 1.05 : 0
      if (prefersReducedMotion()) {
        Object.assign(motion, { paper: 1, ink, ps5: 1, xbox: 1, ui: 1 })
        gsap.set(items, { opacity: 1 })
        return
      }
      timeline = gsap
        .timeline()
        .to(motion, { paper: 1, duration: 0.6, ease: 'power2.out' }, 0)
        .to(motion, { ink, duration: 2.3, ease: 'power1.inOut' }, 0.1)
        .to(motion, { ps5: 1, duration: 1.9, ease: 'expo.out' }, 0.5)
        .to(motion, { xbox: 1, duration: 1.9, ease: 'expo.out' }, 0.66)
        .to(motion, { ui: 1, duration: 1.6, ease: 'expo.out' }, 0.3)
        .fromTo(items, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.045 }, 0.42)
    })
    return () => {
      cancelled = true
      timeline?.kill()
    }
  }, [art, motion])
}

function Scene({ art, motion, overlay }) {
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)

  // Pull the camera back on narrow windows so the whole 16:10 layout stays in view.
  const layout = useMemo(() => {
    const aspect = size.width / size.height
    const distance = DISTANCE * Math.max(1, DESIGN_ASPECT / aspect)
    const hh = distance * TAN
    return { aspect, distance, hh, hw: hh * aspect }
  }, [size.width, size.height])

  useLayoutEffect(() => {
    camera.fov = FOV
    camera.aspect = layout.aspect
    camera.position.set(0, Math.sin(TILT) * layout.distance, Math.cos(TILT) * layout.distance)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }, [camera, layout])

  useIntro(art, motion)

  return (
    <>
      <Backdrop art={art} motion={motion} />
      <Lights />
      {art && <Consoles art={art} motion={motion} />}
      <Hud layout={layout} motion={motion} overlay={overlay} />
    </>
  )
}

function WindowControls() {
  const win = window.appWindow
  const button = 'grid h-[24px] w-[30px] place-items-center rounded-full text-black/55 transition-colors hover:bg-black/8 hover:text-black'
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-[40px]" style={{ WebkitAppRegion: 'drag', zIndex: 2147483000 }} />
      <div
        className="absolute top-[18px] right-[22px] flex items-center gap-[2px] rounded-full border border-black/10 bg-[#eee8e0]/85 p-[3px] shadow-[0_6px_18px_-10px_rgba(40,30,20,0.4)]"
        style={{ WebkitAppRegion: 'no-drag', zIndex: 2147483001 }}
      >
        <button type="button" aria-label="Minimize" onClick={() => win.minimize()} className={button}>
          <Minus className="h-[13px] w-[13px]" />
        </button>
        <button type="button" aria-label="Maximize" onClick={() => win.maximize()} className={button}>
          <Square className="h-[11px] w-[11px]" />
        </button>
        <button type="button" aria-label="Close" onClick={() => win.close()} className={`${button} hover:bg-[#151311] hover:text-white`}>
          <X className="h-[13px] w-[13px]" />
        </button>
      </div>
    </>
  )
}

export default function ConsoleDashboard() {
  const art = useConsoleArt()
  const overlay = useRef(null)
  const motion = useMemo(() => ({ paper: 0, ink: 0, ps5: 0, xbox: 0, ui: 0, signal: 0, pointer: { x: 0, y: 0 } }), [])
  const desktop = Boolean(window.appWindow)

  useEffect(() => {
    const toX = gsap.quickTo(motion.pointer, 'x', { duration: 1, ease: 'power3.out' })
    const toY = gsap.quickTo(motion.pointer, 'y', { duration: 1, ease: 'power3.out' })
    const move = (event) => {
      toX((event.clientX / window.innerWidth) * 2 - 1)
      toY(1 - (event.clientY / window.innerHeight) * 2)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      gsap.killTweensOf(motion.pointer)
    }
  }, [motion])

  return (
    <main data-console className="fixed inset-0 overflow-hidden bg-[#e4ddd3] select-none">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: FOV, near: 0.5, far: 80, position: [0, 1.74, 12.38] }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
      >
        <Scene art={art} motion={motion} overlay={overlay} />
      </Canvas>
      <div ref={overlay} className="pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[12px] border border-black/10" />
      {desktop && <WindowControls />}
    </main>
  )
}
