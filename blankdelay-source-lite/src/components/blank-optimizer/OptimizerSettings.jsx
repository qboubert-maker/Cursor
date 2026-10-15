import { useEffect, useState } from 'react'

const DRIVERS = [
  {
    id: 'keyboard',
    kicker: 'Keyboard',
    title: 'Keyboard input',
    detail: 'Delay applies to the keyboard only while this driver is on. While it is off, your keys stay on the real keyboard.',
  },
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

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5v7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.4 6.8a7 7 0 1 0 9.2 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function OptimizerSettings() {
  const [keyboardOn, setKeyboardOn] = useState(false)
  const [pad, setPad] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancel = false
    const pull = async () => {
      const api = window.optimizerWindow
      const [keys, pads] = await Promise.all([
        api?.keyboardStatus?.().catch(() => null),
        api?.padStatus?.().catch(() => null),
      ])
      if (cancel) return
      setKeyboardOn(Boolean(keys?.status?.running))
      const running = Boolean(pads?.status?.running)
      setPad(running ? (pads?.status?.output === 'xbox' ? 'xbox' : 'ps5') : null)
    }
    pull()
    return () => {
      cancel = true
    }
  }, [])

  const powerKeyboard = async () => {
    if (busy) return
    const api = window.optimizerWindow
    setBusy(true)
    setNote('')
    try {
      const result = keyboardOn ? await api?.keyboardStop?.() : await api?.keyboardStart?.()
      const on = Boolean(result?.status?.running)
      setKeyboardOn(on)
      setNote(result?.ok === false ? (result.error || 'Could not change the keyboard driver.') : '')
    } finally {
      setBusy(false)
    }
  }

  const powerPad = async (id) => {
    if (busy) return
    const api = window.optimizerWindow
    setBusy(true)
    setNote('')
    try {
      if (pad === id) {
        const result = await api?.padStop?.()
        setPad(result?.status?.running ? id : null)
        if (result?.ok === false) setNote(result.error || 'Could not turn that driver off.')
        return
      }
      await api?.padOutput?.(id)
      const result = await api?.padStart?.(id)
      const on = Boolean(result?.status?.running)
      setPad(on ? id : null)
      if (result?.ok === false) setNote(result.error || 'Could not turn that driver on.')
    } finally {
      setBusy(false)
    }
  }

  const live = keyboardOn || pad
  const summary = [
    keyboardOn ? 'Keyboard input is on' : '',
    pad === 'ps5' ? 'DualShock 4 is on' : '',
    pad === 'xbox' ? 'Xbox input is on' : '',
  ].filter(Boolean).join(' · ')

  return (
    <section className="blank-settings" aria-label="Settings">
      <div className="blank-settings__card">
        <p className="blank-settings__kicker">Settings</p>
        <h1>Drivers</h1>
        <p className="blank-settings__lead">Power on one controller driver at a time. DualShock 4 and Xbox never send input together. The keyboard driver stays off until you turn it on.</p>
        <div className="blank-settings__list">
          {DRIVERS.map((item) => {
            const on = item.id === 'keyboard' ? keyboardOn : pad === item.id
            const press = item.id === 'keyboard' ? powerKeyboard : () => powerPad(item.id)
            return (
              <article key={item.id} className={on ? 'is-on' : ''}>
                <div>
                  <p>{item.kicker}</p>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </div>
                <button type="button" aria-pressed={on} disabled={busy} aria-label={on ? `Turn off ${item.title}` : `Turn on ${item.title}`} onClick={press}>
                  <PowerIcon />
                </button>
              </article>
            )
          })}
        </div>
        <p className="blank-settings__status" role="status">{note || (live ? summary : 'The drivers are off. Your keyboard and controller are unchanged.')}</p>
      </div>
    </section>
  )
}
