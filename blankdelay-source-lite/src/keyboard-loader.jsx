import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import VolumetricClouds from './components/VolumetricClouds.jsx'
import KeyboardOptimizer from './components/KeyboardOptimizer.jsx'
import KeyboardSettings from './components/KeyboardSettings.jsx'
import KeyboardLogin from './components/KeyboardLogin.jsx'
import { rig } from './lib/rig.js'
import './index.css'

const KEYBOARD_ART = `${import.meta.env.BASE_URL}apex-3-tkl.png`

const COLORS = [
  { id: 'white', label: 'White', hex: null, swatch: '#f2f2f2' },
  { id: 'red', label: 'Red', hex: '#ff2d2d', swatch: '#ff2d2d' },
  { id: 'orange', label: 'Orange', hex: '#ff7a18', swatch: '#ff7a18' },
  { id: 'yellow', label: 'Yellow', hex: '#ffe14a', swatch: '#ffe14a' },
  { id: 'green', label: 'Green', hex: '#3dff6e', swatch: '#3dff6e' },
  { id: 'cyan', label: 'Cyan', hex: '#3de7ff', swatch: '#3de7ff' },
  { id: 'blue', label: 'Blue', hex: '#4d7cff', swatch: '#4d7cff' },
  { id: 'purple', label: 'Purple', hex: '#b44dff', swatch: '#b44dff' },
  { id: 'pink', label: 'Pink', hex: '#ff4d9a', swatch: '#ff4d9a' },
]

function backdropOf(hex) {
  if (!hex) return '#000000'
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift) => Math.round(((value >> shift) & 255) * 0.16).toString(16).padStart(2, '0')
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

function AboutClouds({ tint, backdrop }) {
  const { scene } = useThree()

  useEffect(() => {
    rig.clouds = 1
    rig.fog = 0.014
    rig.flash = 0
    rig.speed = 0
    rig.logo = 0.45
    rig.glow = 0.28
    rig.logoX = 0
    rig.logoY = 0.48
    rig.logoZ = 2.4
    rig.parallax = 0.2
  }, [])

  useEffect(() => {
    if (!scene.background) scene.background = new THREE.Color(backdrop)
    else scene.background.set(backdrop)
    if (!scene.fog) scene.fog = new THREE.FogExp2(backdrop, 0.014)
    else scene.fog.color.set(backdrop)
  }, [scene, backdrop])

  return <VolumetricClouds tint={tint} />
}

function Loader() {
  const win = window.keyboardWindow
  const [panel, setPanel] = useState(null)
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [driverOn, setDriverOn] = useState(false)
  const [driverBusy, setDriverBusy] = useState(false)
  const [driverRoute, setDriverRoute] = useState('')
  const [colorId, setColorId] = useState('white')
  const [light, setLight] = useState(0.82)
  const [devices, setDevices] = useState({ keyboards: [], mice: [] })
  const [hiddenDevices, setHiddenDevices] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const color = COLORS.find((item) => item.id === colorId) || COLORS[0]
  const backdrop = backdropOf(color.hex)

  useEffect(() => {
    let stopped = false
    const resume = async () => {
      const saved = await window.keyboardOptimizer?.rememberedKey?.()
      if (stopped || !saved?.key) return
      const result = await window.keyboardOptimizer?.validateLicense?.(saved.key)
      if (!stopped && result?.ok) setSignedIn(true)
    }
    resume()
    return () => {
      stopped = true
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return undefined
    let stopped = false
    const pull = async () => {
      const result = await window.keyboardOptimizer?.status?.()
      if (stopped || !result?.status) return
      setDriverOn(Boolean(result.status.running))
      if (result.status.route) setDriverRoute(result.status.route)
    }
    pull()
    const timer = window.setInterval(pull, 1000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [signedIn])

  useEffect(() => {
    if (!signedIn) return undefined
    let stopped = false
    const pull = async () => {
      const result = await window.keyboardOptimizer?.devices?.()
      if (stopped || !result?.ok) return
      setDevices({ keyboards: result.keyboards || [], mice: result.mice || [] })
    }
    pull()
    const timer = window.setInterval(pull, 1500)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [signedIn])

  const deviceKey = [...devices.keyboards, ...devices.mice].join('|')
  const showDevices = deviceKey.length > 0 && deviceKey !== hiddenDevices

  const toggleRgb = () => {
    setOptimizerOpen(false)
    setSettingsOpen(false)
    setPanel((current) => (current === 'rgb' ? null : 'rgb'))
  }

  const toggleSettings = () => {
    setOptimizerOpen(false)
    setPanel(null)
    setSettingsOpen((open) => !open)
  }

  const powerDriver = async () => {
    if (driverBusy) return
    setDriverBusy(true)
    try {
      const result = driverOn ? await window.keyboardOptimizer?.stop?.() : await window.keyboardOptimizer?.start?.()
      setDriverOn(Boolean(result?.status?.running))
      setDriverRoute(result?.status?.route || '')
    } finally {
      setDriverBusy(false)
    }
  }

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-black text-white${signedIn ? '' : ' locked'}`}>
      <Canvas
        className="pointer-events-none"
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 28, near: 0.08, far: 180, position: [0, 0.48, 6.15] }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.48, 0)
        }}
      >
        <AboutClouds tint={color.hex} backdrop={backdrop} />
      </Canvas>
      <div className="chrome">
        <button type="button" aria-label="Minimize" onClick={() => win?.minimize()}>–</button>
        <button type="button" aria-label="Expand" onClick={() => win?.maximize()}>□</button>
        <button type="button" aria-label="Close" onClick={() => win?.close()}>×</button>
      </div>
      <div className="pair">
        <div
          className="keyboard-wrap"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!signedIn) return
            setSettingsOpen(false)
            setPanel(null)
            setOptimizerOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            setSettingsOpen(false)
            setPanel(null)
            setOptimizerOpen(true)
          }}
        >
          <img className="keyboard" src={KEYBOARD_ART} alt="Keyboard" draggable="false" />
          <div
            className="keyboard-light glow"
            style={{
              opacity: color.hex ? light * 0.75 : 0,
              background: color.hex || 'transparent',
            }}
          />
          <div
            className="keyboard-light"
            style={{
              opacity: color.hex ? light : 0,
              background: color.hex || 'transparent',
            }}
          />
        </div>
        <img
          className="mouse"
          src={`${import.meta.env.BASE_URL}g502.webp`}
          alt="Mouse"
          draggable="false"
        />
      </div>
      {signedIn ? <div className="dock">
        {panel === 'rgb' && (
          <div className="sheet" role="listbox" aria-label="RGB colors">
            {COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === colorId}
                className={item.id === colorId ? 'swatch on' : 'swatch'}
                onClick={() => setColorId(item.id)}
              >
                <span className="dot" style={{ background: item.swatch }} />
                {item.label}
              </button>
            ))}
            <label className="light-label" htmlFor="keyboard-light">
              <span>Light</span>
              <span>{Math.round(light * 100)}</span>
            </label>
            <input
              id="keyboard-light"
              type="range"
              min="0"
              max="100"
              value={Math.round(light * 100)}
              style={{ accentColor: color.hex || '#ffffff' }}
              onChange={(event) => setLight(Number(event.target.value) / 100)}
            />
          </div>
        )}
        <nav className="nav" aria-label="Keyboard">
          <button type="button" className={panel === 'rgb' ? 'nav-btn on' : 'nav-btn'} aria-pressed={panel === 'rgb'} onClick={toggleRgb}>
            RGB
          </button>
          <button type="button" className={settingsOpen ? 'nav-btn on' : 'nav-btn'} aria-pressed={settingsOpen} onClick={toggleSettings}>
            Settings
          </button>
        </nav>
      </div> : null}
      {signedIn && showDevices ? (
        <div className="devices" role="status" aria-label="Connected devices">
          <div className="devices-head">
            <p>Connected</p>
            <button type="button" onClick={() => setHiddenDevices(deviceKey)}>Close</button>
          </div>
          {devices.keyboards.map((name, index) => (
            <p key={`keyboard-${index}`}>Keyboard · {name}</p>
          ))}
          {devices.mice.map((name, index) => (
            <p key={`mouse-${index}`}>Mouse · {name}</p>
          ))}
        </div>
      ) : null}
      {signedIn ? null : (
        <KeyboardLogin
          open={signOpen}
          onOpen={() => setSignOpen(true)}
          onClose={() => setSignOpen(false)}
          onEnter={() => {
            setSignOpen(false)
            setSignedIn(true)
          }}
        />
      )}
      <KeyboardOptimizer open={signedIn && optimizerOpen} driverOn={driverOn} onClose={() => setOptimizerOpen(false)} />
      <KeyboardSettings
        open={settingsOpen}
        driverOn={driverOn}
        busy={driverBusy}
        route={driverOn ? driverRoute : ''}
        onClose={() => setSettingsOpen(false)}
        onPower={powerDriver}
      />
      <style>{`
        .chrome {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 4;
          display: flex;
          gap: 2px;
          padding: 4px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.3);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .chrome button {
          width: 32px;
          height: 28px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
        }
        .chrome button:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
        .pair {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          padding-bottom: 108px;
          pointer-events: none;
          animation: rise 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .keyboard-wrap {
          position: relative;
          width: min(1040px, 74vw);
          pointer-events: auto;
          cursor: pointer;
        }
        .keyboard {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(0 28px 46px rgba(0, 0, 0, 0.65));
          user-select: none;
          -webkit-user-drag: none;
        }
        .keyboard-light {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: multiply;
          -webkit-mask-image: url('${KEYBOARD_ART}');
          mask-image: url('${KEYBOARD_ART}');
          -webkit-mask-size: 100% 100%;
          mask-size: 100% 100%;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-source-type: luminance;
          mask-mode: luminance;
        }
        .keyboard-light.glow {
          mix-blend-mode: screen;
          filter: blur(14px);
        }
        .locked .keyboard-wrap { pointer-events: none; cursor: default; }
        .locked .mouse { pointer-events: auto; cursor: pointer; }
        .locked .mouse:hover { filter: drop-shadow(0 22px 36px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.42)); }
        .sign-in__anywhere {
          position: absolute;
          inset: 0;
          z-index: 2;
          border: 0;
          background: transparent;
          cursor: pointer;
        }
        .sign-in__word {
          position: absolute;
          z-index: 3;
          left: 7%;
          top: 46%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          pointer-events: none;
          transition: opacity 0.45s ease;
        }
        .sign-in.is-open .sign-in__word { opacity: 0; }
        .sign-in__word span {
          font-family: var(--font-display);
          font-size: clamp(72px, 8vw, 118px);
          font-weight: 500;
          line-height: 0.82;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-shadow: 0 0 18px #000, 0 2px 0 #000;
        }
        .sign-in__word em {
          margin-top: 14px;
          font-style: normal;
          font-size: 18px;
          font-weight: 500;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.82);
        }
        .sign-in__word i {
          width: 72px;
          height: 1px;
          margin: 16px 0 14px;
          background: rgba(255, 255, 255, 0.85);
        }
        .sign-in__word small {
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.62);
        }
        .sign-in__gate {
          position: absolute;
          inset: 0;
          z-index: 6;
          display: grid;
          place-items: center;
          padding: 44px 24px 0;
        }
        .sign-in__back {
          position: absolute;
          top: 62px;
          left: 28px;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .sign-in__card {
          width: min(400px, calc(100vw - 48px));
          padding: 32px 32px 18px;
          border-radius: 28px;
          text-align: center;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 24%),
            linear-gradient(180deg, #26262b 0%, #121214 46%, #070708 100%);
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 30px 80px rgba(0, 0, 0, 0.55);
        }
        .sign-in__card img {
          width: 78px;
          height: 78px;
          margin: 0 auto 8px;
          object-fit: cover;
          mix-blend-mode: screen;
        }
        .sign-in__card p {
          margin: 0;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.42);
        }
        .sign-in__card h1 {
          margin: 8px 0 0;
          font-family: var(--font-display);
          font-size: 52px;
          font-weight: 500;
          line-height: 0.9;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .sign-in__card strong {
          display: block;
          margin-top: 10px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }
        .sign-in__lead {
          display: block;
          margin-top: 14px;
          color: rgba(255, 255, 255, 0.46);
          font-size: 13px;
          letter-spacing: 0;
          text-transform: none;
        }
        .sign-in__card label {
          display: grid;
          gap: 8px;
          margin: 22px 0 12px;
          text-align: left;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.45);
        }
        .sign-in__card input {
          height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.42);
          padding: 0 14px;
          color: #fff;
          letter-spacing: 0.08em;
        }
        .sign-in__card input:focus { outline: none; border-color: rgba(255, 255, 255, 0.5); }
        .sign-in__card button[type="submit"] {
          width: 100%;
          height: 48px;
          border: 0;
          border-radius: 14px;
          background: #f4f4f5;
          color: #111;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .sign-in__card button[type="submit"]:disabled { opacity: 0.7; }
        .sign-in__err {
          margin: 10px 0 0;
          text-align: left;
          letter-spacing: 0.04em;
          text-transform: none;
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
        }
        .sign-in__foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sign-in__foot button {
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .sign-in__foot code {
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          letter-spacing: 0.06em;
        }
        .mouse {
          height: min(340px, 42vh);
          width: auto;
          margin: 0 0 22px;
          display: block;
          filter: drop-shadow(0 22px 36px rgba(0, 0, 0, 0.55));
          user-select: none;
          -webkit-user-drag: none;
        }
        .dock {
          position: absolute;
          left: 50%;
          bottom: 22px;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transform: translateX(-50%);
        }
        .sheet {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: center;
          gap: 8px 8px;
          max-width: min(640px, 92vw);
          padding: 14px 16px 12px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(8, 8, 8, 0.72);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 24px 60px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(18px);
        }
        .swatch {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          min-width: 52px;
          padding: 0;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.48);
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .swatch.on { color: #fff; }
        .dot {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
        }
        .swatch.on .dot {
          box-shadow: 0 0 0 2px #fff, inset 0 0 0 1px rgba(255, 255, 255, 0.4);
        }
        .light-label {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-top: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.72);
        }
        .sheet input[type="range"] {
          width: 100%;
        }
        .nav {
          display: flex;
          gap: 4px;
          padding: 5px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.46);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 18px 40px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
        }
        .nav-btn {
          min-width: 118px;
          height: 38px;
          padding: 0 22px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .nav-btn.on,
        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
        }
        .devices {
          position: absolute;
          top: 22px;
          left: 22px;
          z-index: 5;
          width: min(360px, calc(100vw - 44px));
          padding: 16px 16px 14px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(8, 8, 8, 0.78);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 24px 60px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(18px);
        }
        .devices-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .devices-head p,
        .devices > p {
          margin: 0;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.88);
        }
        .devices-head p {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.45);
        }
        .devices > p + p { margin-top: 6px; }
        .devices button {
          height: 28px;
          padding: 0 12px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Loader />)
