import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useAppActive from './useAppActive.js'
import { clipBytesPerSecond, clipQualities } from './useClipCapture.js'

const BUFFERS = [
  [30, '30s'],
  [120, '2m'],
  [300, '5m'],
  [900, '15m'],
  [1800, '30m'],
  [3600, '1h'],
]

function qualityLabel(value) {
  return clipQualities().find(([item]) => item === Number(value))?.[1] || '1080p'
}

function MonitorHz({ value, disabled, onCommit }) {
  const [text, setText] = useState(value ? String(value) : '')
  useEffect(() => { setText(value ? String(value) : '') }, [value])
  const commit = () => {
    const rate = Math.round(Number(text))
    if (!text.trim()) {
      onCommit(0)
      return
    }
    if (rate >= 48 && rate <= 540) onCommit(rate)
    else setText(value ? String(value) : '')
  }
  return (
    <label className="blank-clips__hz" title="Clip frames lock to this refresh the next time replay starts. Recording stays on an even slice of it, so your game keeps its fps and delay.">
      <span>Monitor</span>
      <input
        inputMode="numeric"
        aria-label="Monitor hertz"
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
      <span>Hz</span>
    </label>
  )
}

function approx(bytes) {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `~${(mb / 1024).toFixed(1)} GB`
  if (mb >= 100) return `~${Math.round(mb / 10) * 10} MB`
  return `~${Math.max(1, Math.round(mb))} MB`
}

function bufferLabel(seconds) {
  return BUFFERS.find(([value]) => value === seconds)?.[1] || '2m'
}

function clock(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remain = safe % 60
  const body = `${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(remain).padStart(2, '0')}`
  return hours ? `${hours}:${body}` : body
}

function when(created) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(created)
  } catch {
    return ''
  }
}

function size(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function stamp() {
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

function padName(index, id) {
  if (!Number.isInteger(index) || index < 0) return 'Add button'
  const play = /054c|playstation|dualshock|dualsense|sony/i.test(id || '')
  const names = play
    ? ['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right']
    : ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right']
  return names[index] || `Button ${index + 1}`
}

function acceleratorFromEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return ''
  const mods = []
  if (event.ctrlKey) mods.push('Ctrl')
  if (event.altKey) mods.push('Alt')
  if (event.shiftKey) mods.push('Shift')
  if (event.metaKey) mods.push('Super')
  const named = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    '+': 'Plus',
    '-': 'Minus',
  }
  let key = named[event.key] || event.key
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(key)) key = key.toUpperCase()
  else if (key.length === 1) key = key.toUpperCase()
  if (!/^(F([1-9]|1[0-9]|2[0-4])|[A-Z0-9]|Space|Tab|Enter|Esc|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Plus|Minus|Backspace)$/.test(key)) return ''
  if (key === 'Esc' && !mods.length) return ''
  if (mods.length === 1 && mods[0] === 'Alt' && key === 'F4') return ''
  return [...mods, key].join('+')
}

function deviceName(device, kind, index) {
  const raw = String(device.label || '').replace(/^(Default|Communications)\s+-\s+/i, '').trim()
  if (raw) return raw
  return kind === 'audioinput' ? `Microphone ${index + 1}` : `Speakers ${index + 1}`
}

function deviceOptions(devices, kind, current) {
  const options = [['', 'Default'], ...devices.map((device, index) => [device.id, deviceName(device, kind, index)])]
  if (current && !options.some(([id]) => id === current)) options.push([current, kind === 'audioinput' ? 'Saved microphone' : 'Saved speakers'])
  return options
}

function ClipPick({ id, caption, value, options, disabled, open, setOpen, onChange, plain, title, onOpen }) {
  const ref = useRef(null)
  const shown = options.find(([item]) => String(item) === String(value))?.[1] || options[0][1]
  useEffect(() => {
    if (open !== id) return undefined
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen('')
    }
    const onEsc = (event) => {
      if (event.key === 'Escape') setOpen('')
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, id, setOpen])
  return (
    <div className={`blank-clips__pick${open === id ? ' is-open' : ''}${plain ? ' is-plain' : ''}`} ref={ref} title={title || undefined}>
      <span>{caption}</span>
      <button type="button" className="blank-clips__pick-btn" aria-haspopup="listbox" aria-expanded={open === id} disabled={disabled} onClick={() => {
        const next = open === id ? '' : id
        setOpen(next)
        if (next) onOpen?.()
      }}>
        <span>{shown}</span>
        <i aria-hidden="true" />
      </button>
      {open === id ? (
        <ul className="blank-clips__menu" role="listbox" aria-label={caption}>
          {options.map(([item, label, hint]) => (
            <li key={item}>
              <button type="button" role="option" aria-selected={String(item) === String(value)} onClick={() => { onChange(item); setOpen('') }}>
                {label}
                {hint ? <small>{hint}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function ClipsPage({ clips }) {
  const { status, stream, busy, spec } = clips
  const active = useAppActive()
  const videoRef = useRef(null)
  const playRef = useRef(null)
  const listRef = useRef(null)
  const nameRef = useRef(null)
  const [frame, setFrame] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [title, setTitle] = useState('')
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [armed, setArmed] = useState('')
  const [playing, setPlaying] = useState(null)
  const [playError, setPlayError] = useState(false)
  const framePull = useRef(clips.frame)
  const [fresh, setFresh] = useState('')
  const [menu, setMenu] = useState('')
  const [listening, setListening] = useState(false)
  const [bindHint, setBindHint] = useState('')
  const holdHotkeyRef = useRef(clips.holdHotkey)
  const setHotkeyRef = useRef(clips.setHotkey)
  const setPadArmRef = useRef(clips.setPadArm)
  const boundRef = useRef(0)
  framePull.current = clips.frame
  holdHotkeyRef.current = clips.holdHotkey
  setHotkeyRef.current = (hotkey) => clips.setHotkey(hotkey)
  setPadArmRef.current = clips.setPadArm
  const captureLocked = busy || status.phase === 'starting' || status.phase === 'recording' || status.phase === 'saving'
  const timeLocked = busy || status.phase === 'starting' || status.phase === 'saving'
  const limit = bufferLabel(status.maxSeconds)
  const qualityName = `${qualityLabel(spec.quality)}${status.fps ? ` ${status.fps}` : ''}`
  const perSecond = clipBytesPerSecond(spec.quality)
  const inputOptions = deviceOptions(clips.audioInputs || [], 'audioinput', status.micDevice)
  const outputOptions = deviceOptions(clips.audioOutputs || [], 'audiooutput', status.outputDevice)
  const qualityOptions = clipQualities().map(([value, label]) => [value, label, `${approx(clipBytesPerSecond(value) * 60)}/min`])
  const bufferOptions = BUFFERS.map(([value, label]) => [value, label, approx(perSecond * value)])
  const elapsed = status.startedAt ? Math.max(0, (now - status.startedAt) / 1000) : 0
  const shown = status.rolling ? Math.min(elapsed, status.maxSeconds) : elapsed
  const statusLabel = status.phase === 'recording' ? `Keeping the last ${limit}` : status.phase === 'saving' ? 'Saving clip' : status.phase === 'naming' ? 'Name your clip' : status.phase === 'starting' ? 'Starting replay' : 'Replay off'
  const encoderLine = status.checking ? 'Preparing recorder' : [qualityName, status.refresh ? `${status.refresh} Hz` : '', status.encoder, status.capture].filter(Boolean).join(' · ')
  const buttonLabel = busy || status.phase === 'starting' ? 'Starting…' : status.phase === 'saving' ? 'Saving…' : status.phase === 'recording' ? 'Stop & Save' : 'Start Replay'

  useEffect(() => {
    const node = videoRef.current
    if (!node) return undefined
    const live = active ? stream : null
    if (node.srcObject !== live) node.srcObject = live || null
    if (live) node.play().catch(() => {})
    return undefined
  }, [stream, active])

  useEffect(() => {
    const node = playRef.current
    if (!node?.setSinkId) return undefined
    node.setSinkId(status.outputDevice || '').catch(() => {})
    return undefined
  }, [playing, status.outputDevice])

  useEffect(() => {
    if (status.phase !== 'ready' || !active) return undefined
    let cancel = false
    const pull = () => {
      framePull.current().then((next) => { if (!cancel && next) setFrame(next) }).catch(() => {})
    }
    pull()
    const id = window.setInterval(pull, 2500)
    return () => {
      cancel = true
      window.clearInterval(id)
    }
  }, [status.phase, active])

  useEffect(() => {
    if (status.phase !== 'recording' || !active) return undefined
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [status.phase, active])

  useEffect(() => {
    if (status.phase !== 'naming') return undefined
    setTitle(`Clip_${stamp()}`)
    setNameError('')
    const focus = window.setTimeout(() => nameRef.current?.select(), 40)
    return () => window.clearTimeout(focus)
  }, [status.phase])

  useEffect(() => {
    if (!armed) return undefined
    const id = window.setTimeout(() => setArmed(''), 2800)
    return () => window.clearTimeout(id)
  }, [armed])

  const onRecord = () => {
    if (status.phase === 'recording') clips.stop()
    else clips.start()
  }

  const onSave = async (event) => {
    event.preventDefault()
    const next = title.trim()
    if (!next) {
      setNameError('Name the clip before saving.')
      return
    }
    setSavingName(true)
    const result = await clips.save(next)
    setSavingName(false)
    if (!result?.ok) {
      setNameError(result?.message || 'Could not save the clip.')
      return
    }
    setFresh(result.clip?.id || '')
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const usingPad = !status.hotkeyKey && Number.isInteger(status.padButton)
  const combo = usingPad ? [] : (status.hotkeyKey || 'Alt+F10').split('+').filter(Boolean)
  const clipLabel = usingPad ? padName(status.padButton, clips.padId) : ''
  const gameKey = !usingPad && status.hotkeyShared && combo.length === 1 && /^([A-Z0-9]|Space|Tab|Enter|Backspace|Up|Down|Left|Right)$/.test(combo[0])
  const note = clips.notice || status.error || status.warning || (
    gameKey
      ? `${combo[0]} also reaches your game, so each ${combo[0]} press saves a clip while replay runs. Pick a key your game leaves free, like F8.`
      : status.phase === 'recording'
        ? `${qualityName}. Press the clip key to save the last ${limit} that already happened.`
        : `${qualityName}. Start replay to keep the last ${limit}. The clip key saves that past stretch.`
  )

  useEffect(() => {
    if (!listening) return undefined
    setPadArmRef.current(true)
    holdHotkeyRef.current(true)
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setListening(false)
        return
      }
      const accel = acceleratorFromEvent(event)
      event.preventDefault()
      event.stopPropagation()
      if (!accel) {
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) setBindHint('Press one key, or one controller button.')
        return
      }
      setBindHint('')
      setListening(false)
      setHotkeyRef.current(accel)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      setPadArmRef.current(false)
      holdHotkeyRef.current(false)
    }
  }, [listening])

  useEffect(() => {
    if (!clips.clipBound || clips.clipBound === boundRef.current) return undefined
    boundRef.current = clips.clipBound
    setListening(false)
    setBindHint('')
    return undefined
  }, [clips.clipBound])

  return (
    <section className="blank-clips" aria-label="Clips">
      <header className="blank-clips__bar">
        <div className="blank-clips__status">
          <span className={status.phase === 'recording' ? 'is-live' : ''} aria-hidden="true" />
          <strong aria-live="polite">{statusLabel}</strong>
          <em>{encoderLine}</em>
        </div>
        <div className="blank-clips__tools">
          <button type="button" aria-pressed={status.mic} disabled={captureLocked} onClick={() => clips.setMic(!status.mic)}>Mic</button>
          <ClipPick id="input" caption="Input" value={status.micDevice || ''} options={inputOptions} open={menu} setOpen={setMenu} plain title="Your voice from this microphone is recorded into the clip." onOpen={clips.refreshAudio} onChange={(value) => clips.setMicDevice(value)} />
          <ClipPick id="output" caption="Output" value={status.outputDevice || ''} options={outputOptions} open={menu} setOpen={setMenu} plain title="Clips play through this device. Desktop audio records the sound your PC is playing." onOpen={clips.refreshAudio} onChange={(value) => clips.setOutputDevice(value)} />
          <button type="button" aria-pressed={status.desktop} disabled={captureLocked} onClick={() => clips.setDesktop(!status.desktop)}>Desktop</button>
          <ClipPick id="quality" caption="Quality" value={spec.quality} options={qualityOptions} disabled={captureLocked} open={menu} setOpen={setMenu} onChange={(value) => clips.setQuality(Number(value))} />
          <ClipPick id="buffer" caption="Buffer" value={status.maxSeconds} options={bufferOptions} disabled={timeLocked} open={menu} setOpen={setMenu} onChange={(value) => clips.setMax(Number(value))} />
          <MonitorHz value={status.refresh} onCommit={(monitor) => clips.setMonitor(monitor)} />
        </div>
      </header>

      <div className="blank-clips__grid">
        <article className="blank-clips__stage">
          <div className="blank-clips__preview">
            {stream ? <video ref={videoRef} muted playsInline autoPlay /> : frame ? <img src={frame} alt="" /> : <div className="blank-clips__preview-empty">Preview</div>}
            {encoderLine ? <span className="blank-clips__chip">{encoderLine}</span> : null}
            {status.phase === 'recording' ? (
              <strong className="blank-clips__timer">
                {clock(shown)}
                <small>{status.rolling ? `Last ${limit}` : limit}</small>
              </strong>
            ) : null}
          </div>
          <button type="button" className={`blank-clips__record${status.phase === 'recording' ? ' is-live' : ''}`} disabled={busy || (status.phase !== 'ready' && status.phase !== 'recording')} onClick={onRecord}>
            {buttonLabel}
          </button>
          <p className="blank-clips__hotkey">
            <span>Clip key</span>
            <button type="button" className={`blank-clips__bind${listening ? ' is-on' : ''}`} onClick={() => { setBindHint(''); setListening((value) => !value) }}>
              {listening ? 'Press one key' : clipLabel ? <kbd>{clipLabel}</kbd> : combo.map((part, index) => (
                <span key={`${part}-${index}`} className="blank-clips__combo">
                  {index > 0 ? <span>+</span> : null}
                  <kbd>{part}</kbd>
                </span>
              ))}
            </button>
            <span>{bindHint || (listening ? 'Esc cancels' : status.hotkey || clipLabel ? `saves the last ${limit}` : 'is in use elsewhere')}</span>
          </p>
          <p className={`blank-clips__note${status.error || clips.noticeError ? ' is-error' : ''}`}>{note}</p>
        </article>

        <article className="blank-clips__library">
          <h2>Saved Clips & Downloads</h2>
          {status.clips.length ? (
            <ul ref={listRef}>
              {status.clips.map((clip) => (
                <li key={clip.id} className={clip.id === fresh ? 'is-fresh' : ''}>
                  <span className="blank-clips__thumb">
                    {clip.thumb ? <img src={clip.thumb} alt="" /> : <i aria-hidden="true" />}
                  </span>
                  <span className="blank-clips__meta">
                    <strong>{clip.title}</strong>
                    <em>{[clock(clip.duration), when(clip.created), size(clip.bytes)].filter(Boolean).join(' · ')}</em>
                  </span>
                  <span className="blank-clips__actions">
                    <button type="button" onClick={() => { if (clip.src) { setPlayError(false); setPlaying(clip) } else clips.open(clip.id) }}>Play</button>
                    <button type="button" onClick={() => clips.reveal(clip.id)}>Open File Location</button>
                    <button type="button" className="is-danger" onClick={() => { if (armed === clip.id) { clips.remove(clip.id); if (playing?.id === clip.id) setPlaying(null); setArmed('') } else setArmed(clip.id) }}>
                      {armed === clip.id ? 'Confirm' : 'Delete'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="blank-clips__empty">Saved clips show up here, newest first.</p>
          )}
        </article>
      </div>

      {status.phase === 'naming' ? createPortal(
        <div className="blank-clips__modal" role="dialog" aria-modal="true" aria-labelledby="blank-clip-name">
          <form onSubmit={onSave}>
            <p>Name this clip</p>
            <h2 id="blank-clip-name">Save to Videos/Clips</h2>
            <input ref={nameRef} value={title} maxLength={64} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => { setTitle(event.target.value); setNameError('') }} placeholder="Triple_Elim_Fortnite" />
            {nameError ? <em>{nameError}</em> : <em>{clock(status.pending?.duration)} · {size(status.pending?.bytes)}</em>}
            <div>
              <button type="button" onClick={() => clips.discard()} disabled={savingName}>Discard</button>
              <button type="submit" disabled={savingName}>{savingName ? 'Saving…' : 'Save clip'}</button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}

      {playing ? createPortal(
        <div className="blank-clips__modal blank-clips__player" role="dialog" aria-modal="true" aria-label={playing.title}>
          <div>
            <header>
              <strong>{playing.title}</strong>
              <button type="button" onClick={() => setPlaying(null)}>Close</button>
            </header>
            {playError ? <p>This clip needs an outside player.</p> : (
              <video ref={playRef} src={playing.src} controls autoPlay onError={() => setPlayError(true)} />
            )}
            {playError ? <button type="button" onClick={() => clips.open(playing.id)}>Open in player</button> : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}
