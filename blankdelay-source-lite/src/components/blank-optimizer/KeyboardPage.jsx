import { useEffect, useRef, useState } from 'react'
import { DELAYS, formatHz, formatMs, sameMs } from './delayScale.js'
import useAppActive from './useAppActive.js'

const ART = `${import.meta.env.BASE_URL}apex-3-tkl.png`
const MOUSE = `${import.meta.env.BASE_URL}g502.webp`
const LOGO = `${import.meta.env.BASE_URL}Blank Delay Logo.png`

const COLORS = [
  { id: 'blank', label: 'Blank RGB', hex: '#c8102e', rgb: '200, 16, 46' },
  { id: 'nouzen', label: 'Nouzen RGB', hex: '#7c3fd6', rgb: '124, 63, 214' },
  { id: 'fraud', label: 'Fraud RGB', hex: '#2e8ce6', rgb: '46, 140, 230' },
  { id: 'droxzbtw', label: 'Droxzbtw RGB', hex: '#e0701c', rgb: '224, 112, 28' },
  { id: 'murder', label: 'Murder RGB', hex: '#6c849e', rgb: '108, 132, 158' },
  { id: 'xeno', label: 'Xeno RGB', hex: '#24945c', rgb: '36, 148, 92' },
]
const COLOR_KEY = 'blank-optimizer-keyboard-rgb'
const LIGHT_KEY = 'blank-optimizer-keyboard-light'

function readColor() {
  const saved = window.localStorage.getItem(COLOR_KEY)
  return COLORS.some((item) => item.id === saved) ? saved : COLORS[0].id
}

function readLight() {
  const saved = Number(window.localStorage.getItem(LIGHT_KEY))
  return Number.isFinite(saved) && saved >= 0 && saved <= 1 && window.localStorage.getItem(LIGHT_KEY) !== null ? saved : 0.9
}

const NAMED = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Esc', 32: 'Space',
  37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down',
  160: 'Left Shift', 161: 'Right Shift', 162: 'Left Ctrl', 163: 'Right Ctrl', 164: 'Left Alt', 165: 'Right Alt',
  257: 'Mouse 1', 258: 'Mouse 2', 259: 'Mouse 3', 260: 'Mouse 4', 261: 'Mouse 5', 262: 'Wheel up', 263: 'Wheel down',
}

const CODE_VK = {
  ShiftLeft: 160, ShiftRight: 161, ControlLeft: 162, ControlRight: 163,
  AltLeft: 164, AltRight: 165, MetaLeft: 91, MetaRight: 92,
}

function knownCode(code) {
  return Number.isInteger(code) && code >= 1 && code <= 263
}

function labelFor(code) {
  const value = Number(code)
  if (NAMED[value]) return NAMED[value]
  if (value >= 48 && value <= 57) return String.fromCharCode(value)
  if (value >= 65 && value <= 90) return String.fromCharCode(value)
  if (value >= 112 && value <= 135) return `F${value - 111}`
  return `Key ${value}`
}

function vkFromEvent(event) {
  if (CODE_VK[event.code]) return CODE_VK[event.code]
  const vk = event.keyCode || 0
  return vk >= 1 && vk <= 255 ? vk : 0
}

function mouseCode(button) {
  if (button === 0) return 257
  if (button === 2) return 258
  if (button === 1) return 259
  if (button === 3) return 260
  if (button === 4) return 261
  return 0
}

export default function KeyboardPage() {
  const active = useAppActive()
  const [menuOpen, setMenuOpen] = useState(false)
  const [rate, setRate] = useState('')
  const [rgbOpen, setRgbOpen] = useState(false)
  const [bind, setBind] = useState(null)
  const [binds, setBinds] = useState([])
  const [delay, setDelay] = useState(0)
  const [liveDelay, setLiveDelay] = useState(0)
  const [driverOn, setDriverOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [colorId, setColorId] = useState(readColor)
  const [light, setLight] = useState(readLight)
  const profiles = useRef({})
  const touched = useRef(false)
  const bindRef = useRef(null)
  const color = COLORS.find((item) => item.id === colorId) || COLORS[0]
  const pending = Boolean(bind) && (!driverOn || !sameMs(liveDelay, delay))

  const remember = (code, label) => {
    if (!knownCode(code)) return
    const next = { code, label: label || labelFor(code) }
    bindRef.current = next
    touched.current = false
    setBind(next)
    setBinds((current) => [next, ...current.filter((item) => item.code !== code)].slice(0, 18))
    const saved = Number(profiles.current[String(code)])
    const value = Number.isFinite(saved) ? saved : 0
    setDelay(value)
    setLiveDelay(driverOn ? value : 0)
    setNote('')
  }

  useEffect(() => {
    bindRef.current = bind
  }, [bind])

  useEffect(() => {
    window.localStorage.setItem(COLOR_KEY, colorId)
  }, [colorId])

  useEffect(() => {
    window.localStorage.setItem(LIGHT_KEY, String(light))
  }, [light])

  useEffect(() => {
    if (!menuOpen || !active) return undefined
    let cancel = false
    const pull = async () => {
      const result = await window.optimizerWindow?.keyboardStatus?.()
      if (cancel || !result?.status) return
      profiles.current = result.status.profiles || {}
      setDriverOn(Boolean(result.status.running))
      setRate(result.status.running ? (result.status.pollMessage || '') : 'Applying turns the keyboard driver on.')
      const current = bindRef.current
      if (current && !touched.current) {
        const saved = Number(profiles.current[String(current.code)])
        if (Number.isFinite(saved)) setDelay(saved)
        const live = Number(result.status.delays?.[String(current.code)] ?? saved)
        setLiveDelay(result.status.running && Number.isFinite(live) ? live : 0)
      }
      setBinds((current) => {
        const next = [...current]
        for (const key of Object.keys(profiles.current)) {
          const code = Math.round(Number(key))
          if (!knownCode(code) || next.some((item) => item.code === code)) continue
          next.push({ code, label: labelFor(code) })
        }
        return next.slice(0, 18)
      })
    }
    pull()
    const timer = window.setInterval(pull, 500)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [menuOpen, active])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => {
      if (event.repeat) return
      if (document.querySelector('.blank-nav.is-open')) return
      if (event.target?.closest?.('input, textarea')) return
      const code = vkFromEvent(event)
      if (!knownCode(code)) return
      event.preventDefault()
      event.stopPropagation()
      remember(code)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [menuOpen, driverOn])

  const openMenu = () => {
    setRgbOpen(false)
    setMenuOpen(true)
  }

  const toggleRgb = () => {
    setMenuOpen(false)
    setRgbOpen((open) => !open)
  }

  const apply = async () => {
    if (!bind || busy) return
    setBusy(true)
    setNote('')
    try {
      if (!driverOn) {
        const started = await window.optimizerWindow?.keyboardStart?.()
        if (!started?.ok) {
          setNote(started?.error || 'Could not turn on the keyboard driver.')
          return
        }
        setDriverOn(true)
      }
      const result = await window.optimizerWindow?.keyboardApply?.(bind.code, delay)
      if (result?.ok) {
        touched.current = true
        profiles.current = result.status?.profiles || profiles.current
        setLiveDelay(delay)
        setRate(result.status?.pollMessage || '')
        setNote('')
        return
      }
      setNote(result?.error || 'Turn on the keyboard driver in Settings first.')
    } finally {
      setBusy(false)
    }
  }

  const label = bind?.label || 'Press a key'

  return (
    <section className="blank-keys" aria-label="Keyboard" style={{ '--key-rgb': color.rgb, '--key-light': light }}>
      <div className="blank-keys__pair">
        <div className="blank-keys__visual" role="button" tabIndex={0} aria-label="Open keyboard optimizer" onClick={openMenu} onKeyDown={(event) => { if (event.key === 'Enter') openMenu() }}>
          <div className="blank-keys__underglow" aria-hidden="true" />
          <img src={ART} alt="Keyboard" draggable="false" />
          <div className="blank-keys__light" style={{ opacity: light }} />
          <div className="blank-keys__light is-glow" style={{ opacity: Math.min(1, light * 1.05) }} />
          <div className="blank-keys__light is-legend" style={{ opacity: light * 0.7 }} />
        </div>
        <img className="blank-keys__mouse" src={MOUSE} alt="Mouse" draggable="false" />
      </div>
      <div className="blank-keys__dock">
        {rgbOpen ? (
          <div className="blank-keys__sheet" role="listbox" aria-label="Keyboard color">
            {COLORS.map((item) => (
              <button key={item.id} type="button" role="option" aria-selected={item.id === color.id} className={item.id === color.id ? 'is-on' : ''} onClick={() => setColorId(item.id)}>
                <span style={{ background: item.hex }} />
                {item.label}
              </button>
            ))}
            <label htmlFor="keyboard-light">
              <span>Light</span>
              <span>{Math.round(light * 100)}</span>
            </label>
            <input id="keyboard-light" type="range" min="0" max="100" value={Math.round(light * 100)} style={{ accentColor: color.hex }} onChange={(event) => setLight(Number(event.target.value) / 100)} />
          </div>
        ) : null}
        <nav className="blank-keys__nav" aria-label="Keyboard">
          <button type="button" className={rgbOpen ? 'is-on' : ''} aria-pressed={rgbOpen} onClick={toggleRgb}>RGB</button>
        </nav>
      </div>
      {menuOpen ? (
        <div className="blank-menu">
          <button type="button" className="blank-menu__backdrop" aria-label="Close optimizer" onClick={() => setMenuOpen(false)} />
          <section role="dialog" aria-label="Keyboard optimizer" className="blank-menu__card">
            <div className="blank-menu__head">
              <div className="blank-menu__brand">
                <img src={LOGO} alt="" />
                <div>
                  <strong>BLANK DELAY</strong>
                  <p>Keyboard optimizer</p>
                </div>
              </div>
              <button type="button" className="blank-menu__close" aria-label="Close" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            <div className="blank-menu__block">
              <div className="blank-menu__row">
                <p className="blank-menu__kicker">Input</p>
                <p className="blank-menu__kicker">{bind ? label : 'Any key, mouse button, or wheel'}</p>
              </div>
              <div
                className="blank-menu__capture"
                onMouseDown={(event) => {
                  const code = mouseCode(event.button)
                  if (!code) return
                  event.preventDefault()
                  remember(code)
                }}
                onContextMenu={(event) => event.preventDefault()}
                onWheel={(event) => {
                  event.preventDefault()
                  remember(event.deltaY < 0 ? 262 : 263)
                }}
              >
                {bind ? label : 'Press a key, or click and scroll here'}
              </div>
              {binds.length > 0 ? (
                <div className="blank-menu__chips">
                  {binds.map((item) => (
                    <button key={item.code} type="button" className={item.code === bind?.code ? 'is-on' : ''} aria-pressed={item.code === bind?.code} onClick={() => remember(item.code, item.label)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="blank-menu__well">
              <div className="blank-menu__selected">
                <div>
                  <p className="blank-menu__kicker">Selected</p>
                  <strong className={label.length > 2 ? 'is-long' : ''}>{label}</strong>
                </div>
                <span className="blank-menu__rule" />
                <div className="blank-menu__delay">
                  <div>
                    <p className="blank-menu__kicker">Delay</p>
                    <strong>{formatMs(delay)}</strong>
                  </div>
                  <div className="blank-menu__units">
                    <p>ms</p>
                    <span>{formatHz(delay)} Hz</span>
                  </div>
                </div>
              </div>
              <div className="blank-menu__live">
                <p>Live</p>
                <span>{bind ? `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz` : 'Waiting for a key'}</span>
                <small>{driverOn ? (pending ? 'Pending' : 'Matched') : 'Driver off'}</small>
              </div>
            </div>
            <div className="blank-menu__steps">
              <div className="blank-keys__steps" role="listbox" aria-label="Delay">
                {DELAYS.map((value) => {
                  const on = sameMs(value, delay)
                  const passed = value < delay - 0.005
                  return (
                    <button key={value} type="button" className={on ? 'is-on' : passed ? 'is-passed' : ''} aria-selected={on} onClick={() => { touched.current = true; setDelay(value); setNote('') }}>
                      <span>{formatMs(value)}</span>
                      <small>{formatHz(value)}</small>
                    </button>
                  )
                })}
              </div>
            </div>
            <button type="button" className={pending && bind ? 'blank-menu__apply is-ready' : 'blank-menu__apply'} disabled={!bind || busy || !pending} onClick={apply}>
              {busy ? 'Applying' : !bind ? 'Press a key' : !driverOn && pending ? `Turn on and apply ${label} · ${formatMs(delay)} ms` : pending ? `Apply ${label} · ${formatMs(delay)} ms · ${formatHz(delay)} Hz` : `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz applied`}
            </button>
            <p className="blank-menu__note" role="status">{note || rate}</p>
          </section>
        </div>
      ) : null}
    </section>
  )
}
