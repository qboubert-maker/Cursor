import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'

const DELAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const POLL_HZ = [8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8]

const NAMED = {
  8: 'Backspace',
  9: 'Tab',
  13: 'Enter',
  19: 'Pause',
  20: 'Caps Lock',
  27: 'Esc',
  32: 'Space',
  33: 'Page Up',
  34: 'Page Down',
  35: 'End',
  36: 'Home',
  37: 'Left',
  38: 'Up',
  39: 'Right',
  40: 'Down',
  44: 'Print Screen',
  45: 'Insert',
  46: 'Delete',
  91: 'Left Win',
  92: 'Right Win',
  93: 'Menu',
  106: 'Num *',
  107: 'Num +',
  109: 'Num -',
  110: 'Num .',
  111: 'Num /',
  144: 'Num Lock',
  145: 'Scroll Lock',
  160: 'Left Shift',
  161: 'Right Shift',
  162: 'Left Ctrl',
  163: 'Right Ctrl',
  164: 'Left Alt',
  165: 'Right Alt',
  173: 'Mute',
  174: 'Volume Down',
  175: 'Volume Up',
  176: 'Next',
  177: 'Previous',
  179: 'Play',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
  257: 'Mouse 1',
  258: 'Mouse 2',
  259: 'Mouse 3',
  260: 'Mouse 4',
  261: 'Mouse 5',
  262: 'Wheel up',
  263: 'Wheel down',
}

const CODE_VK = {
  ShiftLeft: 160,
  ShiftRight: 161,
  ControlLeft: 162,
  ControlRight: 163,
  AltLeft: 164,
  AltRight: 165,
  MetaLeft: 91,
  MetaRight: 92,
  ContextMenu: 93,
}

function formatMs(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return '0'
  return String(Math.round(n))
}

function hzFor(value) {
  const step = Math.min(10, Math.max(0, Math.round(Number(value) || 0)))
  return POLL_HZ[step]
}

function formatHz(value) {
  const hz = hzFor(value)
  if (hz >= 1000) return `${hz / 1000}k`
  return String(hz)
}

function sameMs(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005
}

function knownCode(code) {
  return Number.isInteger(code) && code >= 1 && code <= 263
}

export function labelFor(code) {
  const value = Number(code)
  if (NAMED[value]) return NAMED[value]
  if (value >= 48 && value <= 57) return String.fromCharCode(value)
  if (value >= 65 && value <= 90) return String.fromCharCode(value)
  if (value >= 96 && value <= 105) return `Num ${value - 96}`
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

export default function KeyboardOptimizer({ open, driverOn, onClose }) {
  const [bind, setBind] = useState(null)
  const [binds, setBinds] = useState([])
  const [selectedDelay, setSelectedDelay] = useState(0)
  const [liveDelays, setLiveDelays] = useState({})
  const [isApplying, setIsApplying] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [measuredHz, setMeasuredHz] = useState(0)
  const [pollMessage, setPollMessage] = useState('')
  const profilesRef = useRef({})
  const touchedRef = useRef(false)
  const bindRef = useRef(null)

  const liveDelay = driverOn && bind ? Number(liveDelays[String(bind.code)] ?? 0) : 0
  const pending = Boolean(bind) && (!driverOn || !sameMs(liveDelay, selectedDelay))

  const remember = (code, label) => {
    if (!knownCode(code)) return
    const next = { code, label: label || labelFor(code) }
    bindRef.current = next
    touchedRef.current = false
    setBind(next)
    setBinds((current) => [next, ...current.filter((item) => item.code !== code)].slice(0, 18))
    const saved = profilesRef.current[String(code)]
    setSelectedDelay(Number.isFinite(Number(saved)) ? Number(saved) : 0)
  }

  useEffect(() => {
    bindRef.current = bind
  }, [bind])

  useEffect(() => {
    if (!open) return undefined
    let stopped = false
    const pull = async () => {
      const result = await window.keyboardOptimizer?.status?.()
      if (stopped || !result?.status) return
      const profiles = result.status.profiles || {}
      profilesRef.current = profiles
      setLiveDelays(result.status.delays || {})
      if (result.status.pollMessage) setPollMessage(result.status.pollMessage)
      setMeasuredHz(Number(result.status.measuredHz) || 0)
      const current = bindRef.current
      if (current && !touchedRef.current) {
        const saved = profiles[String(current.code)]
        if (Number.isFinite(Number(saved))) setSelectedDelay(Number(saved))
      }
      setBinds((current) => {
        const next = [...current]
        for (const key of Object.keys(profiles)) {
          const code = Math.round(Number(key))
          if (!knownCode(code) || next.some((item) => item.code === code)) continue
          next.push({ code, label: labelFor(code) })
        }
        return next.slice(0, 18)
      })
    }
    pull()
    const watch = setInterval(pull, 500)
    return () => {
      stopped = true
      clearInterval(watch)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.repeat) return
      if (event.target?.closest?.('input, textarea')) return
      const code = vkFromEvent(event)
      if (!knownCode(code)) return
      event.preventDefault()
      event.stopPropagation()
      remember(code)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const onApply = async () => {
    if (!bind) return
    setIsApplying(true)
    setStatusMessage('')
    const result = await window.keyboardOptimizer?.applyDelay?.(bind.code, selectedDelay)
    setIsApplying(false)
    if (result?.ok && result.status) {
      touchedRef.current = true
      setLiveDelays(result.status.delays || {})
      setPollMessage(result.status.pollMessage || '')
      setMeasuredHz(Number(result.status.measuredHz) || 0)
      if (result.status.profiles) profilesRef.current = result.status.profiles
      return
    }
    setStatusMessage(result?.error || 'Could not apply')
  }

  if (!open) return null

  const label = bind?.label || 'Press a key'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" data-bind-ignore aria-label="Close optimizer" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section role="dialog" aria-label="Keyboard optimizer" className="relative w-full max-w-[880px] rounded-2xl border border-white/10 bg-[#0B0E14]/90 px-9 py-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <span className="relative block h-10 w-[4.1rem] overflow-hidden" aria-hidden="true">
              <img src={LOGO_URL} alt="" className="pointer-events-none absolute top-1/2 left-1/2 h-[6rem] w-[6rem] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen" />
            </span>
            <div>
              <p className="font-display stretch-wide text-[16px] leading-none font-extrabold tracking-[0.08em] text-white">BLANK DELAY</p>
              <p className="mt-1.5 text-[10px] font-semibold tracking-[0.28em] text-white/40 uppercase">Keyboard optimizer</p>
            </div>
          </div>
          <button type="button" data-bind-ignore aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.32em] text-white/45 uppercase">Input</p>
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/35 uppercase">{bind ? label : 'Any key, mouse button, or wheel'}</p>
          </div>
          <div
            className="flex h-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] text-[15px] font-semibold tracking-[0.12em] text-white uppercase"
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
            <div className="mt-3 flex flex-wrap gap-2">
              {binds.map((item) => {
                const on = item.code === bind?.code
                return (
                  <button
                    key={item.code}
                    type="button"
                    data-bind-ignore
                    onClick={() => remember(item.code, item.label)}
                    aria-pressed={on}
                    className={`h-9 rounded-full border px-3 text-[12px] font-semibold tracking-[0.08em] ${on ? 'border-white bg-white font-bold text-black' : 'border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white'}`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-end justify-between gap-8 rounded-[28px] border border-white/10 bg-white/[0.04] px-7 py-6">
          <div className="flex items-end gap-7">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40 uppercase">Selected</p>
              <p className={`font-display mt-2 leading-none font-semibold tracking-[-0.06em] text-white ${label.length > 2 ? 'text-[42px]' : 'text-[92px]'}`}>{label}</p>
            </div>
            <span className="mb-4 h-16 w-px bg-white/15" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40 uppercase">Delay</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="font-display text-[92px] leading-none font-semibold tracking-[-0.07em] text-white">{formatMs(selectedDelay)}</p>
                <div className="mb-3">
                  <p className="text-[15px] font-medium tracking-[0.26em] text-white/50 uppercase">ms</p>
                  <p className="mt-1 text-[13px] font-semibold tracking-[0.18em] text-white/70 uppercase">{formatHz(selectedDelay)} Hz</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-2 flex flex-col items-end gap-2 text-right">
            <p className="text-[11px] font-semibold tracking-[0.24em] text-white/40 uppercase">Live</p>
            <p className="font-display text-[26px] leading-none font-semibold tracking-[-0.04em] text-white">
              {bind ? `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz` : 'Waiting for a key'}
            </p>
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
              {!driverOn ? 'Driver off' : measuredHz > 0 ? `Set to ${measuredHz} Hz` : pending ? `Pending: ${label} · ${formatMs(selectedDelay)} ms · ${formatHz(selectedDelay)} Hz` : 'Matched'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-1.5">
          <div className="grid grid-cols-11 gap-1">
            {DELAYS.map((value) => {
              const on = sameMs(value, selectedDelay)
              const passed = value < selectedDelay - 0.005
              return (
                <button
                  key={value}
                  type="button"
                  data-bind-ignore
                  onClick={() => {
                    touchedRef.current = true
                    setSelectedDelay(value)
                  }}
                  aria-pressed={on}
                  className={`h-14 rounded-[16px] font-semibold ${on ? 'bg-white font-bold text-black' : passed ? 'bg-white/16 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}
                >
                  <span className="block text-[14px] leading-none">{formatMs(value)}</span>
                  <span className={`mt-1 block text-[9px] leading-none tracking-[0.06em] ${on ? 'text-black/60' : 'text-white/40'}`}>{formatHz(value)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          data-bind-ignore
          onClick={onApply}
          disabled={isApplying || !bind || !pending}
          className={`mt-6 h-14 w-full rounded-full text-[13px] font-semibold tracking-[0.22em] uppercase ${isApplying ? 'animate-pulse bg-white text-black' : pending ? 'bg-white text-black shadow-[0_14px_36px_rgba(0,0,0,0.32)] hover:bg-white/90' : 'bg-white/10 text-white/65'}`}
        >
          {isApplying ? 'Applying' : !bind ? 'Press a key' : !driverOn && pending ? 'Turn on the keyboard driver' : pending ? `Apply ${label} · ${formatMs(selectedDelay)} ms · ${formatHz(selectedDelay)} Hz` : `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz applied`}
        </button>
        {pollMessage ? <p className="mt-3 text-center text-[11px] font-medium tracking-[0.14em] text-white/55 uppercase">{pollMessage}</p> : null}
        {statusMessage && statusMessage !== pollMessage ? <p className="mt-2 text-center text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase">{statusMessage}</p> : null}
      </section>
    </div>
  )
}
