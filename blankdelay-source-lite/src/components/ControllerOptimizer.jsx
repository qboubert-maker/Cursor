import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'
import { applyDelay, getActiveStatus, onStatus } from '../services/controllerService'

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

const DELAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const POLL_HZ = [8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8]

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

function labelFor(bind, pad) {
  return pad === 'ps5' ? bind.ps : bind.xbox
}

export default function ControllerOptimizer({ open, pad, onPadChange, onClose }) {
  const [selectedButton, setSelectedButton] = useState('l3')
  const [selectedDelay, setSelectedDelay] = useState(0)
  const [liveDelays, setLiveDelays] = useState({})
  const [isApplying, setIsApplying] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [measuredHz, setMeasuredHz] = useState(0)
  const [pollMessage, setPollMessage] = useState('')

  const bind = BINDS.find((item) => item.id === selectedButton) || BINDS[0]
  const label = labelFor(bind, pad)
  const liveDelay = Number(liveDelays[bind.engine] ?? 0)
  const pending = !sameMs(liveDelay, selectedDelay)
  const sony = pad === 'ps5'

  useEffect(() => {
    if (!open) return undefined
    let stopped = false
    const pull = async () => {
      const result = await getActiveStatus()
      if (stopped || !result?.status) return
      setLiveDelays(result.status.delays || {})
      const saved = result.status.profiles?.[pad]?.[bind.engine]
      if (Number.isFinite(Number(saved))) setSelectedDelay(Number(saved))
      if (result.status.route) setStatusMessage(result.status.route)
      if (result.status.pollMessage) setPollMessage(result.status.pollMessage)
      setMeasuredHz(Number(result.status.measuredHz) || 0)
    }
    pull()
    const off = onStatus((status) => {
      if (stopped || !status) return
      if (status.delays) setLiveDelays(status.delays)
      if (status.pollMessage) setPollMessage(status.pollMessage)
      setMeasuredHz(Number(status.measuredHz) || 0)
    })
    const watch = setInterval(async () => {
      const result = await getActiveStatus()
      if (stopped || !result?.status) return
      if (result.status.pollMessage) setPollMessage(result.status.pollMessage)
      setMeasuredHz(Number(result.status.measuredHz) || 0)
    }, 500)
    return () => {
      stopped = true
      clearInterval(watch)
      off()
    }
  }, [open, pad, bind.engine])

  const onApply = async () => {
    setIsApplying(true)
    setStatusMessage('')
    const result = await applyDelay(pad, bind.engine, selectedDelay)
    setIsApplying(false)
    if (result?.ok && result.status?.delays) {
      setLiveDelays(result.status.delays)
      setStatusMessage('')
      setPollMessage(result.status.pollMessage || '')
      setMeasuredHz(Number(result.status.measuredHz) || 0)
      return
    }
    setStatusMessage(result?.error || 'Could not apply')
  }

  if (!open) return null

  const glass = sony
    ? 'border-[#b7d4f5]/40 bg-[#06101f]/90 shadow-[0_48px_140px_rgba(2,8,20,0.7),inset_0_1px_0_rgba(210,230,255,0.45)]'
    : 'border-white/10 bg-[#0B0E14]/90 shadow-2xl'
  const well = sony ? 'border-[#b7d4f5]/20 bg-[#020814]/55' : 'border-white/10 bg-white/[0.04]'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" aria-label="Close optimizer" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section role="dialog" aria-label="Controller optimizer" className={`relative w-full max-w-[880px] rounded-2xl border px-9 py-8 backdrop-blur-xl ${glass}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <span className="relative block h-10 w-[4.1rem] overflow-hidden" aria-hidden="true">
              <img src={LOGO_URL} alt="" className="pointer-events-none absolute top-1/2 left-1/2 h-[6rem] w-[6rem] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen" />
            </span>
            <div>
              <p className="font-display stretch-wide text-[16px] leading-none font-extrabold tracking-[0.08em] text-white">BLANK DELAY</p>
              <p className="mt-1.5 text-[10px] font-semibold tracking-[0.28em] text-white/40 uppercase">Controller optimizer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              {['ps5', 'xbox'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onPadChange(mode)}
                  aria-pressed={pad === mode}
                  className={`rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase ${pad === mode ? 'bg-white font-bold text-black' : 'text-white/70 hover:text-white'}`}
                >
                  {mode === 'ps5' ? 'PS5' : 'XBOX'}
                </button>
              ))}
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.32em] text-white/45 uppercase">Bind</p>
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/35 uppercase">{bind.name}</p>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {BINDS.map((item) => {
              const on = item.id === selectedButton
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedButton(item.id)}
                  aria-pressed={on}
                  className={`h-11 rounded-2xl border text-[13px] font-semibold tracking-[0.08em] ${on ? 'border-white bg-white font-bold text-black' : 'border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white'}`}
                >
                  {labelFor(item, pad)}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`mt-6 flex items-end justify-between gap-8 rounded-[28px] border px-7 py-6 ${well}`}>
          <div className="flex items-end gap-7">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40 uppercase">Selected</p>
              <p className={`font-display mt-2 leading-none font-semibold tracking-[-0.06em] text-white ${label.length > 2 ? 'text-[42px]' : 'text-[92px]'}`}>{label}</p>
            </div>
            <span className="mb-4 h-16 w-px bg-white/15" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40 uppercase">Delay</p>
              <div className="mt-2 flex items-end gap-2">
                <p className={`font-display leading-none font-semibold tracking-[-0.07em] text-white ${formatMs(selectedDelay).length > 2 ? 'text-[72px]' : 'text-[92px]'}`}>{formatMs(selectedDelay)}</p>
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
              {label} · {formatMs(liveDelay)} ms · {formatHz(liveDelay)} Hz
            </p>
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">{measuredHz > 0 ? `Controller ${measuredHz} Hz` : pending ? `Pending: ${label} · ${formatMs(selectedDelay)} ms · ${formatHz(selectedDelay)} Hz` : 'Matched'}</p>
          </div>
        </div>

        <div className={`mt-6 rounded-[24px] border p-1.5 ${well}`}>
          <div className="grid grid-cols-11 gap-1">
            {DELAYS.map((value) => {
              const on = sameMs(value, selectedDelay)
              const passed = value < selectedDelay - 0.005
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedDelay(value)}
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
          onClick={onApply}
          disabled={isApplying || !pending}
          className={`mt-6 h-14 w-full rounded-full text-[13px] font-semibold tracking-[0.22em] uppercase ${isApplying ? 'animate-pulse bg-white text-black' : pending ? 'bg-white text-black shadow-[0_14px_36px_rgba(0,0,0,0.32)] hover:bg-white/90' : 'bg-white/10 text-white/65'}`}
        >
          {isApplying ? 'Applying' : pending ? `Apply ${label} · ${formatMs(selectedDelay)} ms · ${formatHz(selectedDelay)} Hz` : `${label} · ${formatMs(liveDelay)} ms · ${formatHz(liveDelay)} Hz applied`}
        </button>
        {pollMessage ? <p className="mt-3 text-center text-[11px] font-medium tracking-[0.14em] text-white/55 uppercase">{pollMessage}</p> : null}
        {statusMessage && statusMessage !== pollMessage ? <p className="mt-2 text-center text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase">{statusMessage}</p> : null}
      </section>
    </div>
  )
}
