import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'

const CLUSTER = Buffer.from([0x1f, 0x43, 0xb6, 0x75])

function readVint(buf, offset) {
  if (offset >= buf.length) return null
  const lead = buf[offset]
  if (!lead) return null
  let width = 1
  let mask = 0x80
  while (width < 8 && (lead & mask) === 0) {
    mask >>= 1
    width += 1
  }
  if ((lead & mask) === 0 || offset + width > buf.length) return null
  let value = BigInt(lead & (mask - 1))
  for (let i = 1; i < width; i += 1) value = (value << 8n) + BigInt(buf[offset + i])
  return { value, width }
}

function readBox(buf, offset, end) {
  if (offset + 8 > end) return null
  let size = buf.readUInt32BE(offset)
  const type = buf.toString('latin1', offset + 4, offset + 8)
  let header = 8
  if (size === 1) {
    if (offset + 16 > end) return null
    const big = buf.readBigUInt64BE(offset + 8)
    if (big > BigInt(end - offset) || big < 16n) return null
    size = Number(big)
    header = 16
  } else if (size === 0) {
    size = end - offset
  }
  if (size < header || offset + size > end) return null
  return { offset, size, header, type, end: offset + size }
}

function walkBoxes(buf, start, end, visit) {
  let offset = start
  while (offset + 8 <= end) {
    const box = readBox(buf, offset, end)
    if (!box) break
    visit(box)
    offset = box.end
  }
}

export function splitContainer(buf, ext) {
  if (ext === 'mp4') {
    let offset = 0
    while (offset + 8 <= buf.length) {
      const box = readBox(buf, offset, buf.length)
      if (!box) break
      if (box.type === 'moof' || box.type === 'mdat') {
        return { header: buf.subarray(0, offset), body: buf.subarray(offset) }
      }
      offset = box.end
    }
    return { header: buf.subarray(0, offset), body: buf.subarray(offset) }
  }
  const at = buf.indexOf(CLUSTER)
  if (at > 0) return { header: buf.subarray(0, at), body: buf.subarray(at) }
  if (at === 0) return { header: Buffer.alloc(0), body: buf }
  return { header: buf, body: Buffer.alloc(0) }
}

function readTfdt(buf, leaf) {
  const version = buf[leaf.offset + leaf.header]
  const timeAt = leaf.offset + leaf.header + 4
  if (version === 1) {
    if (timeAt + 8 > leaf.end) return null
    return { timeAt, width: 8, time: buf.readBigUInt64BE(timeAt) }
  }
  if (timeAt + 4 > leaf.end) return null
  return { timeAt, width: 4, time: BigInt(buf.readUInt32BE(timeAt)) }
}

function writeTfdt(buf, found, time) {
  if (found.width === 8) buf.writeBigUInt64BE(time, found.timeAt)
  else buf.writeUInt32BE(Number(time), found.timeAt)
}

function boxField(buf, box, v0, v1) {
  const at = box.offset + box.header + (buf[box.offset + box.header] === 1 ? v1 : v0)
  return at + 4 <= box.end ? buf.readUInt32BE(at) : 0
}

function readTracks(header) {
  const tracks = new Map()
  const track = (id) => {
    if (!tracks.has(id)) tracks.set(id, { scale: 0, kind: '', duration: 0 })
    return tracks.get(id)
  }
  walkBoxes(header, 0, header.length, (moov) => {
    if (moov.type !== 'moov') return
    walkBoxes(header, moov.offset + moov.header, moov.end, (box) => {
      if (box.type === 'mvex') {
        walkBoxes(header, box.offset + box.header, box.end, (trex) => {
          const body = trex.offset + trex.header
          if (trex.type !== 'trex' || body + 16 > trex.end) return
          track(header.readUInt32BE(body + 4)).duration = header.readUInt32BE(body + 12)
        })
      }
      if (box.type !== 'trak') return
      let id = 0
      let scale = 0
      let kind = ''
      walkBoxes(header, box.offset + box.header, box.end, (child) => {
        if (child.type === 'tkhd') id = boxField(header, child, 12, 20)
        if (child.type !== 'mdia') return
        walkBoxes(header, child.offset + child.header, child.end, (leaf) => {
          const body = leaf.offset + leaf.header
          if (leaf.type === 'mdhd') scale = boxField(header, leaf, 12, 20)
          if (leaf.type === 'hdlr' && body + 12 <= leaf.end) kind = header.toString('latin1', body + 8, body + 12)
        })
      })
      if (id && scale) Object.assign(track(id), { scale, kind })
    })
  })
  return tracks
}

function sampleStride(flags) {
  return 4 * [0x100, 0x200, 0x400, 0x800].filter((bit) => flags & bit).length
}

function durationAt(flags) {
  return 8 + ((flags & 0x1) ? 4 : 0) + ((flags & 0x4) ? 4 : 0)
}

function runTicks(buf, run, fallback) {
  const body = run.offset + run.header
  if (body + 8 > run.end) return 0
  const flags = buf.readUInt32BE(body) & 0xffffff
  const count = buf.readUInt32BE(body + 4)
  if (!(flags & 0x100)) return count * fallback
  const stride = sampleStride(flags)
  let at = body + durationAt(flags)
  let ticks = 0
  for (let i = 0; i < count && at + 4 <= run.end; i += 1, at += stride) ticks += buf.readUInt32BE(at)
  return ticks
}

function videoSlots(buf, runs) {
  const slots = []
  let sum = 0
  for (const run of runs) {
    const body = run.offset + run.header
    if (body + 8 > run.end) continue
    const flags = buf.readUInt32BE(body) & 0xffffff
    const count = buf.readUInt32BE(body + 4)
    if (!(flags & 0x100) || count < 1) continue
    const stride = sampleStride(flags)
    let at = body + durationAt(flags)
    for (let i = 0; i < count && at + 4 <= run.end; i += 1, at += stride) {
      slots.push(at)
      sum += buf.readUInt32BE(at)
    }
  }
  return { slots, sum }
}

function fillSlots(buf, slots, total) {
  if (!slots.length || total < slots.length) return
  const base = Math.floor(total / slots.length)
  let extra = total - base * slots.length
  for (const at of slots) {
    const add = extra > 0 ? 1 : 0
    if (extra > 0) extra -= 1
    buf.writeUInt32BE(Math.max(1, base + add), at)
  }
}

function queueVideoPace(state, buf, runs, origin) {
  const found = videoSlots(buf, runs)
  if (found.slots.length < 2) return
  const pending = state.pending
  if (pending?.slots?.length) {
    const span = Number(origin - pending.origin)
    const limit = pending.slots.length * (state.frameTicks || 1000) * 4
    const total = span > pending.slots.length && span < limit ? span : pending.sum
    fillSlots(pending.buf, pending.slots, total)
  }
  state.pending = { buf, slots: found.slots, sum: found.sum, origin }
}

function flushVideoPace(state) {
  const pending = state.pending
  if (!pending?.slots?.length) return
  const guessed = pending.slots.length * (state.frameTicks || 1000)
  const total = pending.sum >= guessed * 0.5 ? pending.sum : guessed
  fillSlots(pending.buf, pending.slots, total)
  state.pending = null
}

function videoTrackId(header) {
  if (!header?.length) return 0
  for (const [id, info] of readTracks(header)) {
    if (info.kind === 'vide') return id
  }
  return 0
}

function readMoof(buf, moof, tracks) {
  const times = new Map()
  walkBoxes(buf, moof.offset + moof.header, moof.end, (traf) => {
    if (traf.type !== 'traf') return
    let id = 0
    let fallback = 0
    let time = null
    let ticks = 0
    walkBoxes(buf, traf.offset + traf.header, traf.end, (leaf) => {
      if (leaf.type === 'tfhd') {
        const body = leaf.offset + leaf.header
        if (body + 8 > leaf.end) return
        const flags = buf.readUInt32BE(body) & 0xffffff
        id = buf.readUInt32BE(body + 4)
        fallback = tracks.get(id)?.duration || 0
        const at = body + 8 + ((flags & 0x1) ? 8 : 0) + ((flags & 0x2) ? 4 : 0)
        if ((flags & 0x8) && at + 4 <= leaf.end) fallback = buf.readUInt32BE(at)
      } else if (leaf.type === 'tfdt') {
        time = readTfdt(buf, leaf)?.time ?? null
      } else if (leaf.type === 'trun') {
        ticks += runTicks(buf, leaf, fallback)
      }
    })
    if (id && time != null && !times.has(id)) times.set(id, { time, ticks })
  })
  return times
}

async function scanFragments(files, tracks) {
  const frags = []
  const head = Buffer.alloc(16)
  let total = 0
  for (const file of files) {
    const handle = await fs.open(file, 'r')
    try {
      const { size } = await handle.stat()
      let offset = 0
      while (offset + 8 <= size) {
        const { bytesRead } = await handle.read(head, 0, 16, offset)
        if (bytesRead < 8) break
        let length = head.readUInt32BE(0)
        const type = head.toString('latin1', 4, 8)
        if (length === 1) length = bytesRead >= 16 ? Number(head.readBigUInt64BE(8)) : 0
        else if (length === 0) length = size - offset
        if (length < 8 || offset + length > size) break
        if (type === 'moof') {
          const buf = Buffer.alloc(length)
          await handle.read(buf, 0, length, offset)
          const moof = readBox(buf, 0, length)
          if (moof) frags.push({ at: total + offset, times: readMoof(buf, moof, tracks) })
        }
        offset += length
      }
      total += size
    } finally {
      await handle.close()
    }
  }
  return { frags, total }
}

async function planIndex(header, files) {
  const tracks = readTracks(header)
  const { frags, total } = await scanFragments(files, tracks)
  if (!frags.length || frags.length > 0xffff) return null
  const first = new Map()
  for (const frag of frags) {
    for (const [id, info] of frag.times) {
      if (!first.has(id) && tracks.get(id)?.scale) first.set(id, info.time)
    }
  }
  if (!first.size) return null
  const scaleOf = (id) => BigInt(tracks.get(id).scale)
  let lead = null
  for (const [id, time] of first) {
    if (lead == null || time * scaleOf(lead) < first.get(lead) * scaleOf(id)) lead = id
  }
  const base = new Map()
  for (const id of first.keys()) base.set(id, (first.get(lead) * scaleOf(id)) / scaleOf(lead))
  const ids = [...first.keys()]
  const ref = ids.find((id) => tracks.get(id).kind === 'vide') ?? ids[0]
  const items = []
  for (const frag of frags) {
    const info = frag.times.get(ref)
    const prev = items[items.length - 1]
    let start = info ? info.time - base.get(ref) : (prev ? prev.start + BigInt(prev.ticks) : 0n)
    if (start < 0n) start = 0n
    if (prev && start < prev.start) start = prev.start
    items.push({ at: frag.at, start, ticks: info?.ticks || 0 })
  }
  const box = Buffer.alloc(40 + items.length * 12)
  box.writeUInt32BE(box.length, 0)
  box.write('sidx', 4, 'latin1')
  box.writeUInt32BE(0x01000000, 8)
  box.writeUInt32BE(ref, 12)
  box.writeUInt32BE(tracks.get(ref).scale, 16)
  box.writeBigUInt64BE(items[0].start, 20)
  box.writeBigUInt64BE(BigInt(items[0].at), 28)
  box.writeUInt16BE(items.length, 38)
  for (let i = 0; i < items.length; i += 1) {
    const next = items[i + 1]
    const size = (next ? next.at : total) - items[i].at
    const span = next ? next.start - items[i].start : BigInt(items[i].ticks)
    if (size <= 0 || size > 0x7fffffff || span > 0xffffffffn) return null
    box.writeUInt32BE(size, 40 + i * 12)
    box.writeUInt32BE(Number(span), 44 + i * 12)
    box.writeUInt32BE(0x90000000, 48 + i * 12)
  }
  const last = items[items.length - 1]
  return { base, box, duration: Number(last.start + BigInt(last.ticks)) / tracks.get(ref).scale }
}

export function retimeClip(buf, ext, state) {
  if (ext === 'mp4') {
    const moofs = []
    walkBoxes(buf, 0, buf.length, (box) => { if (box.type === 'moof') moofs.push(box) })
    moofs.forEach((moof) => {
      const seq = state.sequence
      state.sequence += 1
      walkBoxes(buf, moof.offset + moof.header, moof.end, (child) => {
        if (child.type === 'mfhd') {
          const at = child.offset + child.header + 4
          if (at + 4 <= child.end) buf.writeUInt32BE(seq, at)
        }
        if (child.type !== 'traf') return
        let trackId = 0
        let time = null
        walkBoxes(buf, child.offset + child.header, child.end, (leaf) => {
          if (leaf.type === 'tfhd') {
            const at = leaf.offset + leaf.header + 4
            if (at + 4 <= leaf.end) trackId = buf.readUInt32BE(at)
          } else if (leaf.type === 'tfdt') {
            time = readTfdt(buf, leaf)
          }
        })
        if (!trackId || !time) return
        if (!state.base.has(trackId)) state.base.set(trackId, time.time)
        let next = time.time - state.base.get(trackId)
        if (next < 0n) next = 0n
        writeTfdt(buf, time, next)
        if (trackId === state.videoId) {
          const runs = []
          walkBoxes(buf, child.offset + child.header, child.end, (leaf) => {
            if (leaf.type === 'trun') runs.push(leaf)
          })
          queueVideoPace(state, buf, runs, time.time)
        }
      })
    })
    return buf
  }
  let offset = 0
  while (offset + 4 <= buf.length) {
    if (!buf.subarray(offset, offset + 4).equals(CLUSTER)) {
      const found = buf.indexOf(CLUSTER, offset + 1)
      if (found < 0) break
      offset = found
      continue
    }
    const size = readVint(buf, offset + 4)
    if (!size || size.value <= 0n) break
    const dataStart = offset + 4 + size.width
    const dataEnd = dataStart + Number(size.value)
    if (dataEnd <= dataStart || dataEnd > buf.length) break
    if (buf[dataStart] === 0xe7) {
      const len = readVint(buf, dataStart + 1)
      const width = len ? Number(len.value) : 0
      const valueAt = len ? dataStart + 1 + len.width : 0
      if (len && width >= 1 && width <= 8 && valueAt + width <= buf.length) {
        let time = 0n
        for (let i = 0; i < width; i += 1) time = (time << 8n) + BigInt(buf[valueAt + i])
        if (state.webmBase == null) state.webmBase = time
        let next = time - state.webmBase
        if (next < 0n) next = 0n
        for (let i = width - 1; i >= 0; i -= 1) {
          buf[valueAt + i] = Number(next & 0xffn)
          next >>= 8n
        }
      }
    }
    offset = dataEnd
  }
  return buf
}

function writeOut(stream, buf) {
  return new Promise((resolve, reject) => {
    if (!buf?.length) { resolve(); return }
    stream.write(buf, (error) => (error ? reject(error) : resolve()))
  })
}

export async function assembleClip(dest, ext, header, files, { bytesPerSecond = 0, frameRate = 0 } = {}) {
  if (!header?.length && !files?.length) throw new Error('The buffer is still filling.')
  const index = ext === 'mp4' && header?.length && files?.length ? await planIndex(header, files).catch(() => null) : null
  const videoId = videoTrackId(header)
  const tracks = header?.length ? readTracks(header) : new Map()
  const scale = tracks.get(videoId)?.scale || 0
  const rate = Number(frameRate) || 0
  const frameTicks = rate >= 30 && scale ? Math.max(1, Math.round(scale / rate)) : 0
  const state = { sequence: 1, base: new Map(index?.base || []), webmBase: null, videoId, frameTicks, pending: null }
  const out = createWriteStream(dest)
  const began = Date.now()
  let bytes = 0
  try {
    if (header?.length) {
      bytes += header.length
      await writeOut(out, header)
    }
    if (index) {
      bytes += index.box.length
      await writeOut(out, index.box)
    }
    let held = null
    const writeHeld = async () => {
      if (!held) return
      bytes += held.length
      await writeOut(out, held)
      held = null
      if (bytesPerSecond > 0) {
        const ahead = (bytes / bytesPerSecond) * 1000 - (Date.now() - began)
        if (ahead > 4) await new Promise((resolve) => setTimeout(resolve, ahead))
      }
    }
    for (const file of files) {
      const buf = await fs.readFile(file)
      retimeClip(buf, ext, state)
      await writeHeld()
      held = buf
    }
    flushVideoPace(state)
    await writeHeld()
    await new Promise((resolve, reject) => {
      out.once('finish', resolve)
      out.once('error', reject)
      out.end()
    })
  } catch (error) {
    out.destroy()
    throw error
  }
  if (bytes < 1024) throw new Error('The buffer is still filling.')
  return { duration: index?.duration || 0 }
}
