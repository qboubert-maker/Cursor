import { spawn, execFile } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { app, desktopCapturer, globalShortcut, ipcMain, protocol, screen, session as electronSession, shell } from 'electron'
import { assembleClip, splitContainer } from './optimizer-clip-buffer.js'
import { unwatchKey, watchKey } from './key-watch.js'

const LIMITS = new Set([30, 120, 300, 900, 1800, 3600])
const DEFAULT_HOTKEY = 'Alt+F10'
const SAVE_BYTES_PER_SECOND = 150 * 1024 * 1024
const STALE_BUFFER_MS = 10 * 60 * 1000
const MEDIA_TYPES = { mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', jpg: 'image/jpeg', png: 'image/png' }

let getWindow = () => null
let prefs = { mic: true, desktop: true, maxSeconds: 120, quality: 1080, hotkey: DEFAULT_HOTKEY, padButton: null, monitor: 0, micDevice: '', outputDevice: '' }
let prefsRev = 0
let prefsReady = Promise.resolve()
let hotkey = DEFAULT_HOTKEY
let hotkeyMode = ''
let hotkeyHeld = false
let library = []
let session = null
let planPromise = null
let errorText = ''
let warningText = ''
let hotkeyOk = false
let leaving = false
let clipsRoot = ''
let thumbRoot = ''
let libraryFile = ''
let prefsFile = ''

function publicClip(clip) {
  const playable = clip.ext === 'mp4' || clip.ext === 'webm'
  return {
    id: clip.id,
    title: clip.title,
    ext: clip.ext,
    duration: clip.duration,
    created: clip.created,
    bytes: clip.bytes,
    thumb: clip.thumb ? `blank-clip://thumb/${clip.id}?v=${clip.created}` : '',
    src: playable ? `blank-clip://media/${clip.id}` : '',
  }
}

function publicStatus() {
  const alive = session && session.phase !== 'ready'
  return {
    phase: session?.phase || 'ready',
    engine: session?.engine || planCache?.engine || '',
    encoder: session?.encoder || planCache?.encoder || '',
    capture: session?.capture || planCache?.capture || '',
    rolling: Boolean(session ? session.rolling : planCache?.rolling),
    checking: !planCache,
    mic: prefs.mic,
    desktop: prefs.desktop,
    quality: alive ? session.quality : prefs.quality,
    maxSeconds: alive ? session.maxSeconds : prefs.maxSeconds,
    startedAt: session?.startedAt || 0,
    pending: session?.pending || null,
    error: errorText,
    warning: session?.warning || warningText,
    hotkey: hotkeyOk,
    hotkeyKey: hotkey,
    hotkeyShared: hotkeyMode === 'watch',
    padButton: Number.isInteger(prefs.padButton) ? prefs.padButton : null,
    rev: prefsRev,
    clips: library.map(publicClip),
    fps: session?.fps || 0,
    monitor: prefs.monitor || 0,
    refresh: prefs.monitor || displayRefresh(),
    micDevice: prefs.micDevice || '',
    outputDevice: prefs.outputDevice || '',
  }
}

function readDevice(value) {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  if (!text) return ''
  if (text.length > 256 || /[\u0000-\u001f]/.test(text)) return null
  return text
}

function readMonitor(value) {
  const rate = Math.round(Number(value))
  if (!Number.isFinite(rate) || rate <= 0) return 0
  if (rate < 48 || rate > 540) return null
  return rate
}

function displayRefresh() {
  try { return screen.getPrimaryDisplay().displayFrequency || 60 } catch { return 60 }
}

let planCache = null

let encodingListener = () => {}
let encodingNoted = false

export function watchClipEncoding(listener) {
  encodingListener = listener
  encodingNoted = false
  noteEncoding()
}

function noteEncoding() {
  const active = !!session && (session.phase === 'starting' || session.phase === 'recording' || session.phase === 'saving')
  if (active === encodingNoted) return
  encodingNoted = active
  encodingListener(active)
}

function emit(extra = {}) {
  const win = getWindow()
  const status = publicStatus()
  noteEncoding()
  if (!win || win.isDestroyed()) return status
  win.webContents.send('optimizer-clips-event', { ...extra, status })
  return status
}

function stamp() {
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

function safeTitle(input) {
  const cleaned = String(input || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 64)
  if (!cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) return ''
  return cleaned
}

function inside(root, file) {
  const rel = path.relative(path.resolve(root), path.resolve(file))
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function run(bin, args, timeoutMs) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ code: 1, stdout: '', stderr: error.message })
      return
    }
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-24000) })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-8000) })
    const timer = setTimeout(() => { try { child.kill() } catch { /* already gone */ } }, timeoutMs)
    child.once('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: stderr || error.message })
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

function execOut(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      resolve(error ? '' : String(stdout || ''))
    })
  })
}

async function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(process.resourcesPath || '', 'ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
  ].filter(Boolean)
  const direct = candidates.find((item) => existsSync(item))
  if (direct) return direct
  const listed = await execOut('where.exe', ['ffmpeg'])
  const line = listed.split(/\r?\n/).map((item) => item.trim()).find((item) => item.toLowerCase().endsWith('ffmpeg.exe'))
  return line && existsSync(line) ? line : ''
}

function primaryPixels() {
  const display = screen.getPrimaryDisplay()
  const scale = display.scaleFactor || 1
  return {
    x: Math.round(display.bounds.x * scale),
    y: Math.round(display.bounds.y * scale),
    w: Math.max(2, Math.floor((display.size.width * scale) / 2) * 2),
    h: Math.max(2, Math.floor((display.size.height * scale) / 2) * 2),
  }
}

function primaryOutputIndex() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const index = displays.findIndex((item) => item.id === primary.id)
  return index < 0 ? 0 : index
}

const QUALITY = {
  720: { height: 720 },
  1080: { height: 1080 },
  2160: { height: 2160 },
}

function mbpsFor(height) {
  if (height <= 720) return 8
  if (height <= 1080) return 16
  if (height <= 1440) return 24
  return 45
}

function recordSize() {
  const pixels = primaryPixels()
  const wanted = (QUALITY[prefs.quality] || QUALITY[1080]).height
  const height = Math.max(2, Math.floor(Math.min(wanted, pixels.h) / 2) * 2)
  const width = height === pixels.h ? pixels.w : Math.max(2, Math.round((pixels.w * height) / pixels.h / 2) * 2)
  return { width, height, native: height === pixels.h, mbps: mbpsFor(height) }
}

function encoderArgs(id) {
  const { mbps } = recordSize()
  const max = mbps + 8
  if (id === 'nvenc') {
    return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '18', '-b:v', `${mbps}M`, '-maxrate', `${max}M`, '-bufsize', `${max}M`, '-g', '60', '-bf', '2', '-spatial-aq', '1']
  }
  if (id === 'amf') {
    return ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'vbr_peak', '-b:v', `${mbps}M`, '-maxrate', `${max}M`, '-g', '60']
  }
  return ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', '18', '-b:v', `${mbps}M`, '-maxrate', `${max}M`, '-look_ahead', '1', '-g', '60']
}

function videoInput(captureId, outputIndex, pixels) {
  if (captureId === 'ddagrab') {
    return ['-f', 'lavfi', '-i', `ddagrab=output_idx=${outputIndex}:framerate=60:draw_mouse=1`]
  }
  return [
    '-f', 'gdigrab', '-framerate', '60', '-draw_mouse', '1', '-rtbufsize', '256M',
    '-offset_x', String(pixels.x), '-offset_y', String(pixels.y),
    '-video_size', `${pixels.w}x${pixels.h}`, '-i', 'desktop',
  ]
}

async function probe() {
  if (!planPromise) planPromise = detectPlan().then((plan) => { planCache = plan; emit(); return plan })
  return planPromise
}

async function detectPlan() {
  const bin = await findFfmpeg()
  const media = { engine: 'media', rolling: true, encoder: 'Media Foundation', capture: 'Desktop Duplication', bin: '', captureId: '', encoderId: '', outputIndex: 0 }
  if (!bin) return media
  const listed = await run(bin, ['-hide_banner', '-encoders'], 8000)
  const text = `${listed.stdout}\n${listed.stderr}`
  const encoders = [
    ['nvenc', 'h264_nvenc', 'NVENC'],
    ['amf', 'h264_amf', 'AMD VCE'],
    ['qsv', 'h264_qsv', 'Intel Quick Sync'],
  ].filter((item) => text.includes(item[1]))
  if (!encoders.length) return media
  const outputIndex = primaryOutputIndex()
  const pixels = primaryPixels()
  const captures = [
    ['ddagrab', 'Desktop Duplication'],
    ['gdigrab', 'BitBlt'],
  ]
  for (const [captureId, capture] of captures) {
    for (const [encoderId, , encoder] of encoders) {
      const input = captureId === 'ddagrab'
        ? ['-f', 'lavfi', '-i', `ddagrab=output_idx=${outputIndex}:framerate=30:draw_mouse=0`]
        : ['-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '0', '-offset_x', String(pixels.x), '-offset_y', String(pixels.y), '-video_size', `${pixels.w}x${pixels.h}`, '-i', 'desktop']
      const result = await run(bin, [
        '-hide_banner', '-loglevel', 'error', ...input, '-frames:v', '1', '-an',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
        ...encoderArgs(encoderId), '-f', 'null', '-',
      ], 8000)
      if (result.code === 0) {
        return { engine: 'ffmpeg', rolling: true, encoder, capture, bin, captureId, encoderId, outputIndex }
      }
    }
  }
  return media
}

function lastLine(text) {
  return String(text || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(-1)[0] || ''
}

function buildRecordArgs(current, withAudio) {
  const pixels = primaryPixels()
  const args = ['-hide_banner', '-y', '-loglevel', 'warning', ...videoInput(current.captureId, current.outputIndex, pixels)]
  let audioCount = 0
  if (withAudio && prefs.desktop) {
    args.push('-thread_queue_size', '1024', '-f', 'wasapi', '-loopback', '1', '-i', 'default')
    audioCount += 1
  }
  if (withAudio && prefs.mic) {
    args.push('-thread_queue_size', '1024', '-f', 'wasapi', '-i', 'default')
    audioCount += 1
  }
  const size = recordSize()
  const scale = size.native ? '' : `,scale=${size.width}:${size.height}:flags=bicubic`
  const filters = [`[0:v]fps=60${scale},format=yuv420p[v]`]
  if (audioCount === 2) {
    filters.push('[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1]')
    filters.push('[2:a]aformat=sample_rates=48000:channel_layouts=stereo[a2]')
    filters.push('[a1][a2]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]')
  } else if (audioCount === 1) {
    filters.push('[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a]')
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[v]')
  if (audioCount) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000')
  else args.push('-an')
  args.push(...encoderArgs(current.encoderId))
  const slots = Math.max(1, Math.ceil(current.maxSeconds / 2))
  args.push(
    '-f', 'segment', '-segment_time', '2', '-segment_wrap', String(slots),
    '-segment_format', 'matroska', '-reset_timestamps', '1',
    path.join(current.dir, 'seg%03d.mkv'),
  )
  return args
}

function spawnRecorder(current, withAudio) {
  const proc = spawn(current.bin, buildRecordArgs(current, withAudio), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  session.proc = proc
  session.stderr = ''
  proc.stdout.on('data', () => {})
  proc.stderr.on('data', (chunk) => { session.stderr = ((session?.stderr || '') + chunk.toString()).slice(-4000) })
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      settled = true
      resolve({ alive: true, stderr: session?.stderr || '' })
    }, 900)
    proc.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      session.stderr = error.message
      resolve({ alive: false, stderr: error.message })
    })
    proc.once('exit', () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve({ alive: false, stderr: session?.stderr || '' })
        return
      }
      if (!session || session.proc !== proc || session.stopping) return
      if (session.phase === 'recording') finishRecording('The recorder stopped.').catch(() => {})
    })
  })
}

async function beginFfmpeg(current) {
  session.engine = 'ffmpeg'
  session.rolling = true
  session.encoder = current.encoder
  session.capture = current.capture
  session.captureId = current.captureId
  session.encoderId = current.encoderId
  session.outputIndex = current.outputIndex
  session.bin = current.bin
  session.ext = 'mp4'
  let started = await spawnRecorder(session, true)
  if (!started.alive && (prefs.mic || prefs.desktop)) {
    warningText = 'Desktop or microphone audio did not open. Video is still recording.'
    session.warning = warningText
    started = await spawnRecorder(session, false)
  }
  if (!started.alive) {
    const message = lastLine(started.stderr) || 'Could not start the capture.'
    await cleanupSession()
    errorText = message.slice(0, 180)
    emit()
    return { ok: false, message: errorText, status: publicStatus() }
  }
  session.phase = 'recording'
  session.startedAt = Date.now()
  errorText = ''
  emit()
  return { ok: true, engine: 'ffmpeg', sessionId: session.id, status: publicStatus() }
}

function beginMedia(ext) {
  session.engine = 'media'
  session.rolling = true
  session.encoder = 'Media Foundation'
  session.capture = 'Desktop Duplication'
  session.ext = ext === 'mp4' ? 'mp4' : 'webm'
  session.file = ''
  session.stream = null
  session.liveTimer = setTimeout(() => {
    if (session?.phase === 'starting') finishAbort('Capture did not start.')
  }, 20000)
  emit()
  return { ok: true, engine: 'media', sessionId: session.id, status: publicStatus() }
}

async function makeSession(ext) {
  const id = crypto.randomUUID()
  const dir = path.join(app.getPath('temp'), 'blank-optimizer-clips', id)
  await fs.mkdir(dir, { recursive: true })
  session = {
    id, dir, phase: 'starting', stopping: false, startedAt: 0, pending: null,
    maxSeconds: prefs.maxSeconds, quality: prefs.quality, warning: '', proc: null, stream: null, file: '',
    ext: ext === 'mp4' ? 'mp4' : 'webm', stderr: '',
    partChain: Promise.resolve(), parts: [], partIndex: 0, header: null,
    pins: new Map(), doomed: new Set(),
  }
  errorText = ''
  warningText = ''
}

function endStream(stream) {
  return new Promise((resolve) => {
    if (!stream || stream.destroyed || stream.closed) { resolve(); return }
    stream.once('finish', resolve)
    stream.once('error', resolve)
    stream.end()
  })
}

function stopProc(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode != null || proc.killed) { resolve(); return }
    const timer = setTimeout(() => { try { proc.kill() } catch { /* already gone */ } }, 4000)
    proc.once('exit', () => { clearTimeout(timer); resolve() })
    try { proc.stdin.write('q\n') } catch { try { proc.kill() } catch { /* already gone */ } }
  })
}

async function removeDir(dir) {
  if (!dir) return
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
}

async function cleanupSession() {
  const current = session
  session = null
  noteEncoding()
  if (!current) return
  clearTimeout(current.liveTimer)
  clearTimeout(current.capTimer)
  current.stopping = true
  if (current.proc) await stopProc(current.proc)
  if (current.stream) await endStream(current.stream)
  await removeDir(current.dir)
}

async function finishAbort(message) {
  await cleanupSession()
  errorText = String(message || 'Could not start the capture.').slice(0, 180)
  emit()
}

function estimateDuration() {
  const elapsed = session?.startedAt ? (Date.now() - session.startedAt) / 1000 : 0
  if (session?.rolling) return Math.min(Math.max(elapsed, 0), session.maxSeconds)
  return Math.max(elapsed, 0)
}

async function concatSegments(dir, dest) {
  const names = await fs.readdir(dir)
  const segs = []
  for (const name of names) {
    if (!/^seg\d+\.mkv$/i.test(name)) continue
    const file = path.join(dir, name)
    const info = await fs.stat(file).catch(() => null)
    if (info && info.size > 2048) segs.push({ file, mtime: info.mtimeMs })
  }
  segs.sort((a, b) => a.mtime - b.mtime)
  if (!segs.length) throw new Error('The recording was empty.')
  const bin = session.bin
  if (segs.length === 1) {
    const copied = await run(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-i', segs[0].file, '-c', 'copy', '-movflags', '+faststart', dest], 600000)
    if (copied.code === 0) return { file: dest, ext: 'mp4' }
    const mkv = dest.replace(/\.mp4$/i, '.mkv')
    await fs.copyFile(segs[0].file, mkv)
    return { file: mkv, ext: 'mkv' }
  }
  const list = path.join(dir, 'list.txt')
  const body = segs.map((item) => `file '${item.file.replace(/\\/g, '/').replace(/'/g, `'\\''`)}'`).join('\n')
  await fs.writeFile(list, body)
  const merged = await run(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest], 600000)
  if (merged.code === 0) return { file: dest, ext: 'mp4' }
  const mkv = dest.replace(/\.mp4$/i, '.mkv')
  const fallback = await run(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', mkv], 600000)
  if (fallback.code !== 0) throw new Error(lastLine(fallback.stderr) || 'Could not finish the clip.')
  return { file: mkv, ext: 'mkv' }
}

async function materialize() {
  if (!session) return
  if (session.engine === 'ffmpeg') {
    const proc = session.proc
    session.proc = null
    await stopProc(proc)
    const dest = path.join(session.dir, 'pending.mp4')
    const merged = await concatSegments(session.dir, dest)
    session.file = merged.file
    session.ext = merged.ext
    return
  }
  if (session.partChain) await session.partChain.catch(() => {})
  if (session.replayJob) await session.replayJob
  const dest = path.join(session.dir, `pending.${session.ext || 'webm'}`)
  const built = await assembleClip(dest, session.ext || 'webm', session.header, (session.parts || []).map((part) => part.file), { bytesPerSecond: SAVE_BYTES_PER_SECOND, frameRate: session.fps || 0 })
  session.file = dest
  session.mediaSeconds = built?.duration || 0
}

async function finishRecording(reason) {
  if (!session || session.stopping) return { ok: false, status: publicStatus() }
  if (session.phase !== 'recording' && session.phase !== 'starting') return { ok: session.phase === 'naming', status: publicStatus() }
  session.stopping = true
  session.phase = 'saving'
  clearTimeout(session.capTimer)
  clearTimeout(session.liveTimer)
  emit()
  try {
    await materialize()
    const info = await fs.stat(session.file)
    if (info.size < 1024) throw new Error(reason || 'The recording was empty.')
    session.phase = 'naming'
    session.pending = { duration: session.mediaSeconds || estimateDuration(), bytes: info.size }
    session.stopping = false
    errorText = ''
  } catch (error) {
    const message = error?.message || reason || 'Could not save that recording.'
    await cleanupSession()
    errorText = String(message).slice(0, 180)
  }
  const status = emit()
  return { ok: !errorText, status }
}

async function moveFile(from, to) {
  try {
    await fs.rename(from, to)
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error
    await fs.copyFile(from, to)
    await fs.unlink(from)
  }
}

async function uniquePath(dir, stem, ext) {
  let name = `${stem}.${ext}`
  let n = 2
  while (existsSync(path.join(dir, name)) && n < 100) {
    name = `${stem} (${n}).${ext}`
    n += 1
  }
  return path.join(dir, name)
}

async function readDuration(file, fallback) {
  const bin = planCache?.bin
  if (!bin) return fallback
  const result = await run(bin, ['-hide_banner', '-i', file], 8000)
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(`${result.stdout}\n${result.stderr}`)
  if (!match) return fallback
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback
}

async function writeThumb(id, dataUrl) {
  const match = /^data:image\/jpeg;base64,([a-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || ''))
  if (!match) return ''
  const buf = Buffer.from(match[1], 'base64')
  if (!buf.length || buf.length > 500000) return ''
  await fs.mkdir(thumbRoot, { recursive: true })
  const dest = path.join(thumbRoot, `${id}.jpg`)
  await fs.writeFile(dest, buf)
  return dest
}

async function ffmpegThumb(id, file) {
  const bin = planCache?.bin
  if (!bin) return ''
  await fs.mkdir(thumbRoot, { recursive: true })
  const dest = path.join(thumbRoot, `${id}.jpg`)
  const result = await run(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '0', '-i', file, '-frames:v', '1', '-vf', 'scale=320:-2', dest], 15000)
  return result.code === 0 && existsSync(dest) ? dest : ''
}

async function publish(title, thumbData) {
  const stem = safeTitle(title) || `Clip_${stamp()}`
  const dest = await uniquePath(clipsRoot, stem, session.ext)
  await fs.mkdir(clipsRoot, { recursive: true })
  await moveFile(session.file, dest)
  const info = await fs.stat(dest)
  const id = crypto.randomUUID()
  const duration = await readDuration(dest, session.pending?.duration || estimateDuration())
  const thumb = await writeThumb(id, thumbData) || await ffmpegThumb(id, dest)
  const clip = {
    id,
    title: path.basename(dest, path.extname(dest)),
    file: dest,
    ext: path.extname(dest).slice(1).toLowerCase(),
    duration,
    created: Date.now(),
    bytes: info.size,
    thumb,
  }
  library.unshift(clip)
  library.sort((a, b) => b.created - a.created)
  await saveLibrary()
  const dir = session.dir
  session = null
  await removeDir(dir)
  errorText = ''
  warningText = ''
  return publicClip(clip)
}

async function publishKeep(file, duration, thumbData) {
  const ext = path.extname(file).slice(1).toLowerCase() || 'mp4'
  const dest = await uniquePath(clipsRoot, `Clip_${stamp()}`, ext)
  await fs.mkdir(clipsRoot, { recursive: true })
  await moveFile(file, dest)
  const info = await fs.stat(dest)
  const id = crypto.randomUUID()
  const measured = await readDuration(dest, duration)
  const thumb = await writeThumb(id, thumbData) || await ffmpegThumb(id, dest)
  const clip = {
    id,
    title: path.basename(dest, path.extname(dest)),
    file: dest,
    ext,
    duration: measured,
    created: Date.now(),
    bytes: info.size,
    thumb,
  }
  library.unshift(clip)
  library.sort((a, b) => b.created - a.created)
  await saveLibrary()
  return publicClip(clip)
}

async function storePart(current, buf) {
  if (!current || current.stopping) return
  let body = buf
  if (!current.header) {
    const split = splitContainer(buf, current.ext)
    current.header = Buffer.from(split.header)
    body = Buffer.from(split.body)
  }
  if (!body.length) return
  const file = path.join(current.dir, `p${String(current.partIndex).padStart(5, '0')}.bin`)
  current.partIndex += 1
  await fs.writeFile(file, body)
  current.parts.push({ file, at: Date.now(), bytes: body.length })
  const cutoff = Date.now() - (current.maxSeconds * 1000)
  while (current.parts.length > 1 && current.parts[1].at < cutoff) {
    const old = current.parts.shift()
    if (current.pins.has(old.file)) current.doomed.add(old.file)
    else await fs.rm(old.file, { force: true }).catch(() => {})
  }
}

function pinParts(current, files) {
  for (const file of files) current.pins.set(file, (current.pins.get(file) || 0) + 1)
}

async function unpinParts(current, files) {
  for (const file of files) {
    const left = (current.pins.get(file) || 1) - 1
    if (left > 0) {
      current.pins.set(file, left)
      continue
    }
    current.pins.delete(file)
    if (current.doomed.delete(file)) await fs.rm(file, { force: true }).catch(() => {})
  }
}

function enqueue(current, task) {
  const run = (current.partChain || Promise.resolve()).catch(() => {}).then(task)
  current.partChain = run.then(() => {}, () => {})
  return run
}

async function snapshotFfmpeg() {
  const snap = path.join(session.dir, `snap-${Date.now()}`)
  await fs.mkdir(snap, { recursive: true })
  const names = (await fs.readdir(session.dir)).filter((name) => /^seg\d+\.mkv$/i.test(name))
  for (const name of names) {
    await fs.copyFile(path.join(session.dir, name), path.join(snap, name)).catch(() => {})
  }
  const dest = path.join(snap, 'pending.mp4')
  try {
    return await concatSegments(snap, dest)
  } catch (error) {
    const segs = []
    for (const name of await fs.readdir(snap)) {
      if (!/^seg\d+\.mkv$/i.test(name)) continue
      const file = path.join(snap, name)
      const info = await fs.stat(file).catch(() => null)
      if (info) segs.push({ file, mtime: info.mtimeMs })
    }
    segs.sort((a, b) => a.mtime - b.mtime)
    if (segs.length < 2) {
      await removeDir(snap)
      throw error
    }
    await fs.rm(segs[segs.length - 1].file, { force: true })
    try {
      return await concatSegments(snap, dest)
    } catch (retry) {
      await removeDir(snap)
      throw retry
    }
  }
}

function saveReplay(thumbData) {
  if (!session || session.phase !== 'recording') return Promise.resolve({ ok: false, message: 'Start recording first.', status: publicStatus() })
  const current = session
  const task = keepReplay(current, thumbData)
  current.replaySave = task
  return task
}

async function keepReplay(current, thumbData) {
  let duration = Math.min(estimateDuration(), current.maxSeconds)
  try {
    let file = ''
    let dir = ''
    if (current.engine === 'ffmpeg') {
      const merged = await snapshotFfmpeg()
      file = merged.file
      dir = path.dirname(file)
    } else {
      const dest = path.join(current.dir, `replay-${crypto.randomUUID()}.${current.ext || 'webm'}`)
      await current.partChain
      const files = current.parts.map((part) => part.file)
      pinParts(current, files)
      const job = assembleClip(dest, current.ext || 'webm', current.header, files, { bytesPerSecond: SAVE_BYTES_PER_SECOND, frameRate: current.fps || 0 })
        .finally(() => unpinParts(current, files))
      current.replayJob = job.catch(() => {})
      const built = await job
      if (built?.duration > 0) duration = built.duration
      file = dest
    }
    const clip = await publishKeep(file, duration, thumbData)
    if (dir) await removeDir(dir)
    errorText = ''
    return { ok: true, clip, status: emit({ type: 'replay' }) }
  } catch (error) {
    const message = String(error?.message || 'Could not save that clip.').slice(0, 180)
    return { ok: false, message, status: publicStatus() }
  }
}

async function saveLibrary() {
  const tmp = `${libraryFile}.tmp`
  await fs.writeFile(tmp, JSON.stringify(library))
  await fs.rename(tmp, libraryFile)
}

async function savePrefs() {
  const tmp = `${prefsFile}.tmp`
  await fs.writeFile(tmp, JSON.stringify(prefs))
  await fs.rename(tmp, prefsFile)
}

async function loadState() {
  clipsRoot = path.join(app.getPath('videos'), 'Clips')
  thumbRoot = path.join(app.getPath('userData'), 'clip-thumbs')
  libraryFile = path.join(app.getPath('userData'), 'clips-library.json')
  prefsFile = path.join(app.getPath('userData'), 'clips-settings.json')
  await fs.mkdir(clipsRoot, { recursive: true })
  await fs.mkdir(thumbRoot, { recursive: true })
  try {
    const saved = JSON.parse(await fs.readFile(prefsFile, 'utf8'))
    if (LIMITS.has(Number(saved.maxSeconds))) prefs.maxSeconds = Number(saved.maxSeconds)
    if (saved.mic != null) prefs.mic = Boolean(saved.mic)
    if (saved.desktop != null) prefs.desktop = Boolean(saved.desktop)
    if (QUALITY[Number(saved.quality)]) prefs.quality = Number(saved.quality)
    if (saved.hotkey === '') prefs.hotkey = ''
    else {
      const savedKey = canonicalHotkey(saved.hotkey)
      if (savedKey) prefs.hotkey = savedKey
    }
    const pad = readPad(saved.padButton)
    prefs.padButton = pad
    const monitor = readMonitor(saved.monitor)
    if (monitor != null) prefs.monitor = monitor
    const micDevice = readDevice(saved.micDevice)
    if (micDevice != null) prefs.micDevice = micDevice
    const outputDevice = readDevice(saved.outputDevice)
    if (outputDevice != null) prefs.outputDevice = outputDevice
    if (!prefs.hotkey && prefs.padButton == null) prefs.hotkey = DEFAULT_HOTKEY
  } catch { /* first launch */ }
  prefsRev = 1
  try {
    const saved = JSON.parse(await fs.readFile(libraryFile, 'utf8'))
    library = Array.isArray(saved) ? saved : []
  } catch { library = [] }
  library = library.filter((item) => item?.id && item.file && existsSync(item.file) && inside(clipsRoot, item.file))
  library.sort((a, b) => b.created - a.created)
}

function findClip(id) {
  return library.find((item) => item.id === id)
}

function asBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes
  if (bytes instanceof Uint8Array) return Buffer.from(bytes)
  if (bytes?.type === 'Buffer' && Array.isArray(bytes.data)) return Buffer.from(bytes.data)
  return null
}

async function primarySource(thumbnailSize) {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
  const primary = screen.getPrimaryDisplay()
  return sources.find((item) => item.display_id === String(primary.id)) || sources[0] || null
}

function askStop() {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  emit({ type: 'stop-request' })
}

async function discardSession() {
  const current = session
  if (current?.replaySave) await current.replaySave
  if (session === current) await cleanupSession()
}

async function sweepBuffers() {
  const root = path.join(app.getPath('temp'), 'blank-optimizer-clips')
  const names = await fs.readdir(root).catch(() => [])
  const cutoff = Date.now() - STALE_BUFFER_MS
  for (const name of names) {
    if (!/^[0-9a-f-]{36}$/i.test(name) || name === session?.id) continue
    const dir = path.join(root, name)
    const info = await fs.stat(dir).catch(() => null)
    if (info?.isDirectory() && info.mtimeMs < cutoff) await removeDir(dir)
  }
}

async function rescue() {
  if (!session || session.stopping) return
  const phase = session.phase
  if (phase === 'starting' || phase === 'recording') {
    await discardSession()
    return
  }
  session.stopping = true
  try {
    if (session.stream) await endStream(session.stream)
    if (!session.file) await materialize()
    const info = session.file ? await fs.stat(session.file).catch(() => null) : null
    if (info && info.size > 1024 && (phase === 'saving' || phase === 'naming')) {
      session.pending = session.pending || { duration: session.mediaSeconds || estimateDuration(), bytes: info.size }
      session.stopping = false
      await publish(`Clip_${stamp()}`, '')
      return
    }
  } catch { /* drop a broken rescue */ }
  await cleanupSession()
}

async function serveFile(file, request) {
  const { size } = await fs.stat(file)
  const headers = { 'Content-Type': MEDIA_TYPES[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }
  const body = (options) => (request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(file, options)))
  const range = /^bytes=(\d*)-(\d*)$/.exec((request.headers.get('range') || '').trim())
  if (!range || (!range[1] && !range[2])) {
    headers['Content-Length'] = String(size)
    return new Response(body(), { status: 200, headers })
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    headers['Content-Range'] = `bytes */${size}`
    return new Response(null, { status: 416, headers })
  }
  headers['Content-Length'] = String(end - start + 1)
  headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  return new Response(body({ start, end }), { status: 206, headers })
}

function installProtocol() {
  protocol.handle('blank-clip', async (request) => {
    try {
      const url = new URL(request.url)
      const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad', { status: 400 })
      const clip = findClip(id)
      if (!clip) return new Response('missing', { status: 404 })
      const file = url.hostname === 'thumb' ? clip.thumb : clip.file
      const root = url.hostname === 'thumb' ? thumbRoot : clipsRoot
      if (!file || !existsSync(file) || !inside(root, file)) return new Response('missing', { status: 404 })
      return await serveFile(path.resolve(file), request)
    } catch {
      return new Response('bad', { status: 400 })
    }
  })
}

function canonicalHotkey(value) {
  const parts = String(value || '').trim().split('+').filter(Boolean)
  if (parts.length < 1 || parts.length > 4) return ''
  const modMap = { Control: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Super', Super: 'Super', Command: 'Command', Cmd: 'Command' }
  const mods = []
  let key = ''
  for (const part of parts) {
    if (modMap[part]) {
      if (!mods.includes(modMap[part])) mods.push(modMap[part])
      continue
    }
    if (key) return ''
    let token = part.length === 1 ? part.toUpperCase() : part
    if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(token)) token = token.toUpperCase()
    if (!/^(F([1-9]|1[0-9]|2[0-4])|[A-Z0-9]|Space|Tab|Enter|Esc|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Plus|Minus|Backspace)$/.test(token)) return ''
    key = token
  }
  if (!key || (key === 'Esc' && !mods.length)) return ''
  const order = ['Ctrl', 'Alt', 'Shift', 'Super', 'Command']
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  if (mods.length === 1 && mods[0] === 'Alt' && key === 'F4') return ''
  return [...mods, key].join('+')
}

function readPad(value) {
  if (value == null || value === '') return null
  const pad = Number(value)
  return Number.isInteger(pad) && pad >= 0 && pad <= 15 ? pad : null
}

function onClipKey() {
  if (hotkeyHeld) return
  emit({ type: 'hotkey' })
}

function releaseHotkey() {
  if (hotkeyMode === 'watch') unwatchKey()
  if (hotkeyMode === 'shortcut' && hotkey) {
    try { globalShortcut.unregister(hotkey) } catch { /* not registered */ }
  }
  hotkeyMode = ''
}

function bindHotkey() {
  releaseHotkey()
  if (!prefs.hotkey) {
    hotkey = ''
    hotkeyOk = true
    return true
  }
  hotkey = prefs.hotkey
  if (watchKey(hotkey, onClipKey)) {
    hotkeyMode = 'watch'
    hotkeyOk = true
    return true
  }
  hotkeyOk = globalShortcut.register(hotkey, onClipKey)
  hotkeyMode = hotkeyOk ? 'shortcut' : ''
  return hotkeyOk
}

function installIpc() {
  ipcMain.handle('optimizer-clips-status', async () => {
    await prefsReady
    return publicStatus()
  })
  ipcMain.handle('optimizer-clips-prefs', async (_event, input) => {
    await prefsReady
    const recording = session && (session.phase === 'recording' || session.phase === 'starting' || session.phase === 'saving')
    const touchesCapture = input?.mic != null || input?.desktop != null || input?.quality != null
    if (recording && touchesCapture) return { ok: false, status: publicStatus() }
    let clearHotkey = false
    let nextHotkey = ''
    if (input?.hotkey != null && input.hotkey !== '') {
      nextHotkey = canonicalHotkey(input.hotkey)
      if (!nextHotkey) return { ok: false, message: 'Press one key.', status: publicStatus() }
    } else if (input?.hotkey === '') {
      clearHotkey = true
    }
    if (!recording) {
      if (input?.mic != null) prefs.mic = Boolean(input.mic)
      if (input?.desktop != null) prefs.desktop = Boolean(input.desktop)
      if (QUALITY[Number(input?.quality)]) prefs.quality = Number(input.quality)
    }
    if (input && Object.prototype.hasOwnProperty.call(input, 'monitor')) {
      const monitor = readMonitor(input.monitor)
      if (monitor == null) return { ok: false, message: 'Use a monitor rate from 48 to 540 Hz.', status: publicStatus() }
      prefs.monitor = monitor
    }
    if (input && Object.prototype.hasOwnProperty.call(input, 'micDevice')) {
      const micDevice = readDevice(input.micDevice)
      if (micDevice == null) return { ok: false, message: 'That microphone could not be selected.', status: publicStatus() }
      prefs.micDevice = micDevice
    }
    if (input && Object.prototype.hasOwnProperty.call(input, 'outputDevice')) {
      const outputDevice = readDevice(input.outputDevice)
      if (outputDevice == null) return { ok: false, message: 'That speaker could not be selected.', status: publicStatus() }
      prefs.outputDevice = outputDevice
    }
    const max = Number(input?.maxSeconds)
    if (LIMITS.has(max)) {
      prefs.maxSeconds = max
      if (session && (session.phase === 'recording' || session.phase === 'starting' || session.phase === 'saving')) session.maxSeconds = max
    }
    if (nextHotkey) {
      const previous = prefs.hotkey
      const previousPad = prefs.padButton
      prefs.hotkey = nextHotkey
      prefs.padButton = null
      hotkeyHeld = false
      if (!bindHotkey()) {
        prefs.hotkey = previous
        prefs.padButton = previousPad
        bindHotkey()
        prefsRev += 1
        await savePrefs()
        return { ok: false, message: 'That key is in use elsewhere.', status: emit() }
      }
    } else if (clearHotkey) {
      prefs.hotkey = ''
      hotkeyHeld = false
      bindHotkey()
    }
    if (!nextHotkey && input && Object.prototype.hasOwnProperty.call(input, 'padButton')) {
      prefs.padButton = readPad(input.padButton)
    }
    prefsRev += 1
    await savePrefs()
    return { ok: true, status: emit() }
  })
  ipcMain.handle('optimizer-clips-source', async () => {
    const source = await primarySource({ width: 0, height: 0 })
    return source ? { id: source.id } : null
  })
  ipcMain.handle('optimizer-clips-frame', async () => {
    if (session?.phase === 'recording' || session?.phase === 'starting') return ''
    const pixels = primaryPixels()
    const longest = Math.max(pixels.w, pixels.h)
    const scale = Math.min(1, 1920 / longest)
    const width = Math.max(2, Math.round((pixels.w * scale) / 2) * 2)
    const height = Math.max(2, Math.round((pixels.h * scale) / 2) * 2)
    const source = await primarySource({ width, height })
    if (!source || source.thumbnail.isEmpty()) return ''
    return `data:image/jpeg;base64,${source.thumbnail.toJPEG(92).toString('base64')}`
  })
  ipcMain.handle('optimizer-clips-start', async (_event, input) => {
    if (session) return { ok: false, message: 'A recording is already running.', status: publicStatus() }
    const ext = input?.ext === 'mp4' ? 'mp4' : 'webm'
    await makeSession(ext)
    emit()
    try {
      const current = await probe()
      if (!session) return { ok: false, message: errorText || 'Could not start the capture.', status: publicStatus() }
      if (current.engine === 'ffmpeg') return await beginFfmpeg(current)
      return beginMedia(ext)
    } catch (error) {
      await finishAbort(error?.message || 'Could not start the capture.')
      return { ok: false, message: errorText, status: publicStatus() }
    }
  })
  ipcMain.handle('optimizer-clips-live', (_event, sessionId, warning, fps) => {
    if (!session || session.id !== sessionId || session.phase !== 'starting') return { ok: false, status: publicStatus() }
    clearTimeout(session.liveTimer)
    session.phase = 'recording'
    session.startedAt = Date.now()
    const rate = Math.round(Number(fps) || 0)
    if (rate >= 30 && rate <= 60) session.fps = rate
    session.warning = String(warning || '').slice(0, 180)
    warningText = session.warning
    if (!session.rolling) session.capTimer = setTimeout(askStop, session.maxSeconds * 1000)
    return { ok: true, status: emit() }
  })
  ipcMain.handle('optimizer-clips-chunk', async (_event, payload) => {
    if (!session || session.id !== payload?.sessionId || session.stopping) return { ok: false }
    const buf = asBuffer(payload.bytes)
    if (!buf?.length || buf.length > 80 * 1024 * 1024) return { ok: false }
    const current = session
    try {
      await enqueue(current, () => storePart(current, buf))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
  ipcMain.handle('optimizer-clips-replay', (_event, payload) => saveReplay(payload?.thumb))
  ipcMain.handle('optimizer-clips-finish', () => finishRecording(''))
  ipcMain.handle('optimizer-clips-stop', () => finishRecording(''))
  ipcMain.handle('optimizer-clips-save', async (_event, payload) => {
    if (!session || session.phase !== 'naming') return { ok: false, message: 'There is no clip to name.', status: publicStatus() }
    try {
      const clip = await publish(payload?.title, payload?.thumb)
      const status = emit()
      return { ok: true, clip, status }
    } catch (error) {
      errorText = String(error?.message || 'Could not save the clip.').slice(0, 180)
      return { ok: false, message: errorText, status: emit() }
    }
  })
  ipcMain.handle('optimizer-clips-discard', async () => {
    await discardSession()
    warningText = ''
    return { ok: true, status: emit() }
  })
  ipcMain.handle('optimizer-clips-abort', async (_event, message) => {
    await finishAbort(message)
    return { ok: true, status: publicStatus() }
  })
  ipcMain.handle('optimizer-clips-delete', async (_event, id) => {
    const clip = findClip(id)
    if (!clip) return { ok: false, status: publicStatus() }
    await fs.rm(clip.file, { force: true }).catch(() => {})
    if (clip.thumb) await fs.rm(clip.thumb, { force: true }).catch(() => {})
    library = library.filter((item) => item.id !== id)
    await saveLibrary()
    return { ok: true, status: emit() }
  })
  ipcMain.handle('optimizer-clips-reveal', (_event, id) => {
    const clip = findClip(id)
    if (!clip) return { ok: false }
    shell.showItemInFolder(clip.file)
    return { ok: true }
  })
  ipcMain.handle('optimizer-clips-open', async (_event, id) => {
    const clip = findClip(id)
    if (!clip) return { ok: false }
    const message = await shell.openPath(clip.file)
    return { ok: !message, message }
  })
  ipcMain.handle('optimizer-clips-hotkey-hold', (_event, held) => {
    hotkeyHeld = Boolean(held)
    if (hotkeyHeld) {
      releaseHotkey()
      hotkeyOk = false
    } else {
      bindHotkey()
    }
    return { ok: true, status: emit() }
  })
}

export function startClips(getter) {
  getWindow = getter
  const mediaNames = new Set(['media', 'display-capture', 'mediaKeySystem', 'speaker-selection'])
  electronSession.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(mediaNames.has(permission) || permission === 'fullscreen' || permission === 'pointerLock')
  })
  electronSession.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    if (permission === 'speaker-selection') return true
    return mediaNames.has(permission) || permission === 'fullscreen' || permission === 'pointerLock' || permission === 'clipboard-sanitized-write' || permission === 'notifications'
  })
  electronSession.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const source = await primarySource({ width: 0, height: 0 })
      if (!source) { callback({}); return }
      callback({ video: source, audio: request.audioRequested ? 'loopback' : undefined })
    } catch {
      callback({})
    }
  })
  installProtocol()
  prefsReady = loadState()
  installIpc()
  sweepBuffers().catch(() => {})
  app.on('before-quit', (event) => {
    if (leaving) return
    if (!session) {
      releaseHotkey()
      return
    }
    event.preventDefault()
    leaving = true
    const timer = setTimeout(() => app.quit(), 8000)
    rescue().finally(() => {
      clearTimeout(timer)
      releaseHotkey()
      app.quit()
    })
  })
  prefsReady.then(() => {
    hotkey = prefs.hotkey
    bindHotkey()
    emit()
    return probe()
  }).catch((error) => {
    errorText = String(error?.message || 'Could not prepare the recorder.').slice(0, 180)
    emit()
  })
}

export function shutdownClips() {
  try { session?.proc?.kill() } catch { /* already gone */ }
  try { session?.stream?.destroy() } catch { /* already gone */ }
  releaseHotkey()
}
