import { useEffect, useState } from 'react'
import AkatsukiController from './AkatsukiController.jsx'
import { DELAYS, formatHz, formatMs, sameMs } from './delayScale.js'
import useAppActive from './useAppActive.js'

const LOGO = `${import.meta.env.BASE_URL}Blank Delay Logo.png`

const BINDS = [
  { id: 'l3', engine: 'L3', ps: 'L3', xbox: 'LS', name: 'Left stick' },
  { id: 'r3', engine: 'R3', ps: 'R3', xbox: 'RS', name: 'Right stick' },
  { id: 'l1', engine: 'L1', ps: 'L1', xbox: 'LB', name: 'Left bumper' },
  { id: 'r1', engine: 'R1', ps: 'R1', xbox: 'RB', name: 'Right bumper' },
  { id: 'l2', engine: 'L2', ps: 'L2', xbox: 'LT', name: 'Left trigger' },
  { id: 'r2', engine: 'R2', ps: 'R2', xbox: 'RT', name: 'Right trigger' },
  { id: 'north', engine: 'Y', ps: '△', xbox: 'Y', name: 'Face up' },
  { id: 'east', engine: 'B', ps: '○', xbox: 'B', name: 'Face right' },
  { id: 'west', engine: 'X', ps: '□', xbox: 'X', name: 'Face left' },
  { id: 'south', engine: 'A', ps: '✕', xbox: 'A', name: 'Face down' },
  { id: 'up', engine: 'UP', ps: '↑', xbox: '↑', name: 'D-pad up' },
  { id: 'down', engine: 'DOWN', ps: '↓', xbox: '↓', name: 'D-pad down' },
  { id: 'left', engine: 'LEFT', ps: '←', xbox: '←', name: 'D-pad left' },
  { id: 'right', engine: 'RIGHT', ps: '→', xbox: '→', name: 'D-pad right' },
  { id: 'share', engine: 'SHARE', ps: 'Share', xbox: 'View', name: 'Share' },
  { id: 'options', engine: 'OPTIONS', ps: 'Options', xbox: 'Menu', name: 'Options' },
  { id: 'touch', engine: 'TOUCH', ps: 'Touch', xbox: 'Touch', name: 'Touchpad' },
  { id: 'ps', engine: 'PS', ps: 'PS', xbox: 'Xbox', name: 'Guide' },
]

export default function ControllerInput({ pad = 'ps5', onPadChange, live = true }) {
  const active = useAppActive()
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState('l3')
  const [delay, setDelay] = useState(0)
  const [liveDelay, setLiveDelay] = useState(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [rate, setRate] = useState('')
  const [driverOn, setDriverOn] = useState(false)
  const bind = BINDS.find((item) => item.id === selected) || BINDS[0]
  const label = pad === 'ps5' ? bind.ps : bind.xbox
  const pending = !driverOn || !sameMs(liveDelay, delay)
  const shown = live && active
  const watching = shown && !menuOpen

  useEffect(() => {
    if (!watching) return undefined
    const held = new Map()
    let frame = 0
    const tick = () => {
      const navOpen = document.querySelector('.blank-nav.is-open')
      if (!navOpen) {
        const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
        let edge = false
        for (const gamepad of pads) {
          if (!gamepad) continue
          const last = held.get(gamepad.index) || []
          gamepad.buttons.forEach((button, index) => {
            const down = Boolean(button.pressed) || button.value > 0.55
            if (down && !last[index]) edge = true
            last[index] = down
          })
          held.set(gamepad.index, last)
        }
        if (edge) setMenuOpen(true)
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [watching])

  useEffect(() => {
    if (!watching) return undefined
    let stopped = false
    let last = 0
    const watch = async () => {
      while (!stopped) {
        const result = await window.optimizerWindow?.padStatus?.()
        if (stopped) break
        if (result?.status?.running) {
          const count = Number(result.status.buttonPresses) || 0
          if (last && count !== last) setMenuOpen(true)
          last = count
        }
        await new Promise((resolve) => window.setTimeout(resolve, result?.status?.running ? 120 : 1000))
      }
    }
    watch()
    return () => {
      stopped = true
    }
  }, [watching])

  useEffect(() => {
    if (!menuOpen || !active) return undefined
    let cancel = false
    const pull = async (syncSelection) => {
      const result = await window.optimizerWindow?.padStatus?.()
      if (cancel || !result?.status) return
      const on = Boolean(result.status.running)
      const saved = Number(result.status.profiles?.[pad]?.[bind.engine] ?? 0)
      const liveValue = Number(on ? (result.status.delays?.[bind.engine] ?? saved) : saved)
      setDriverOn(on)
      setLiveDelay(Number.isFinite(liveValue) ? liveValue : 0)
      if (syncSelection) setDelay(Number.isFinite(saved) ? saved : 0)
      setRate(on ? [result.status.route, result.status.pollMessage].filter(Boolean).join(' · ') : 'Applying turns the controller driver on.')
    }
    pull(true)
    const timer = window.setInterval(() => pull(false), 500)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [menuOpen, pad, bind.engine, active])

  const apply = async () => {
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      const result = await window.optimizerWindow?.padApply?.(pad, bind.engine, delay)
      if (result?.ok) {
        setDriverOn(Boolean(result.status?.running ?? true))
        setLiveDelay(delay)
        return
      }
      setNote(result?.error || 'Turn on the DualShock 4 or Xbox driver in Settings first.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="blank-pad blank-pad--theme">
      <div className="blank-pad__glow" aria-hidden="true" />
      <button type="button" className="blank-pad__hit" aria-label="Open controller optimizer" onClick={() => setMenuOpen(true)}>
        <AkatsukiController pad={pad} running={shown} />
      </button>
      {menuOpen ? (
        <div className="blank-menu">
          <button type="button" className="blank-menu__backdrop" aria-label="Close optimizer" onClick={() => setMenuOpen(false)} />
          <section role="dialog" aria-label="Controller optimizer" className="blank-menu__card">
            <div className="blank-menu__head">
              <div className="blank-menu__brand">
                <img src={LOGO} alt="" />
                <div>
                  <strong>BLANK DELAY</strong>
                  <p>Controller optimizer</p>
                </div>
              </div>
              <div className="blank-menu__tools">
                <div className="blank-menu__switch">
                  <button type="button" className={pad === 'ps5' ? 'is-on' : ''} aria-pressed={pad === 'ps5'} onClick={() => onPadChange?.('ps5')}>PS5</button>
                  <button type="button" className={pad === 'xbox' ? 'is-on' : ''} aria-pressed={pad === 'xbox'} onClick={() => onPadChange?.('xbox')}>Xbox</button>
                </div>
                <button type="button" className="blank-menu__close" aria-label="Close" onClick={() => setMenuOpen(false)}>×</button>
              </div>
            </div>
            <div className="blank-menu__block">
              <div className="blank-menu__row">
                <p className="blank-menu__kicker">Bind</p>
                <p className="blank-menu__kicker">{bind.name}</p>
              </div>
              <div className="blank-menu__binds" role="listbox" aria-label="Controller bind">
                {BINDS.map((item) => (
                  <button key={item.id} type="button" className={item.id === bind.id ? 'is-on' : ''} aria-pressed={item.id === bind.id} onClick={() => { setSelected(item.id); setNote('') }}>
                    {pad === 'ps5' ? item.ps : item.xbox}
                  </button>
                ))}
              </div>
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
                <span>{label} · {formatMs(liveDelay)} ms · {formatHz(liveDelay)} Hz</span>
                <small>{!driverOn ? 'Driver off' : pending ? 'Pending' : 'Matched'}</small>
              </div>
            </div>
            <div className="blank-menu__steps">
              <div className="blank-pad__steps" role="listbox" aria-label="Delay">
                {DELAYS.map((value) => {
                  const on = sameMs(value, delay)
                  const passed = value < delay - 0.005
                  return (
                    <button key={value} type="button" className={on ? 'is-on' : passed ? 'is-passed' : ''} aria-selected={on} onClick={() => { setDelay(value); setNote('') }}>
                      <span>{formatMs(value)}</span>
                      <small>{formatHz(value)}</small>
                    </button>
                  )
                })}
              </div>
            </div>
            <button type="button" className={pending ? 'blank-menu__apply is-ready' : 'blank-menu__apply'} disabled={busy || !pending} onClick={apply}>
              {busy ? 'Applying' : pending ? `Apply ${label} · ${formatMs(delay)} ms · ${formatHz(delay)} Hz` : `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz applied`}
            </button>
            <p className="blank-menu__note" role="status">{note || rate}</p>
          </section>
        </div>
      ) : null}
    </section>
  )
}
