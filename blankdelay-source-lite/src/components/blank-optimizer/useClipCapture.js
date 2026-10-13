import { useEffect, useRef, useState } from 'react'

const EMPTY = {
  phase: 'ready',
  engine: '',
  encoder: '',
  capture: '',
  rolling: false,
  checking: true,
  mic: true,
  desktop: true,
  quality: 1080,
  maxSeconds: 120,
  startedAt: 0,
  pending: null,
  error: '',
  warning: '',
  hotkey: true,
  hotkeyKey: 'Alt+F10',
  padButton: null,
  rev: 0,
  clips: [],
  monitor: 0,
  refresh: 0,
  micDevice: '',
  outputDevice: '',
}

const AUDIO_BITRATE = 160_000

function even(value) {
  const n = Math.max(2, Math.round(value))
  return n - (n % 2)
}

export function screenPixels() {
  const ratio = window.devicePixelRatio || 1
  return {
    width: even((window.screen.width || 1920) * ratio),
    height: even((window.screen.height || 1080) * ratio),
  }
}

function bitrateFor(height) {
  if (height <= 720) return 8_000_000
  if (height <= 1080) return 16_000_000
  if (height <= 1440) return 24_000_000
  return 45_000_000
}

export function smoothFps(refresh) {
  const rate = Math.max(30, Math.round(Number(refresh) || 60))
  if (rate % 60 === 0) return 60
  for (let fps = 60; fps >= 30; fps -= 1) {
    if (rate % fps === 0) return fps
  }
  return 30
}

export function clipQualities() {
  const { height } = screenPixels()
  const list = []
  if (height >= 2160) list.push([2160, '4K'])
  else if (height > 1080) list.push([2160, `${height}p`])
  if (height >= 1080) list.push([1080, '1080p'])
  else if (height > 720) list.push([1080, `${height}p`])
  list.push([720, '720p'])
  return list
}

export function effectiveQuality(saved) {
  const values = clipQualities().map(([value]) => value)
  const wanted = Number(saved) || 1080
  if (values.includes(wanted)) return wanted
  return values.find((value) => value <= wanted) || values[values.length - 1]
}

export function clipSpec(saved) {
  const screen = screenPixels()
  const quality = effectiveQuality(saved)
  const height = even(Math.min(quality, screen.height))
  const width = height === screen.height ? screen.width : even((screen.width * height) / screen.height)
  return { quality, width, height, bitrate: bitrateFor(height) }
}

export function clipBytesPerSecond(saved) {
  return (clipSpec(saved).bitrate + AUDIO_BITRATE) / 8
}

function pickMime(height) {
  const high = height > 1080
    ? ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1.640033']
    : ['video/mp4;codecs=avc1.64002A,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.640028']
  const types = [
    ...high,
    'video/mp4;codecs=avc1.4D4028,mp4a.40.2',
    'video/mp4;codecs=avc1.4D401F,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

function captureMessage(error) {
  if (error?.name === 'NotAllowedError') return 'Screen capture was blocked.'
  if (error?.name === 'NotFoundError') return 'No screen was available to record.'
  return error?.message || 'Could not start the capture.'
}

async function openDesktop(wantAudio, size, fps) {
  const api = window.optimizerWindow
  const videoConstraints = {
    frameRate: { min: fps, ideal: fps, max: fps },
    width: { ideal: size.width, max: size.width },
    height: { ideal: size.height, max: size.height },
  }
  let display
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: videoConstraints,
      audio: wantAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
    })
  } catch (error) {
    const source = await api.clipsSource?.()
    if (!source?.id) throw error
    const video = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxFrameRate: fps,
        minFrameRate: fps,
        maxWidth: size.width,
        maxHeight: size.height,
      },
    }
    try {
      display = wantAudio
        ? await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id } },
          video,
        })
        : await navigator.mediaDevices.getUserMedia({ audio: false, video })
    } catch {
      display = await navigator.mediaDevices.getUserMedia({ audio: false, video })
    }
  }
  const track = display.getVideoTracks()[0]
  if (track) {
    track.contentHint = 'motion'
    try {
      await track.applyConstraints({
        width: { ideal: size.width, max: size.width },
        height: { ideal: size.height, max: size.height },
        frameRate: { min: fps, ideal: fps, max: fps },
      })
    } catch { /* use the resolution the screen already granted */ }
  }
  return display
}

function paceDisplay(display, fps) {
  const source = display.getVideoTracks()[0]
  const direct = { track: source, ready: Promise.resolve(), stop() {} }
  if (!source || typeof MediaStreamTrackProcessor !== 'function' || typeof MediaStreamTrackGenerator !== 'function') return direct
  let stopped = false
  let generator = null
  let reader = null
  let writer = null
  let latest = null
  const stop = () => {
    stopped = true
    const frame = latest
    latest = null
    try { frame?.close() } catch { /* already closed */ }
    try { reader?.cancel() } catch { /* already cancelled */ }
    try { writer?.close() } catch { /* already closed */ }
    try { generator?.stop() } catch { /* already stopped */ }
  }
  try {
    reader = new MediaStreamTrackProcessor({ track: source }).readable.getReader()
    generator = new MediaStreamTrackGenerator({ kind: 'video' })
    writer = generator.writable.getWriter()
    generator.contentHint = 'motion'
  } catch {
    stop()
    return direct
  }
  const read = async () => {
    while (!stopped) {
      const { done, value } = await reader.read()
      if (done || stopped) {
        try { value?.close() } catch { /* already closed */ }
        break
      }
      const previous = latest
      latest = value
      if (previous) try { previous.close() } catch { /* already closed */ }
    }
  }
  const stepUs = Math.round(1000000 / fps)
  let stamp = 0
  let writing = false
  const emit = () => {
    if (stopped || writing || !latest) return
    writing = true
    try {
      const frame = new VideoFrame(latest, { timestamp: stamp, duration: stepUs })
      stamp += stepUs
      writer.write(frame).catch(() => {}).finally(() => {
        try { frame.close() } catch { /* already closed */ }
        writing = false
      })
    } catch {
      writing = false
    }
  }
  let workerUrl = ''
  let worker = null
  try {
    workerUrl = URL.createObjectURL(new Blob([`
    let timer = 0
    onmessage = (event) => {
      if (event.data === 'stop') { clearTimeout(timer); return }
      const interval = Number(event.data) || 16.667
      let next = performance.now() + interval
      const tick = () => {
        const now = performance.now()
        postMessage(0)
        next += interval
        if (now - next > interval) next = now + interval
        timer = setTimeout(tick, Math.max(0, next - performance.now()))
      }
      tick()
    }
  `], { type: 'text/javascript' }))
    worker = new Worker(workerUrl)
  } catch {
    stop()
    return direct
  }
  worker.onmessage = () => emit()
  worker.postMessage(1000 / fps)
  const stopClock = stop
  read().catch(() => {})
  return {
    track: generator,
    ready: Promise.resolve(),
    stop() {
      stopClock()
      try { worker.postMessage('stop') } catch { /* worker already gone */ }
      worker.terminate()
      URL.revokeObjectURL(workerUrl)
    },
  }
}

function openRecorder(stream, mime, bitrate) {
  const shared = { videoBitsPerSecond: bitrate, audioBitsPerSecond: AUDIO_BITRATE, videoKeyFrameIntervalDuration: 2000 }
  const attempts = [mime ? { mimeType: mime, ...shared } : null, shared].filter(Boolean)
  for (const options of attempts) {
    try { return new MediaRecorder(stream, options) } catch { /* try the next profile */ }
  }
  return new MediaRecorder(stream)
}

function stopTracks(stream) {
  stream?.getTracks?.().forEach((track) => track.stop())
}

function micConstraints(deviceId) {
  const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  if (deviceId && deviceId !== 'default' && deviceId !== 'communications') audio.deviceId = { exact: deviceId }
  return audio
}

async function openMic(deviceId) {
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: micConstraints(deviceId), video: false }), fellBack: false }
  } catch (error) {
    if (!deviceId) throw error
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: micConstraints(''), video: false }), fellBack: true }
  }
}

function connectMic(ctx, gain, stream) {
  const source = ctx.createMediaStreamSource(stream)
  source.connect(gain)
  return source
}

async function grabThumb(track) {
  if (!track || track.readyState !== 'live' || typeof ImageCapture !== 'function') return ''
  try {
    const bitmap = await Promise.race([
      new ImageCapture(track).grabFrame(),
      new Promise((resolve) => { window.setTimeout(() => resolve(null), 400) }),
    ])
    if (!bitmap) return ''
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, 320, 180)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  }
}

function keptLabel(seconds) {
  const value = Math.max(1, Math.round(Number(seconds) || 0))
  if (value >= 3600) return '1h'
  if (value >= 60) {
    const minutes = Math.round(value / 60)
    return `${minutes}m`
  }
  return `${value}s`
}

export function useClipCapture({ enabled, onShow }) {
  const [status, setStatus] = useState(EMPTY)
  const [stream, setStream] = useState(null)
  const [busy, setBusy] = useState(false)
  const enabledRef = useRef(enabled)
  const onShowRef = useRef(onShow)
  const statusRef = useRef(status)
  const revRef = useRef(0)
  const stopRef = useRef(() => {})
  const mediaRef = useRef(null)
  const thumbRef = useRef('')
  const runLock = useRef(false)
  const replayRef = useRef(() => {})
  const noticeTimer = useRef(0)
  const [notice, setNoticeState] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [padArm, setPadArm] = useState(false)
  const [padId, setPadId] = useState('')
  const [clipBound, setClipBound] = useState(0)
  const [audioDevices, setAudioDevices] = useState({ inputs: [], outputs: [] })
  const micSwap = useRef(0)
  const refreshAudioRef = useRef(async () => {})
  const padArmRef = useRef(false)
  const padIdRef = useRef('')
  const updatePrefsRef = useRef(async () => {})
  enabledRef.current = enabled
  onShowRef.current = onShow
  statusRef.current = status
  padArmRef.current = padArm

  const apply = (next) => {
    if (!next) return
    if (next.rev != null && next.rev < revRef.current) return
    if (next.rev != null) revRef.current = next.rev
    statusRef.current = next
    setStatus(next)
  }

  const releaseMedia = () => {
    const media = mediaRef.current
    mediaRef.current = null
    media?.stopPace?.()
    stopTracks(media?.display)
    stopTracks(media?.micStream)
    stopTracks(media?.mixed)
    media?.ctx?.close?.().catch(() => {})
    setStream(null)
  }

  const beginMedia = async (sessionId, mime, spec) => {
    const api = window.optimizerWindow
    const wantDesktop = statusRef.current.desktop
    const wantMic = statusRef.current.mic
    const fps = smoothFps(statusRef.current.refresh)
    const display = await openDesktop(wantDesktop, spec, fps)
    const paced = paceDisplay(display, fps)
    await paced.ready
    let micStream = null
    let micMissing = false
    let micFellBack = false
    if (wantMic) {
      try {
        const opened = await openMic(statusRef.current.micDevice)
        micStream = opened.stream
        micFellBack = opened.fellBack
      } catch {
        micMissing = true
      }
    }
    const desktopAudio = display.getAudioTracks()
    const notes = []
    if (wantMic && micMissing) notes.push('Microphone is unavailable.')
    else if (micFellBack) notes.push('That microphone did not open. Using the default.')
    if (wantDesktop && !desktopAudio.length) notes.push('Desktop audio is unavailable.')
    let ctx = null
    let micGain = null
    let micSource = null
    let mixed = display
    const audioTracks = [...desktopAudio, ...(micStream ? micStream.getAudioTracks() : [])]
    if (audioTracks.length || wantMic) {
      ctx = new AudioContext({ sampleRate: 48000 })
      if (ctx.state === 'suspended') await ctx.resume()
      const dest = ctx.createMediaStreamDestination()
      const target = desktopAudio.length && micStream ? ctx.createDynamicsCompressor() : dest
      if (target !== dest) {
        target.threshold.value = -14
        target.knee.value = 16
        target.ratio.value = 3
        target.attack.value = 0.004
        target.release.value = 0.22
        target.connect(dest)
      }
      desktopAudio.forEach((track) => ctx.createMediaStreamSource(new MediaStream([track])).connect(target))
      micGain = ctx.createGain()
      micGain.gain.value = 1.6
      micGain.connect(target)
      if (micStream) micSource = connectMic(ctx, micGain, micStream)
      mixed = new MediaStream([paced.track, ...dest.stream.getAudioTracks()])
    } else {
      mixed = new MediaStream([paced.track])
    }
    const recorder = openRecorder(mixed, mime, spec.bitrate)
    const media = { id: sessionId, display, micStream, micGain, micSource, ctx, mixed, recorder, chain: Promise.resolve(), live: false, resolveDone: () => {}, stopPace: paced.stop }
    media.done = new Promise((resolve) => { media.resolveDone = resolve })
    mediaRef.current = media
    recorder.ondataavailable = (event) => {
      if (!event.data?.size) return
      const task = event.data.arrayBuffer().then((buf) => api.clipsChunk(sessionId, new Uint8Array(buf)))
      media.chain = media.chain.then(() => task)
    }
    recorder.onstop = () => {
      stopTracks(display)
      stopTracks(micStream)
      const finish = media.live && !media.leaving ? media.chain.then(() => api.clipsFinish(sessionId)) : Promise.resolve()
      finish.finally(() => {
        releaseMedia()
        media.resolveDone()
      })
    }
    recorder.start(1000)
    setStream(display)
    await api.clipsLive(sessionId, notes.join(' '), fps)
    media.live = true
  }

  const start = async () => {
    const api = window.optimizerWindow
    if (!api?.clipsStart || runLock.current || !enabledRef.current) return
    if (statusRef.current.phase !== 'ready') return
    runLock.current = true
    setBusy(true)
    const spec = clipSpec(statusRef.current.quality)
    const mime = pickMime(spec.height)
    const ext = mime.includes('mp4') ? 'mp4' : 'webm'
    try {
      const begun = await api.clipsStart({
        mic: statusRef.current.mic,
        desktop: statusRef.current.desktop,
        maxSeconds: statusRef.current.maxSeconds,
        ext,
      })
      if (begun?.status) apply(begun.status)
      if (!begun?.ok) return
      if (begun.engine === 'media') await beginMedia(begun.sessionId, mime, spec)
    } catch (error) {
      const media = mediaRef.current
      if (media?.recorder && media.recorder.state !== 'inactive') media.recorder.stop()
      else releaseMedia()
      const failed = await api.clipsAbort?.(captureMessage(error))
      if (failed?.status) apply(failed.status)
    } finally {
      runLock.current = false
      setBusy(false)
    }
  }

  const stop = async () => {
    if (runLock.current) return
    const api = window.optimizerWindow
    const phase = statusRef.current.phase
    if (phase !== 'recording' && phase !== 'starting') return
    runLock.current = true
    setBusy(true)
    try {
      const media = mediaRef.current
      if (media?.recorder && media.recorder.state !== 'inactive') {
        thumbRef.current = await grabThumb(media.display?.getVideoTracks?.()[0]) || thumbRef.current
        media.recorder.stop()
        await media.done
      } else {
        const result = await api.clipsStop?.()
        if (result?.status) apply(result.status)
      }
    } finally {
      runLock.current = false
      setBusy(false)
    }
  }

  const setNotice = (text, error = false) => {
    setNoticeState(text)
    setNoticeError(error)
    window.clearTimeout(noticeTimer.current)
    if (text) noticeTimer.current = window.setTimeout(() => setNoticeState(''), 4200)
  }

  const replay = async () => {
    if (runLock.current || statusRef.current.phase !== 'recording') return
    const api = window.optimizerWindow
    runLock.current = true
    try {
      const media = mediaRef.current
      if (media?.recorder?.state === 'recording') {
        thumbRef.current = await grabThumb(media.display?.getVideoTracks?.()[0]) || thumbRef.current
        await new Promise((resolve) => {
          const timer = window.setTimeout(resolve, 1200)
          media.recorder.addEventListener('dataavailable', () => {
            window.clearTimeout(timer)
            resolve()
          }, { once: true })
          try { media.recorder.requestData() } catch { window.clearTimeout(timer); resolve() }
        })
        await media.chain
      }
      const result = await api?.clipsReplay?.({ thumb: thumbRef.current })
      if (result?.status) apply(result.status)
      const kept = result?.clip?.duration ? keptLabel(result.clip.duration) : ''
      setNotice(result?.ok ? `Saved the last ${kept || 'clip'}.` : (result?.message || 'Could not save that clip.'), !result?.ok)
    } finally {
      runLock.current = false
    }
  }

  stopRef.current = stop
  replayRef.current = replay

  useEffect(() => {
    const api = window.optimizerWindow
    if (!api?.clipsStatus) {
      apply({ ...EMPTY, checking: false, error: 'Open The Blank Optimizer desktop app to record.' })
      return undefined
    }
    let cancel = false
    api.clipsStatus().then((next) => {
      if (!cancel && next?.phase) apply(next)
    }).catch(() => {})
    const off = api.onClipsEvent?.((event) => {
      if (event?.status) apply(event.status)
      if (!enabledRef.current) return
      if (event?.type === 'hotkey') {
        if (document.hasFocus() && document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) return
        if (statusRef.current.phase === 'recording') replayRef.current()
        else if (statusRef.current.phase === 'starting') setNotice('Replay is still starting. Press the clip key again in a moment.', true)
        else setNotice('Replay is off, so the past is not kept yet. Start it, then the clip key saves that time.', true)
      } else if (event?.type === 'stop-request') {
        onShowRef.current?.()
        stopRef.current()
      }
    })
    const onLeave = () => {
      const media = mediaRef.current
      if (!media?.recorder || media.recorder.state !== 'recording') return
      media.leaving = true
      window.optimizerWindow?.clipsDiscard?.()
      media.recorder.stop()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      cancel = true
      off?.()
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [])

  const padWanted = enabled && (padArm || (Number.isInteger(status.padButton) && !status.hotkeyKey))

  useEffect(() => {
    if (!padWanted) return undefined
    const held = new Array(16).fill(false)
    let primed = false
    const id = window.setInterval(() => {
      const pads = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()] : []
      const pad = pads.find((item) => item && item.connected)
      const listening = padArmRef.current
      if (!pad) return
      if (pad.id && pad.id !== padIdRef.current) {
        padIdRef.current = pad.id
        setPadId(pad.id)
      }
      const pressed = pad.buttons.map((button, index) => {
        if (!button) return false
        if (index === 6 || index === 7) return button.value > 0.75
        return Boolean(button.pressed)
      })
      if (!primed) {
        primed = true
        const down = pressed.findIndex(Boolean)
        pressed.forEach((on, index) => { held[index] = on })
        if (listening && down >= 0) {
          padArmRef.current = false
          setPadArm(false)
          setClipBound((value) => value + 1)
          updatePrefsRef.current({ padButton: down, hotkey: '' })
        }
        return
      }
      const fresh = pressed.findIndex((on, index) => on && !held[index])
      pressed.forEach((on, index) => { held[index] = on })
      if (fresh < 0) return
      if (listening) {
        padArmRef.current = false
        setPadArm(false)
        setClipBound((value) => value + 1)
        updatePrefsRef.current({ padButton: fresh, hotkey: '' })
        return
      }
      if (fresh !== statusRef.current.padButton || statusRef.current.hotkeyKey) return
      if (!enabledRef.current) return
      if (statusRef.current.phase === 'recording') replayRef.current()
      else if (statusRef.current.phase === 'starting') setNotice('Replay is still starting. Press the clip key again in a moment.', true)
      else setNotice('Replay is off, so the past is not kept yet. Start it, then the clip key saves that time.', true)
    }, 50)
    return () => window.clearInterval(id)
  }, [padWanted])

  const retargetMic = async (deviceId) => {
    const media = mediaRef.current
    if (!media?.ctx || media.ctx.state === 'closed' || !media.micGain || !statusRef.current.mic) return
    const token = micSwap.current + 1
    micSwap.current = token
    try {
      const opened = await openMic(deviceId)
      if (token !== micSwap.current || mediaRef.current !== media || media.ctx.state === 'closed') {
        stopTracks(opened.stream)
        return
      }
      const source = connectMic(media.ctx, media.micGain, opened.stream)
      media.micSource?.disconnect()
      stopTracks(media.micStream)
      media.micSource = source
      media.micStream = opened.stream
      if (opened.fellBack) setNotice('That microphone did not open. Using the default.', true)
    } catch {
      setNotice('That microphone did not open.', true)
    }
  }

  const refreshAudio = async (probe) => {
    const devices = navigator.mediaDevices
    if (!devices?.enumerateDevices) return
    const collect = async () => {
      const list = await devices.enumerateDevices()
      const take = (kind) => list.filter((item) => item.kind === kind && item.deviceId && item.deviceId !== 'default' && item.deviceId !== 'communications')
      return {
        inputs: take('audioinput').map((item) => ({ id: item.deviceId, label: item.label || '' })),
        outputs: take('audiooutput').map((item) => ({ id: item.deviceId, label: item.label || '' })),
      }
    }
    try {
      let next = await collect()
      const unlabeled = [...next.inputs, ...next.outputs].some((item) => !item.label)
      const busyCapture = statusRef.current.phase === 'recording' || statusRef.current.phase === 'starting' || statusRef.current.phase === 'saving'
      if (probe && unlabeled && !busyCapture) {
        const probeStream = await devices.getUserMedia({ audio: true, video: false }).catch(() => null)
        probeStream?.getTracks()?.forEach((track) => track.stop())
        next = await collect()
      }
      setAudioDevices(next)
    } catch { /* keep the last device list */ }
  }
  refreshAudioRef.current = refreshAudio

  const updatePrefs = async (patch) => {
    const api = window.optimizerWindow
    const local = { ...patch }
    if (local.hotkey != null) {
      local.hotkeyKey = local.hotkey
      delete local.hotkey
    }
    if (local.padButton === -1) local.padButton = null
    const localRev = (revRef.current || 0) + 1
    revRef.current = localRev
    apply({ ...statusRef.current, ...local, rev: localRev })
    const result = await api?.clipsPrefs?.(patch)
    if (result && result.ok === false && result.status) {
      revRef.current = result.status.rev || 0
      statusRef.current = result.status
      setStatus(result.status)
    } else if (result?.status) apply(result.status)
    if (patch?.hotkey != null && result && !result.ok) setNotice(result.message || 'That key is in use elsewhere.', true)
    return result
  }
  updatePrefsRef.current = updatePrefs

  useEffect(() => {
    refreshAudioRef.current(false)
    const onChange = () => refreshAudioRef.current(false)
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange)
  }, [])

  return {
    status,
    spec: clipSpec(status.quality),
    stream,
    busy,
    notice,
    noticeError,
    start,
    stop,
    replay,
    save: (title) => window.optimizerWindow?.clipsSave?.({ title, thumb: thumbRef.current }),
    discard: async () => {
      const result = await window.optimizerWindow?.clipsDiscard?.()
      if (result?.status) apply(result.status)
      return result
    },
    reveal: (id) => window.optimizerWindow?.clipsReveal?.(id),
    remove: async (id) => {
      const result = await window.optimizerWindow?.clipsDelete?.(id)
      if (result?.status) apply(result.status)
      return result
    },
    open: (id) => window.optimizerWindow?.clipsOpen?.(id),
    frame: () => window.optimizerWindow?.clipsFrame?.() || Promise.resolve(''),
    setMic: (mic) => updatePrefs({ mic }),
    setDesktop: (desktop) => updatePrefs({ desktop }),
    setMicDevice: async (micDevice) => {
      const result = await updatePrefs({ micDevice })
      if (result?.ok !== false) await retargetMic(micDevice)
      return result
    },
    setOutputDevice: (outputDevice) => updatePrefs({ outputDevice }),
    audioInputs: audioDevices.inputs,
    audioOutputs: audioDevices.outputs,
    refreshAudio: () => refreshAudioRef.current(true),
    setMax: (maxSeconds) => updatePrefs({ maxSeconds }),
    setQuality: (quality) => updatePrefs({ quality }),
    setMonitor: (monitor) => updatePrefs({ monitor }),
    setHotkey: (hotkey) => updatePrefs({ hotkey, padButton: -1 }),
    holdHotkey: (held) => window.optimizerWindow?.clipsHotkeyHold?.(Boolean(held)),
    padArm,
    padId,
    clipBound,
    setPadArm,
  }
}
