import { Power } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'

export default function KeyboardSettings({ open, driverOn, busy, route, onClose, onPower }) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-8" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" aria-label="Close settings" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <section role="dialog" aria-label="Keyboard driver settings" className="relative w-full max-w-[720px] rounded-[28px] border border-white/15 bg-[#0b0e14]/88 px-8 py-8 shadow-[0_48px_140px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl">
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
          <p className="text-[11px] font-semibold tracking-[0.32em] text-white/45 uppercase">Keyboard driver</p>
          <p className="mt-2 max-w-[34rem] text-[14px] leading-relaxed text-white/70">
            Power this on before a delay applies. While it is off, the keys and the polling rate stay on your real keyboard.
          </p>
        </div>

        <div className={`mt-6 flex items-center justify-between gap-6 rounded-[24px] border px-6 py-5 ${driverOn ? 'border-white/70 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-white/40 uppercase">Keyboard</p>
            <p className="font-display mt-1 text-[28px] leading-none font-semibold tracking-[-0.04em] text-white">Keyboard input</p>
            <p className="mt-2 max-w-[28rem] text-[13px] leading-relaxed text-white/55">Delay and polling apply to the keyboard only while this driver is on.</p>
          </div>
          <button
            type="button"
            onClick={onPower}
            disabled={busy}
            aria-pressed={driverOn}
            aria-label={driverOn ? 'Turn off keyboard input' : 'Turn on keyboard input'}
            className={`grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full border transition-colors ${
              driverOn
                ? 'border-white bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
                : 'border-white/15 bg-black/40 text-white/70 hover:border-white/40 hover:text-white'
            } ${busy ? 'opacity-60' : ''}`}
          >
            <Power className="h-6 w-6" />
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.18em] text-white/50 uppercase">
          {driverOn ? `Keyboard input is on${route ? ` · ${route}` : ''}` : 'The driver is off. Your keyboard is unchanged.'}
        </p>
      </section>
    </div>
  )
}
