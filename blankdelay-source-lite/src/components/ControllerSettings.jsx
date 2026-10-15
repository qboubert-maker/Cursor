import { Power } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'

const DRIVERS = [
  {
    id: 'ps5',
    kicker: 'PlayStation',
    title: 'DualShock 4',
    detail: 'Games see one PlayStation controller. Your real pad stays hidden, so the sticks cannot fight a second input.',
  },
  {
    id: 'xbox',
    kicker: 'Xbox',
    title: 'Xbox input',
    detail: 'Games see one Xbox controller. Your real pad stays hidden, so the view cannot spin between two devices.',
  },
]

export default function ControllerSettings({ open, pad, driver, busy, route, onClose, onPower }) {
  if (!open) return null
  const sony = pad === 'ps5'
  const glass = sony
    ? 'border-[#b7d4f5]/40 bg-[#06101f]/88 shadow-[0_48px_140px_rgba(2,8,20,0.72),inset_0_1px_0_rgba(210,230,255,0.42)]'
    : 'border-white/15 bg-[#0b0e14]/88 shadow-[0_48px_140px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22)]'
  const live = DRIVERS.find((item) => item.id === driver)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" aria-label="Close settings" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <section role="dialog" aria-label="Controller driver settings" className={`relative w-full max-w-[720px] rounded-[28px] border px-8 py-8 backdrop-blur-2xl ${glass}`}>
        <div className="flex items-center gap-3.5">
          <span className="relative block h-10 w-[4.1rem] overflow-hidden" aria-hidden="true">
            <img src={LOGO_URL} alt="" className="pointer-events-none absolute top-1/2 left-1/2 h-[6rem] w-[6rem] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen" />
          </span>
          <div>
            <p className="font-display stretch-wide text-[16px] leading-none font-extrabold tracking-[0.08em] text-white">BLANK DELAY</p>
            <p className="mt-1.5 text-[10px] font-semibold tracking-[0.28em] text-white/45 uppercase">Settings</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[11px] font-semibold tracking-[0.32em] text-white/45 uppercase">Controller driver</p>
          <p className="mt-2 max-w-[34rem] text-[14px] leading-relaxed text-white/70">
            Power on one driver. The other stays off, so DualShock 4 and Xbox never send input at the same time.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {DRIVERS.map((item) => {
            const on = driver === item.id
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-6 rounded-[24px] border px-6 py-5 ${
                  on
                    ? 'border-white/70 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.28em] text-white/40 uppercase">{item.kicker}</p>
                  <p className="font-display mt-1 text-[28px] leading-none font-semibold tracking-[-0.04em] text-white">{item.title}</p>
                  <p className="mt-2 max-w-[28rem] text-[13px] leading-relaxed text-white/55">{item.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onPower(item.id)}
                  disabled={busy}
                  aria-pressed={on}
                  aria-label={on ? `Turn off ${item.title}` : `Turn on ${item.title}`}
                  className={`grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full border transition-colors ${
                    on
                      ? 'border-white bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
                      : 'border-white/15 bg-black/40 text-white/70 hover:border-white/40 hover:text-white'
                  } ${busy ? 'opacity-60' : ''}`}
                >
                  <Power className="h-6 w-6" />
                </button>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.18em] text-white/50 uppercase">
          {live ? `${live.title} is on${route ? ` · ${route}` : ''}` : 'Both drivers are off. Games see your real controller.'}
        </p>
      </section>
    </div>
  )
}
