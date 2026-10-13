import { useEffect, useState } from 'react'
import { LOGO_URL } from '../lib/rig'

const PREFIXES = new Set(['ZD', 'FB', 'CO', 'PO', 'DL', 'CM', 'PU', 'KM', 'KO'])

function formatKey(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!raw) return ''
  if (raw.startsWith('BLANK')) {
    const rest = raw.slice(5)
    const prefix = rest.slice(0, 2)
    if (PREFIXES.has(prefix)) {
      const body = rest.slice(2)
      return ['BLANK', prefix, body.slice(0, 4), body.slice(4, 8)].filter(Boolean).join('-')
    }
    return ['BLANK', rest.slice(0, 4), rest.slice(4, 8)].filter(Boolean).join('-')
  }
  return raw
}

function clickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const start = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(ctx.destination)
    const click = ctx.createOscillator()
    click.type = 'square'
    click.frequency.setValueAtTime(220, start)
    click.frequency.exponentialRampToValueAtTime(70, start + 0.05)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07)
    click.connect(gain).connect(master)
    click.start(start)
    click.stop(start + 0.08)
  } catch {
    /* audio unavailable */
  }
}

export default function KeyboardLogin({ open, onOpen, onClose, onEnter }) {
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deviceId, setDeviceId] = useState('Device')

  useEffect(() => {
    let stopped = false
    window.keyboardOptimizer?.hardware?.().then((result) => {
      if (!stopped && result?.deviceId) setDeviceId(result.deviceId)
    })
    window.keyboardOptimizer?.rememberedKey?.().then((result) => {
      if (!stopped && result?.key) setLicenseKey(formatKey(result.key))
    })
    return () => {
      stopped = true
    }
  }, [])

  useEffect(() => {
    if (open) clickSound()
  }, [open])

  const submit = async () => {
    const key = formatKey(licenseKey)
    setLicenseKey(key)
    setError('')
    if (!key) {
      setError('Enter a license key.')
      return
    }
    const redeem = window.keyboardOptimizer?.redeemLicense
    if (!redeem) {
      setError('Open the Keyboard Optimizer app to sign in.')
      return
    }
    setBusy(true)
    try {
      const result = await redeem(key)
      if (!result?.ok) {
        setError(result?.message || 'That key was rejected.')
        return
      }
      onEnter()
    } catch {
      setError('Could not reach the Blank license bot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`sign-in${open ? ' is-open' : ''}`}>
      {open ? null : (
        <button type="button" className="sign-in__anywhere" aria-label="Sign in" onClick={onOpen} />
      )}
      <div className="sign-in__word">
        <span>Blank</span>
        <em>Keyboard Optimizer</em>
        <i />
        <small>Delay · Rate · Play</small>
      </div>
      {open ? (
        <section className="sign-in__gate" aria-label="Sign in">
          <button type="button" className="sign-in__back" onClick={onClose}>Return</button>
          <form
            className="sign-in__card"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <img src={LOGO_URL} alt="" draggable="false" />
            <p>Sign in</p>
            <h1>Blank</h1>
            <strong>Keyboard Optimizer</strong>
            <span className="sign-in__lead">Enter your license key to open the board.</span>
            <label htmlFor="optimizer-key">
              License key
              <input
                id="optimizer-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                maxLength={22}
                placeholder="BLANK-KO-XXXX-XXXX"
                value={licenseKey}
                onChange={(event) => {
                  setLicenseKey(formatKey(event.target.value))
                  setError('')
                }}
              />
            </label>
            <button type="submit" disabled={busy}>{busy ? 'Checking' : 'Activate'}</button>
            {error ? <p className="sign-in__err">{error}</p> : null}
            <div className="sign-in__foot">
              <button type="button" onClick={() => window.keyboardOptimizer?.openDiscord?.()}>Discord</button>
              <code>{deviceId}</code>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}
