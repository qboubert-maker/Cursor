import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Minus, Square, X } from 'lucide-react'
import * as THREE from 'three'
import ControllerShowcase3D from './ControllerShowcase3D'
import VolumetricClouds from './VolumetricClouds'
import { rig } from '../lib/rig'
import { getActiveStatus, setOutput, toggleEngine } from '../services/controllerService'
import ControllerOptimizer from './ControllerOptimizer'
import ControllerSettings from './ControllerSettings'
import ControllerLogin, { readControllerSession, SESSION_KEY } from './ControllerLogin'

function SonyWash({ sony }) {
  const sonyRef = useRef(sony)
  const tone = useRef(sony ? 1 : 0)
  const bg = useRef()
  const fog = useRef()
  const key = useRef()
  const rim = useRef()
  const glow = useRef()
  sonyRef.current = sony
  const colors = useMemo(
    () => ({
      black: new THREE.Color('#000000'),
      navy: new THREE.Color('#040e22'),
      white: new THREE.Color('#ffffff'),
      blue: new THREE.Color('#4d7ec4'),
    }),
    [],
  )

  useFrame((_, delta) => {
    tone.current = THREE.MathUtils.damp(tone.current, sonyRef.current ? 1 : 0, 3.2, delta)
    const t = tone.current
    bg.current?.copy(colors.black).lerp(colors.navy, t)
    if (fog.current) fog.current.color.copy(colors.black).lerp(colors.navy, t)
    key.current?.color.copy(colors.white).lerp(colors.blue, t)
    rim.current?.color.copy(colors.white).lerp(colors.blue, t * 0.9)
    if (glow.current) glow.current.intensity = 14 * t
  })

  return (
    <>
      <color ref={bg} attach="background" args={['#000000']} />
      <fogExp2 ref={fog} attach="fog" args={['#000000', 0.012]} />
      <directionalLight ref={key} position={[8, 14, 18]} intensity={2.8} color="#ffffff" />
      <directionalLight ref={rim} position={[-10, 6, -8]} intensity={1.4} color="#ffffff" />
      <pointLight ref={glow} position={[0, 0.15, 2.4]} color="#1a4ea8" intensity={0} distance={9} />
    </>
  )
}

function Scene({ focus }) {
  const sony = focus === 'ps5'
  return (
    <>
      <SonyWash sony={sony} />
      <ambientLight intensity={0.08} color={sony ? '#7eaddb' : '#ffffff'} />
      <directionalLight position={[2, -6, 10]} intensity={0.4} color={sony ? '#6ea2d6' : '#ffffff'} />
      <spotLight position={[0, 7.5, 3.2]} intensity={48} angle={0.38} penumbra={0.45} distance={22} color={sony ? '#3d7ec4' : '#ffffff'} />
      <spotLight position={[0, 0.4, 7]} intensity={22} angle={0.65} penumbra={0.7} distance={18} color={sony ? '#4d8ed0' : '#ffffff'} />
      <spotLight position={[-4, 3.2, 3]} intensity={14} angle={0.45} penumbra={0.8} distance={16} color={sony ? '#2f6aaf' : '#ffffff'} />
      <spotLight position={[4, 2.4, 3]} intensity={10} angle={0.5} penumbra={0.75} distance={16} color={sony ? '#2f6aaf' : '#ffffff'} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={6} position={[0, 12, 10]} scale={[20, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2.2} position={[-10, 2, 4]} scale={[2, 18, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.6} position={[10, 0, 6]} scale={[2, 14, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={2.4} position={[0, 4, 12]} scale={6} color="#ffffff" />
      </Environment>
      <VolumetricClouds sony={sony} />
      <Suspense fallback={null}>
        <ControllerShowcase3D pinned focus={focus} />
      </Suspense>
    </>
  )
}

function WindowControls({ pad }) {
  const win = window.appWindow
  if (!win) return null
  const button = 'grid h-7 w-8 place-items-center rounded-full text-white/75 hover:bg-white/15 hover:text-white'
  const glass =
    pad === 'ps5'
      ? 'border-[#9ec4ee]/30 bg-[#071428]/35 shadow-[inset_0_1px_0_rgba(190,220,255,0.28)]'
      : 'border-white/20 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
  return (
    <div className={`flex items-center gap-0.5 rounded-full border p-1 backdrop-blur-xl ${glass}`} style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" aria-label="Minimize" onClick={() => win.minimize()} className={button}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Expand" onClick={() => win.maximize()} className={button}>
        <Square className="h-3 w-3" />
      </button>
      <button type="button" aria-label="Close" onClick={() => win.close()} className={button}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

const NAV = [
  { id: 'ps5', label: 'PS5' },
  { id: 'xbox', label: 'Xbox' },
  { id: 'settings', label: 'Settings' },
]

const KNOWN_PADS = {
  '054c:0ce6': 'DualSense',
  '054c:0df2': 'DualSense Edge',
  '054c:05c4': 'DualShock 4',
  '054c:09cc': 'DualShock 4',
  '045e:0b12': 'Xbox Series Controller',
  '045e:0b13': 'Xbox Series Controller',
  '045e:02ea': 'Xbox One Controller',
  '045e:02fd': 'Xbox One Controller',
  '045e:02ff': 'Xbox One Controller',
  '045e:028e': 'Xbox 360 Controller',
}

function controllerName(gamepad) {
  const id = gamepad?.id || ''
  const vendor = id.match(/Vendor:\s*([0-9a-f]{4})/i)?.[1]?.toLowerCase()
  const product = id.match(/Product:\s*([0-9a-f]{4})/i)?.[1]?.toLowerCase()
  const known = vendor && product ? KNOWN_PADS[`${vendor}:${product}`] : ''
  const reported = id.split('(')[0].replace(/\s+/g, ' ').trim()
  const generic = !reported || /^(wireless controller|controller|hid-compliant game controller)$/i.test(reported)
  if (!generic) return reported
  if (known) return known
  if (vendor === '054c') return 'DualSense'
  if (vendor === '045e' || /xbox|xinput/i.test(id)) return 'Xbox Controller'
  return 'Controller'
}

function useConnectedController() {
  const [names, setNames] = useState([])
  useEffect(() => {
    const read = () => {
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
      const next = []
      const seen = new Set()
      for (const pad of pads) {
        if (!pad || !pad.connected) continue
        const name = controllerName(pad)
        if (seen.has(name)) continue
        seen.add(name)
        next.push(name)
      }
      setNames((current) => (current.join('|') === next.join('|') ? current : next))
    }
    window.addEventListener('gamepadconnected', read)
    window.addEventListener('gamepaddisconnected', read)
    const timer = window.setInterval(read, 500)
    read()
    return () => {
      window.removeEventListener('gamepadconnected', read)
      window.removeEventListener('gamepaddisconnected', read)
      window.clearInterval(timer)
    }
  }, [])
  return names
}

function useControllerButtonPress(onPress) {
  const onPressRef = useRef(onPress)
  onPressRef.current = onPress
  useEffect(() => {
    const held = new Map()
    let frame = 0
    const tick = () => {
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
      let edge = false
      for (const pad of pads) {
        if (!pad) continue
        const last = held.get(pad.index) || []
        pad.buttons.forEach((button, index) => {
          const down = Boolean(button.pressed) || button.value > 0.55
          if (down && !last[index]) edge = true
          last[index] = down
        })
        held.set(pad.index, last)
      }
      if (edge) onPressRef.current()
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    let last = 0
    let stopped = false
    const watch = async () => {
      while (!stopped) {
        const result = await getActiveStatus()
        const count = Number(result?.status?.buttonPresses) || 0
        if (last && count !== last) onPressRef.current()
        if (count) last = count
        await new Promise((resolve) => window.setTimeout(resolve, 40))
      }
    }
    watch()
    return () => {
      stopped = true
    }
  }, [])
}

function ConnectionStatus({ pad, names }) {
  const [notice, setNotice] = useState(null)
  const known = useRef(new Set())
  useEffect(() => {
    const fresh = names.filter((name) => !known.current.has(name))
    for (const name of [...known.current]) {
      if (!names.includes(name)) known.current.delete(name)
    }
    for (const name of names) known.current.add(name)
    if (!fresh.length) return undefined
    const id = Date.now()
    setNotice({ id, text: `${fresh.join(' · ')} connected and online`, open: false })
    const open = window.requestAnimationFrame(() => {
      setNotice((current) => (current?.id === id ? { ...current, open: true } : current))
    })
    const fade = window.setTimeout(() => {
      setNotice((current) => (current?.id === id ? { ...current, open: false } : current))
    }, 1600)
    const done = window.setTimeout(() => {
      setNotice((current) => (current?.id === id ? null : current))
    }, 2000)
    return () => {
      window.cancelAnimationFrame(open)
      window.clearTimeout(fade)
      window.clearTimeout(done)
    }
  }, [names])
  if (!notice) return null
  const glass =
    pad === 'ps5'
      ? 'border-[#b7d4f5]/35 bg-[#0a2248]/55 shadow-[0_10px_30px_rgba(2,10,26,0.35),inset_0_1px_0_rgba(210,230,255,0.35)]'
      : 'border-white/20 bg-black/45 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.22)]'
  return (
    <div className="pointer-events-none absolute top-[4.75rem] right-4 z-30 max-w-[min(24rem,calc(100vw-2rem))]">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-2xl transition-all duration-300 ${glass} ${notice.open ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0'}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]" />
        <p className="text-[12px] font-semibold tracking-[0.12em] uppercase text-white">{notice.text}</p>
      </div>
    </div>
  )
}

function driverFromStatus(status) {
  if (!status?.running) return null
  return status.output === 'xbox' ? 'xbox' : 'ps5'
}

export default function ControllerMacroApp() {
  const [pad, setPad] = useState('ps5')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [driver, setDriver] = useState(null)
  const [driverBusy, setDriverBusy] = useState(false)
  const [driverRoute, setDriverRoute] = useState('')
  const [session, setSession] = useState(null)
  const [gateReady, setGateReady] = useState(() => !readControllerSession())
  const signedIn = Boolean(session)
  useEffect(() => {
    const saved = readControllerSession()
    if (!saved?.key) {
      setGateReady(true)
      return undefined
    }
    const validate = window.controllerOptimizer?.validateLicense
    if (!validate) {
      setGateReady(true)
      return undefined
    }
    let cancel = false
    validate(saved.key).then((result) => {
      if (cancel) return
      if (result?.ok || result?.offline) setSession({ ...saved, key: result.key || saved.key })
      else localStorage.removeItem(SESSION_KEY)
      setGateReady(true)
    })
    return () => {
      cancel = true
    }
  }, [])
  useEffect(() => {
    if (!signedIn) return undefined
    let stopped = false
    const pull = async () => {
      const result = await getActiveStatus()
      if (stopped || !result?.status) return
      setDriver(driverFromStatus(result.status))
      if (result.status.route) setDriverRoute(result.status.route)
    }
    pull()
    const timer = window.setInterval(pull, 1000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [signedIn])
  const controllers = useConnectedController()
  useControllerButtonPress(() => {
    if (signedIn) {
      setSettingsOpen(false)
      setMenuOpen(true)
    } else window.dispatchEvent(new Event('blank-delay-open-login'))
  })
  const powerDriver = async (next) => {
    if (driverBusy) return
    setDriverBusy(true)
    try {
      if (driver === next) {
        await toggleEngine(false, next)
        setDriver(null)
      } else {
        await setOutput(next)
        const result = await toggleEngine(true, next)
        setDriver(driverFromStatus(result?.status))
        setPad(next)
        if (result?.status?.route) setDriverRoute(result.status.route)
      }
    } finally {
      setDriverBusy(false)
    }
  }
  useEffect(() => {
    rig.clouds = 1
    rig.fog = 0.016
    rig.logo = 1
    rig.glow = 0.85
    rig.flash = 0
    rig.travel = 0
    rig.logoX = 0
    rig.logoY = 1.4
    rig.logoZ = 2
  }, [])
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') setPad('xbox')
      if (event.key === 'ArrowLeft') setPad('ps5')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <header
        className="absolute inset-x-0 top-0 z-50 flex h-[72px] items-center justify-center"
        style={{ WebkitAppRegion: signedIn ? 'drag' : 'no-drag', pointerEvents: signedIn ? 'auto' : 'none' }}
      >
        {signedIn ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                pad === 'ps5'
                  ? 'linear-gradient(180deg, rgba(4,14,34,0.62) 0%, rgba(8,28,62,0.28) 70%, rgba(8,28,62,0) 100%)'
                  : 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(18,18,18,0.22) 70%, rgba(18,18,18,0) 100%)',
              backdropFilter: 'blur(18px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
              maskImage: 'linear-gradient(180deg, #000 0%, #000 62%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 62%, transparent 100%)',
            }}
          />
        ) : null}
        <nav
          className={`flex items-center gap-1 rounded-full border p-1 backdrop-blur-2xl ${signedIn ? '' : 'invisible'} ${
            pad === 'ps5'
              ? 'border-[#b7d4f5]/35 bg-[#0a2248]/40 shadow-[0_10px_30px_rgba(2,10,26,0.35),inset_0_1px_0_rgba(210,230,255,0.4)]'
              : 'border-white/20 bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.28)]'
          }`}
          style={{ WebkitAppRegion: 'no-drag' }}
          aria-label="Controllers"
          aria-hidden={!signedIn}
        >
          {NAV.map((item) => {
            const on = item.id === 'settings' ? settingsOpen : pad === item.id && !settingsOpen
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'settings') {
                    setMenuOpen(false)
                    setSettingsOpen((open) => !open)
                    return
                  }
                  setSettingsOpen(false)
                  setPad(item.id)
                }}
                style={{ WebkitAppRegion: 'no-drag' }}
                className={`rounded-full px-5 py-2 text-[12px] font-semibold tracking-[0.18em] uppercase transition-colors ${on ? 'bg-white text-black shadow-[0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(0,0,0,0.25)]' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                aria-pressed={on}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="absolute right-4" style={{ pointerEvents: 'auto' }}>
          <WindowControls pad={signedIn ? pad : 'xbox'} />
        </div>
      </header>
      {signedIn ? <ConnectionStatus pad={pad} names={controllers} /> : null}
      {gateReady && !signedIn ? <ControllerLogin onEnter={setSession} /> : null}
      <ControllerOptimizer open={signedIn && menuOpen} pad={pad} onPadChange={setPad} onClose={() => setMenuOpen(false)} />
      <ControllerSettings
        open={signedIn && settingsOpen}
        pad={pad}
        driver={driver}
        busy={driverBusy}
        route={driver ? driverRoute : ''}
        onClose={() => setSettingsOpen(false)}
        onPower={powerDriver}
      />
      <Canvas
        className="absolute inset-0"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 34, near: 0.08, far: 180, position: [0, 0.15, 5.8] }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0)
        }}
      >
        <Scene focus={signedIn ? pad : 'pair'} />
      </Canvas>
    </div>
  )
}
