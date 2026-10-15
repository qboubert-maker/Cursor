import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'

export const SESSION_KEY = 'blank-delay-controller-session'

export function readControllerSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (saved?.keep && saved.key) return saved
  } catch {
    /* a broken saved session just shows the login again */
  }
  return null
}

export default function ControllerLogin({ onEnter }) {
  const [licenseKey, setLicenseKey] = useState('')
  const [keep, setKeep] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const openMenu = () => setOpen(true)
    window.addEventListener('blank-delay-open-login', openMenu)
    return () => window.removeEventListener('blank-delay-open-login', openMenu)
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    const key = licenseKey.trim()
    if (key.length < 8) {
      setError('Enter your license key')
      return
    }
    const redeem = window.controllerOptimizer?.redeemLicense
    if (!redeem) {
      setError('Open the Blank Delay app to sign in.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await redeem(key)
      if (!result?.ok) {
        setError(result?.message || 'That key was rejected.')
        return
      }
      const session = { key: result.key || key, keep, at: Date.now() }
      if (keep) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
      setLeaving(true)
      window.setTimeout(() => onEnter(session), 380)
    } finally {
      setBusy(false)
    }
  }

  const field =
    'mt-3 h-16 w-full rounded-[22px] border border-white/15 bg-black/50 px-5 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-white/50'

  return (
    <div
      className={`absolute inset-0 z-30 transition-opacity duration-500 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'} ${open ? '' : 'cursor-pointer'}`}
      onClick={() => {
        if (!open) setOpen(true)
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-[18%] text-center">
        <p className="text-[12px] font-semibold tracking-[0.48em] text-white/70 uppercase">Blank Delay</p>
        <h1 className="font-display stretch-wide mt-3 text-[92px] leading-[0.8] font-black tracking-[-0.06em] text-white uppercase">
          Sign
          <span className="block text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.92)]">in</span>
        </h1>
      </div>

      {open ? (
        <div className="absolute inset-0 grid place-items-center px-8" style={{ WebkitAppRegion: 'no-drag' }}>
          <button type="button" aria-label="Close sign in" className="pointer-events-auto absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
          <form
            onSubmit={submit}
            onClick={(event) => event.stopPropagation()}
            className="pointer-events-auto relative w-[min(760px,92vw)] rounded-[36px] border border-white/12 bg-[#07080c]/88 px-12 py-11 text-center shadow-[0_40px_120px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl"
            aria-label="Sign in"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={LOGO_URL} alt="" className="mx-auto h-16 w-16 object-cover mix-blend-screen" />
            <p className="font-display stretch-wide mt-5 text-[28px] leading-none font-black tracking-[0.18em] text-white uppercase">Blank Delay</p>
            <h2 className="font-display stretch-wide mt-4 text-[64px] leading-[0.82] font-black tracking-[-0.055em] text-white uppercase">
              Sign
              <span className="block text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.92)]">in</span>
            </h2>
            <label className="mt-8 block text-left">
              <span className="text-[11px] font-semibold tracking-[0.28em] text-white/75 uppercase">License key</span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={licenseKey}
                onChange={(event) => {
                  setLicenseKey(event.target.value)
                  setError('')
                }}
                placeholder="Enter your key"
                className={`${field} tracking-[0.12em]`}
              />
            </label>
            <label className="mt-6 flex items-center justify-center gap-2 text-[12px] font-medium tracking-[0.16em] text-white/75 uppercase">
              <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} className="h-4 w-4 accent-white" />
              Keep me signed in
            </label>
            {error ? <p className="mt-4 text-[13px] font-medium text-white/75">{error}</p> : null}
              <button
              type="submit"
              disabled={busy}
              className="font-display stretch-wide mt-7 h-[78px] w-full rounded-full bg-white text-[30px] font-black tracking-[-0.03em] text-black uppercase shadow-[0_18px_44px_rgba(0,0,0,0.35)] hover:bg-white/90 disabled:opacity-70"
            >
              {busy ? 'Checking' : 'Enter'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
