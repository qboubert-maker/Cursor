import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BLANK_PLAN, TWEAKS } from './optimizer-tweak-catalog.js'

const SYSTEM32 = path.join(process.env.SystemRoot || process.env.windir || 'C:\\Windows', 'System32')
const TOOLS = {
  reg: path.join(SYSTEM32, 'reg.exe'),
  powercfg: path.join(SYSTEM32, 'powercfg.exe'),
  bcdedit: path.join(SYSTEM32, 'bcdedit.exe'),
  schtasks: path.join(SYSTEM32, 'schtasks.exe'),
  whoami: path.join(SYSTEM32, 'whoami.exe'),
  powershell: path.join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
}

const BUILD = Number(String(os.release()).split('.')[2]) || 0
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const PLAN_SOURCES = ['e9a42b02-d5df-448d-aa00-03f14749eb61', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c']
const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e'
const HKLM = 'HKEY_LOCAL_MACHINE'
const SERVICES = `${HKLM}\\SYSTEM\\CurrentControlSet\\Services`
const NET_CLASS = `${HKLM}\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}`
const DISPLAY_CLASS = `${HKLM}\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}`
const USB_ENUM = `${HKLM}\\SYSTEM\\CurrentControlSet\\Enum\\USB`
const VENDORS = {
  amd: /advanced micro devices|\bamd\b|\bati\b/i,
  nvidia: /nvidia/i,
  intel: /intel/i,
}
const REG_KINDS = new Set(['reg', 'bits', 'flags', 'field', 'key'])
const VALUE_LINE = /^ {4}(.*?) {4}(REG_[A-Z_]+)(?: {4}(.*))?$/

function decodeOutput(buffer) {
  if (!buffer || !buffer.length) return ''
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
  const probe = Math.min(buffer.length, 512)
  let zeros = 0
  for (let index = 1; index < probe; index += 2) if (buffer[index] === 0) zeros++
  return zeros > probe / 4 ? buffer.toString('utf16le') : buffer.toString('utf8')
}

function run(file, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: decodeOutput(stdout), stderr: decodeOutput(stderr) })
    })
  })
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function lazy(factory) {
  let promise = null
  return () => {
    if (!promise) promise = factory()
    return promise
  }
}

function fullKey(key) {
  const [root, ...rest] = String(key).split('\\')
  const upper = root.toUpperCase()
  const name = upper === 'HKLM' ? HKLM : upper === 'HKCU' ? 'HKEY_CURRENT_USER' : root
  return [name, ...rest].join('\\')
}

function parentKey(key) {
  const index = key.lastIndexOf('\\')
  return index > 0 ? key.slice(0, index) : key
}

function fitsBuild(spec) {
  if (spec.minBuild && BUILD < spec.minBuild) return false
  if (spec.maxBuild && BUILD > spec.maxBuild) return false
  return true
}

function parseReg(stdout) {
  const keys = new Map()
  let current = null
  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith('HKEY_')) {
      const name = line.trim()
      const id = name.toLowerCase()
      current = keys.get(id) || { key: name, values: new Map() }
      keys.set(id, current)
      continue
    }
    const match = VALUE_LINE.exec(line)
    if (match && current) current.values.set(match[1].toLowerCase(), { name: match[1], type: match[2], data: match[3] ?? '' })
  }
  return keys
}

function hexToBytes(hex) {
  const clean = String(hex ?? '').replace(/[^0-9a-f]/gi, '')
  const bytes = []
  for (let index = 0; index + 1 < clean.length; index += 2) bytes.push(Number.parseInt(clean.slice(index, index + 2), 16))
  return bytes
}

function bytesToHex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function hexList(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(',')
}

function readValue(entry) {
  if (!entry) return { exists: false }
  if (entry.type === 'REG_DWORD') return { exists: true, type: entry.type, data: Number.parseInt(entry.data, 16) >>> 0 }
  if (entry.type === 'REG_QWORD') return { exists: true, type: entry.type, data: BigInt(entry.data || '0').toString() }
  return { exists: true, type: entry.type, data: entry.data }
}

function sameValue(a, b) {
  if (!a?.exists || !b?.exists) return Boolean(a?.exists) === Boolean(b?.exists)
  if (a.type !== b.type) return false
  if (a.type === 'REG_DWORD') return (Number(a.data) >>> 0) === (Number(b.data) >>> 0)
  if (a.type === 'REG_BINARY' || a.type === 'REG_NONE') return bytesToHex(hexToBytes(a.data)) === bytesToHex(hexToBytes(b.data))
  if (a.type === 'REG_QWORD') return BigInt(a.data) === BigInt(b.data)
  return String(a.data) === String(b.data)
}

function escapeReg(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function regLine(name, value) {
  const label = name === null ? '@' : `"${escapeReg(name)}"`
  if (!value.exists) return `${label}=-`
  switch (value.type) {
    case 'REG_DWORD':
      return `${label}=dword:${(Number(value.data) >>> 0).toString(16).padStart(8, '0')}`
    case 'REG_SZ':
      return `${label}="${escapeReg(value.data)}"`
    case 'REG_BINARY':
      return `${label}=hex:${hexList(hexToBytes(value.data))}`
    case 'REG_NONE':
      return `${label}=hex(0):${hexList(hexToBytes(value.data))}`
    case 'REG_EXPAND_SZ':
      return `${label}=hex(2):${hexList(Buffer.from(`${value.data}\0`, 'utf16le'))}`
    case 'REG_MULTI_SZ': {
      const items = value.data ? String(value.data).split('\\0') : []
      return `${label}=hex(7):${hexList(Buffer.from(`${items.join('\0')}\0\0`, 'utf16le'))}`
    }
    case 'REG_QWORD': {
      let rest = BigInt(value.data)
      const bytes = []
      for (let index = 0; index < 8; index++) {
        bytes.push(Number(rest & 0xffn))
        rest >>= 8n
      }
      return `${label}=hex(b):${hexList(bytes)}`
    }
    default:
      return null
  }
}

async function regImport(writes, removeKeys = []) {
  if (!writes.size && !removeKeys.length) return true
  const lines = ['Windows Registry Editor Version 5.00', '']
  for (const key of removeKeys) lines.push(`[-${key}]`, '')
  for (const [key, entries] of writes) {
    lines.push(`[${key}]`)
    for (const [name, value] of entries) {
      const line = regLine(name, value)
      if (line) lines.push(line)
    }
    lines.push('')
  }
  const file = path.join(os.tmpdir(), `blank-tweaks-${process.pid}-${Date.now()}.reg`)
  await fs.writeFile(file, Buffer.from(`\ufeff${lines.join('\r\n')}\r\n`, 'utf16le'))
  try {
    return (await run(TOOLS.reg, ['import', file])).ok
  } finally {
    await fs.rm(file, { force: true }).catch(() => {})
  }
}

class RegistryView {
  constructor() {
    this.cache = new Map()
  }

  async load(keys) {
    const pending = new Map()
    for (const key of keys) {
      const id = key.toLowerCase()
      if (!this.cache.has(id) && !pending.has(id)) pending.set(id, key)
    }
    await mapLimit([...pending.entries()], 12, async ([id, key]) => {
      const out = await run(TOOLS.reg, ['query', key])
      if (!out.ok) {
        this.cache.set(id, null)
        return
      }
      const parsed = parseReg(out.stdout)
      const self = parsed.get(id) || { key, values: new Map() }
      const subkeys = []
      for (const [childId, entry] of parsed) {
        if (childId !== id && childId.startsWith(`${id}\\`) && !childId.slice(id.length + 1).includes('\\')) subkeys.push(entry.key)
      }
      this.cache.set(id, { key: self.key, values: self.values, subkeys })
    })
  }

  has(key) {
    return this.cache.has(key.toLowerCase())
  }

  get(key) {
    return this.cache.get(key.toLowerCase()) ?? null
  }

  value(key, name) {
    return readValue(this.get(key)?.values.get(String(name).toLowerCase()))
  }
}

function parseParts(data) {
  const parts = new Map()
  for (const chunk of String(data ?? '').split(';')) {
    const at = chunk.indexOf('=')
    if (at > 0) parts.set(chunk.slice(0, at), chunk.slice(at + 1))
  }
  return parts
}

function joinParts(parts) {
  return [...parts].map(([name, value]) => `${name}=${value};`).join('')
}

function valueId(atom) {
  return `${atom.key}|${atom.name ?? ''}`.toLowerCase()
}

function applyTarget(atom, current) {
  switch (atom.kind) {
    case 'reg':
      return { exists: true, type: atom.type, data: atom.value }
    case 'bits': {
      if (!current.exists || current.type !== 'REG_BINARY') return null
      const bytes = hexToBytes(current.data)
      for (const [index, mask] of atom.clear) if (index < bytes.length) bytes[index] &= ~mask & 0xff
      return { exists: true, type: current.type, data: bytesToHex(bytes) }
    }
    case 'flags': {
      const number = Number.parseInt(current.data, 10)
      if (!current.exists || !Number.isFinite(number)) return null
      return { exists: true, type: current.type, data: String(number & ~atom.clear) }
    }
    case 'field': {
      const parts = parseParts(current.exists ? current.data : '')
      parts.set(atom.part, String(atom.value))
      return { exists: true, type: 'REG_SZ', data: joinParts(parts) }
    }
    default:
      return null
  }
}

function restoreTarget(atom, prior, current) {
  switch (atom.kind) {
    case 'reg':
      return prior.exists ? { exists: true, type: prior.type, data: prior.data } : { exists: false }
    case 'bits': {
      if (!prior.exists) return null
      if (!current.exists) return { exists: true, type: prior.type, data: prior.data }
      const now = hexToBytes(current.data)
      const was = hexToBytes(prior.data)
      for (const [index, mask] of atom.clear) {
        if (index < now.length && index < was.length) now[index] = (now[index] & ~mask & 0xff) | (was[index] & mask)
      }
      return { exists: true, type: current.type, data: bytesToHex(now) }
    }
    case 'flags': {
      if (!prior.exists) return null
      if (!current.exists) return { exists: true, type: prior.type, data: prior.data }
      const now = Number.parseInt(current.data, 10)
      const was = Number.parseInt(prior.data, 10)
      if (!Number.isFinite(now) || !Number.isFinite(was)) return { exists: true, type: prior.type, data: prior.data }
      return { exists: true, type: current.type, data: String((now & ~atom.clear) | (was & atom.clear)) }
    }
    case 'field': {
      const parts = parseParts(current.exists ? current.data : '')
      const before = parseParts(prior.exists ? prior.data : '')
      if (before.has(atom.part)) parts.set(atom.part, before.get(atom.part))
      else parts.delete(atom.part)
      if (!parts.size && !prior.exists) return { exists: false }
      return { exists: true, type: 'REG_SZ', data: joinParts(parts) }
    }
    default:
      return null
  }
}

function satisfied(atom, current) {
  switch (atom.kind) {
    case 'reg':
      return sameValue(current, { exists: true, type: atom.type, data: atom.value })
    case 'bits':
      if (!current.exists) return false
      return atom.clear.every(([index, mask]) => {
        const bytes = hexToBytes(current.data)
        return index >= bytes.length || (bytes[index] & mask) === 0
      })
    case 'flags':
      return current.exists && (Number.parseInt(current.data, 10) & atom.clear) === 0
    case 'field':
      return current.exists && parseParts(current.data).get(atom.part) === String(atom.value)
    default:
      return false
  }
}

function parsePower(stdout) {
  const hex = [...stdout.matchAll(/:\s*0x([0-9a-f]+)/gi)].map((match) => Number.parseInt(match[1], 16))
  if (hex.length < 2) return null
  const indexes = [...stdout.matchAll(/:\s*(\d{3})\s*$/gm)].map((match) => Number(match[1]))
  return {
    ac: hex[hex.length - 2],
    dc: hex[hex.length - 1],
    range: hex.length >= 5 ? { min: hex[0], max: hex[1] } : null,
    indexes,
  }
}

function powerFits(info, value) {
  if (!info) return false
  if (info.range) return value >= info.range.min && value <= info.range.max
  if (info.indexes.length) return info.indexes.includes(value)
  return true
}

async function powerQuery(scheme, sub, setting) {
  const out = await run(TOOLS.powercfg, ['/qh', scheme, sub, setting])
  return out.ok ? parsePower(out.stdout) : null
}

async function activeScheme() {
  const out = await run(TOOLS.powercfg, ['/getactivescheme'])
  return out.stdout.match(GUID)?.[0]?.toLowerCase() ?? null
}

async function schemeList() {
  const out = await run(TOOLS.powercfg, ['/list'])
  return new Set([...out.stdout.matchAll(new RegExp(GUID.source, 'gi'))].map((match) => match[0].toLowerCase()))
}

async function bcdRead(target) {
  const out = await run(TOOLS.bcdedit, ['/enum', target])
  if (!out.ok) return null
  const values = new Map()
  for (const line of out.stdout.split(/\r?\n/)) {
    const match = /^([a-z][a-z0-9]*)\s{2,}(.+?)\s*$/i.exec(line)
    if (match) values.set(match[1].toLowerCase(), match[2])
  }
  return values
}

async function taskRead(taskPath) {
  const out = await run(TOOLS.schtasks, ['/Query', '/TN', taskPath, '/XML'])
  if (!out.ok) return null
  const settings = /<Settings>([\s\S]*?)<\/Settings>/i.exec(out.stdout)?.[1] ?? ''
  const enabled = /<Enabled>\s*(true|false)\s*<\/Enabled>/i.exec(settings)?.[1]
  return { enabled: enabled ? enabled.toLowerCase() === 'true' : true }
}

const elevated = lazy(async () => {
  const out = await run(TOOLS.whoami, ['/groups', '/fo', 'csv'])
  return /S-1-16-(12288|16384)/.test(out.stdout)
})

const bitlocker = lazy(async () => {
  const script = "try { [int](Get-CimInstance -Namespace root/cimv2/Security/MicrosoftVolumeEncryption -ClassName Win32_EncryptableVolume -Filter \"DriveLetter='$env:SystemDrive'\" -ErrorAction Stop).ProtectionStatus } catch { -1 }"
  const out = await run(TOOLS.powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], 15000)
  const status = Number.parseInt(out.stdout.trim(), 10)
  return status === 1 || status === 2
})

class Facts {
  constructor() {
    this.view = new RegistryView()
    this.power = new Map()
    this.tasks = new Map()
    this.adapters = lazy(() => this.loadAdapters())
    this.displays = lazy(() => this.loadDisplays())
    this.hidKeys = new Map()
    this.scheme = lazy(() => activeScheme())
    this.hidDevices = lazy(() => this.loadHidDevices())
  }

  async exists(key) {
    await this.view.load([key])
    return Boolean(this.view.get(key))
  }

  async subkeys(key) {
    await this.view.load([key])
    return this.view.get(key)?.subkeys ?? []
  }

  async powerInfo(sub, setting) {
    const scheme = await this.scheme()
    if (!scheme) return null
    const id = `${scheme}|${sub}|${setting}`
    if (!this.power.has(id)) this.power.set(id, powerQuery(scheme, sub, setting))
    return this.power.get(id)
  }

  task(taskPath) {
    if (!this.tasks.has(taskPath)) this.tasks.set(taskPath, taskRead(taskPath))
    return this.tasks.get(taskPath)
  }

  async loadAdapters() {
    const keys = (await this.subkeys(NET_CLASS)).filter((key) => /\\\d{4}$/.test(key))
    await this.view.load(keys)
    const physical = keys
      .map((key) => this.view.get(key))
      .filter((entry) => entry && (Number.parseInt(entry.values.get('characteristics')?.data ?? '0', 16) & 0x4))
    return mapLimit(physical, 6, async (entry) => {
      const out = await run(TOOLS.reg, ['query', `${entry.key}\\Ndi\\Params`, '/s'])
      const options = new Map()
      if (out.ok) {
        for (const [id, sub] of parseReg(out.stdout)) {
          const match = /\\ndi\\params\\([^\\]+)\\enum$/.exec(id)
          if (match) options.set(match[1], new Set([...sub.values.values()].map((value) => value.name)))
        }
      }
      return { key: entry.key, values: entry.values, options }
    })
  }

  async loadDisplays() {
    const keys = (await this.subkeys(DISPLAY_CLASS)).filter((key) => /\\\d{4}$/.test(key))
    await this.view.load(keys)
    return keys.map((key) => this.view.get(key)).filter(Boolean)
  }

  async loadHidDevices() {
    const out = await run(TOOLS.reg, ['query', USB_ENUM, '/s', '/v', 'Service'])
    if (!out.ok) return new Set()
    const devices = new Set()
    for (const [id, entry] of parseReg(out.stdout)) {
      if (String(entry.values.get('service')?.data).toLowerCase() === 'hidusb') devices.add(`${id}\\device parameters`)
    }
    return devices
  }

  async hidParams(name) {
    if (!this.hidKeys.has(name)) {
      this.hidKeys.set(name, (async () => {
        const devices = await this.hidDevices()
        if (!devices.size) return []
        const out = await run(TOOLS.reg, ['query', USB_ENUM, '/s', '/v', name])
        if (!out.ok) return []
        const keys = []
        for (const [id, entry] of parseReg(out.stdout)) {
          const value = entry.values.get(name.toLowerCase())
          if (devices.has(id) && value?.type === 'REG_DWORD') keys.push({ key: entry.key, name: value.name })
        }
        return keys
      })())
    }
    return this.hidKeys.get(name)
  }
}

async function expand(op, facts) {
  if (!fitsBuild(op)) return []
  if (op.when && !(await facts.exists(fullKey(op.when)))) return []
  switch (op.kind) {
    case 'reg':
    case 'bits':
    case 'flags':
    case 'field':
      return [{ ...op, key: fullKey(op.key), when: undefined, minBuild: undefined, maxBuild: undefined }]
    case 'key':
      return [{ kind: 'key', key: fullKey(op.key), name: null, value: op.value }]
    case 'service': {
      const key = `${SERVICES}\\${op.name}`
      return (await facts.exists(key)) ? [{ kind: 'reg', key, name: 'Start', type: 'REG_DWORD', value: op.start }] : []
    }
    case 'each':
      return (await facts.subkeys(fullKey(op.parent))).map((key) => ({ kind: 'reg', key, name: op.name, type: op.type, value: op.value }))
    case 'nic': {
      const id = op.keyword.toLowerCase()
      return (await facts.adapters())
        .filter((adapter) => adapter.values.has(id) && adapter.options.get(id)?.has(op.value))
        .map((adapter) => ({ kind: 'reg', key: adapter.key, name: adapter.values.get(id).name, type: 'REG_SZ', value: op.value }))
    }
    case 'gpu': {
      const vendor = VENDORS[op.vendor]
      return (await facts.displays())
        .filter((entry) => vendor.test(`${entry.values.get('providername')?.data ?? ''} ${entry.values.get('driverdesc')?.data ?? ''}`))
        .map((entry) => ({ kind: 'reg', key: entry.key, name: op.name, type: op.type, value: op.value }))
    }
    case 'hid':
      return (await facts.hidParams(op.name)).map(({ key, name }) => ({ kind: 'reg', key, name, type: 'REG_DWORD', value: op.value }))
    case 'power':
      return powerFits(await facts.powerInfo(op.sub, op.setting), op.value) ? [{ kind: 'power', sub: op.sub, setting: op.setting, value: op.value }] : []
    case 'plan':
      return (await elevated()) ? [{ kind: 'plan' }] : []
    case 'scheme':
      return (await elevated()) && (await schemeList()).has(String(op.guid).toLowerCase()) ? [{ kind: 'scheme', guid: String(op.guid).toLowerCase() }] : []
    case 'bcd':
      if (!(await elevated()) || (await bitlocker())) return []
      return (await bcdRead(op.target)) ? [{ kind: 'bcd', target: op.target, name: op.name, value: op.value }] : []
    case 'task':
      return (await facts.task(op.path)) ? [{ kind: 'task', path: op.path }] : []
    default:
      return []
  }
}

async function resolveTweak(id, facts) {
  const spec = TWEAKS[id]
  if (!spec || !fitsBuild(spec)) return []
  const groups = await Promise.all(spec.ops.map((op) => expand(op, facts)))
  return groups.flat()
}

function keysFor(atom) {
  return atom.kind === 'key' ? [atom.key, parentKey(atom.key)] : [atom.key]
}

function queueWrite(writes, key, name, value) {
  const entries = writes.get(key) || new Map()
  entries.set(name, value)
  writes.set(key, entries)
}

function ancestors(key) {
  const list = []
  let cursor = parentKey(key)
  while (cursor.includes('\\') && list.length < 4) {
    list.push(cursor)
    cursor = parentKey(cursor)
  }
  return list
}

function createdRoot(view, key) {
  if (view.get(key)) return null
  let root = key
  let cursor = parentKey(key)
  while (cursor.includes('\\') && view.has(cursor) && !view.get(cursor)) {
    root = cursor
    cursor = parentKey(cursor)
  }
  return root
}

async function emptyTree(key) {
  const out = await run(TOOLS.reg, ['query', key, '/s'])
  if (!out.ok) return false
  for (const entry of parseReg(out.stdout).values()) {
    for (const value of entry.values.values()) {
      if (!(value.data === '' && /^\(.*\)$/.test(value.name))) return false
    }
  }
  return true
}

async function applyRegistry(records) {
  if (!records.length) return
  const view = new RegistryView()
  await view.load(records.flatMap(({ atom }) => keysFor(atom)))
  const missing = new Set(records.filter(({ atom }) => atom.kind !== 'key' && !view.get(atom.key)).map(({ atom }) => atom.key))
  await view.load([...missing].flatMap(ancestors))
  const working = new Map()
  const writes = new Map()
  for (const record of records) {
    const { atom } = record
    if (atom.kind === 'key') {
      const existed = Boolean(view.get(atom.key))
      const parent = parentKey(atom.key)
      record.prior = { existed, created: existed ? null : view.get(parent) ? atom.key : parent }
      if (!existed) queueWrite(writes, atom.key, null, { exists: true, type: 'REG_SZ', data: atom.value })
      continue
    }
    const id = valueId(atom)
    const original = view.value(atom.key, atom.name)
    record.prior = { ...original, created: createdRoot(view, atom.key) }
    const current = working.get(id) || original
    const target = applyTarget(atom, current)
    if (!target) {
      record.skip = true
      continue
    }
    working.set(id, target)
    if (!sameValue(current, target)) queueWrite(writes, atom.key, atom.name, target)
  }
  await regImport(writes)
  const check = new RegistryView()
  await check.load([...new Set(records.map(({ atom }) => atom.key))])
  for (const record of records) {
    const { atom } = record
    if (record.skip) record.ok = true
    else if (atom.kind === 'key') record.ok = Boolean(check.get(atom.key))
    else record.ok = satisfied(atom, check.value(atom.key, atom.name))
  }
}

async function restoreRegistry(records) {
  if (!records.length) return
  const view = new RegistryView()
  await view.load([...new Set(records.map(({ atom }) => atom.key))])
  const working = new Map()
  const writes = new Map()
  const removeKeys = []
  for (const record of records) {
    const { atom, prior } = record
    if (atom.kind === 'key') {
      if (prior?.created) removeKeys.push(prior.created)
      continue
    }
    const id = valueId(atom)
    const current = working.get(id) || view.value(atom.key, atom.name)
    const target = prior ? restoreTarget(atom, prior, current) : null
    if (!target) continue
    record.target = target
    working.set(id, target)
    if (!sameValue(current, target)) queueWrite(writes, atom.key, atom.name, target)
  }
  await regImport(writes, removeKeys)
  const created = [...new Set(records.map(({ atom, prior }) => (atom.kind === 'key' ? null : prior?.created)).filter(Boolean))]
  const empty = (await mapLimit(created, 6, async (key) => ((await emptyTree(key)) ? key : null))).filter(Boolean)
  if (empty.length) await regImport(new Map(), empty)
  const check = new RegistryView()
  await check.load([...new Set(records.map(({ atom, prior }) => (atom.kind === 'key' && prior?.created) || atom.key))])
  for (const record of records) {
    const { atom, prior } = record
    if (atom.kind === 'key') record.ok = !prior?.created || !check.get(prior.created)
    else record.ok = !record.target || sameValue(check.value(atom.key, atom.name), working.get(valueId(atom)))
  }
}

async function applyPlan(record) {
  const before = await activeScheme()
  const schemes = await schemeList()
  let created = false
  if (!schemes.has(BLANK_PLAN)) {
    for (const source of PLAN_SOURCES) {
      if ((await run(TOOLS.powercfg, ['/duplicatescheme', source, BLANK_PLAN])).ok) {
        created = true
        break
      }
    }
    if (!created) {
      record.ok = false
      return
    }
    await run(TOOLS.powercfg, ['/changename', BLANK_PLAN, 'Blank Ultimate', 'Blank Ultimate performance plan'])
  }
  await run(TOOLS.powercfg, ['/setactive', BLANK_PLAN])
  record.prior = { previous: before && before !== BLANK_PLAN ? before : BALANCED, created }
  record.ok = (await activeScheme()) === BLANK_PLAN
  if (!record.ok && created) await run(TOOLS.powercfg, ['/delete', BLANK_PLAN])
}

async function applyScheme(record) {
  const before = await activeScheme()
  await run(TOOLS.powercfg, ['/setactive', record.atom.guid])
  record.prior = { previous: before || BALANCED }
  record.ok = (await activeScheme()) === record.atom.guid
}

async function restoreScheme(record) {
  const schemes = await schemeList()
  const target = schemes.has(record.prior?.previous) ? record.prior.previous : BALANCED
  await run(TOOLS.powercfg, ['/setactive', target])
  record.ok = (await activeScheme()) === target
}

async function restorePlan(record) {
  const schemes = await schemeList()
  const target = schemes.has(record.prior?.previous) ? record.prior.previous : BALANCED
  await run(TOOLS.powercfg, ['/setactive', target])
  if (record.prior?.created && schemes.has(BLANK_PLAN)) await run(TOOLS.powercfg, ['/delete', BLANK_PLAN])
  record.ok = (await activeScheme()) === target
}

async function applyPower(records) {
  if (!records.length) return
  const scheme = await activeScheme()
  const infos = await Promise.all(records.map(({ atom }) => (scheme ? powerQuery(scheme, atom.sub, atom.setting) : null)))
  for (const [index, record] of records.entries()) {
    const { atom } = record
    const info = infos[index]
    if (!powerFits(info, atom.value)) {
      record.ok = false
      continue
    }
    record.prior = { schemes: { [scheme]: info.ac } }
    if (info.ac !== atom.value) await run(TOOLS.powercfg, ['/setacvalueindex', scheme, atom.sub, atom.setting, String(atom.value)])
  }
  await run(TOOLS.powercfg, ['/setactive', scheme])
  await Promise.all(records.filter((record) => record.prior).map(async (record) => {
    const info = await powerQuery(scheme, record.atom.sub, record.atom.setting)
    record.ok = info?.ac === record.atom.value
  }))
}

async function restorePower(records) {
  if (!records.length) return
  const scheme = await activeScheme()
  for (const record of records) {
    for (const [guid, value] of Object.entries(record.prior?.schemes ?? {})) {
      await run(TOOLS.powercfg, ['/setacvalueindex', guid, record.atom.sub, record.atom.setting, String(value)])
    }
  }
  if (scheme) await run(TOOLS.powercfg, ['/setactive', scheme])
  await Promise.all(records.map(async (record) => {
    const value = record.prior?.schemes?.[scheme]
    record.ok = value === undefined || (await powerQuery(scheme, record.atom.sub, record.atom.setting))?.ac === value
  }))
}

function bcdMatches(values, name, token) {
  const current = values?.get(name)
  if (token === null) return current === undefined
  return current !== undefined && current.toLowerCase() === String(token).toLowerCase()
}

async function setBcd(target, name, token) {
  return token === null
    ? run(TOOLS.bcdedit, ['/deletevalue', target, name])
    : run(TOOLS.bcdedit, ['/set', target, name, String(token)])
}

async function applyBcd(records) {
  for (const record of records) {
    const { atom } = record
    const before = await bcdRead(atom.target)
    if (!before) {
      record.ok = false
      continue
    }
    const current = before.get(atom.name)
    record.prior = { present: current !== undefined, token: current ?? null }
    if (!bcdMatches(before, atom.name, atom.value)) await setBcd(atom.target, atom.name, atom.value)
    record.ok = bcdMatches(await bcdRead(atom.target), atom.name, atom.value)
  }
}

async function restoreBcd(records) {
  for (const record of records) {
    const { atom, prior } = record
    const token = prior?.present ? prior.token : null
    const now = await bcdRead(atom.target)
    if (!bcdMatches(now, atom.name, token)) await setBcd(atom.target, atom.name, token)
    record.ok = bcdMatches(await bcdRead(atom.target), atom.name, token)
  }
}

async function applyTasks(records) {
  await mapLimit(records, 4, async (record) => {
    const before = await taskRead(record.atom.path)
    if (!before) {
      record.ok = false
      return
    }
    record.prior = { enabled: before.enabled }
    if (before.enabled) await run(TOOLS.schtasks, ['/Change', '/TN', record.atom.path, '/Disable'])
    record.ok = (await taskRead(record.atom.path))?.enabled === false
  })
}

async function restoreTasks(records) {
  await mapLimit(records, 4, async (record) => {
    if (!record.prior?.enabled) {
      record.ok = true
      return
    }
    await run(TOOLS.schtasks, ['/Change', '/TN', record.atom.path, '/Enable'])
    record.ok = (await taskRead(record.atom.path))?.enabled === true
  })
}

async function applyRecords(records) {
  await applyRegistry(records.filter(({ atom }) => REG_KINDS.has(atom.kind)))
  for (const record of records.filter(({ atom }) => atom.kind === 'plan')) await applyPlan(record)
  for (const record of records.filter(({ atom }) => atom.kind === 'scheme')) await applyScheme(record)
  await applyPower(records.filter(({ atom }) => atom.kind === 'power'))
  await applyBcd(records.filter(({ atom }) => atom.kind === 'bcd'))
  await applyTasks(records.filter(({ atom }) => atom.kind === 'task'))
}

async function restoreRecords(records) {
  await restoreRegistry(records.filter(({ atom }) => REG_KINDS.has(atom.kind)))
  await restorePower(records.filter(({ atom }) => atom.kind === 'power'))
  for (const record of records.filter(({ atom }) => atom.kind === 'plan')) await restorePlan(record)
  for (const record of records.filter(({ atom }) => atom.kind === 'scheme')) await restoreScheme(record)
  await restoreBcd(records.filter(({ atom }) => atom.kind === 'bcd'))
  await restoreTasks(records.filter(({ atom }) => atom.kind === 'task'))
}

const FACTS_TTL = 5 * 60 * 1000

export function createTweakEngine(journalPath) {
  let journal = null
  let queue = Promise.resolve()
  let availability = null
  let shared = null

  const facts = () => {
    if (!shared || Date.now() - shared.at > FACTS_TTL) shared = { at: Date.now(), facts: new Facts() }
    return shared.facts
  }

  const serial = (task) => {
    const next = queue.then(task, task)
    queue = next.catch(() => {})
    return next
  }

  const load = async () => {
    if (journal) return journal
    try {
      const parsed = JSON.parse(await fs.readFile(journalPath, 'utf8'))
      journal = parsed?.version === 1 && parsed.applied && typeof parsed.applied === 'object' ? parsed : { version: 1, applied: {} }
    } catch {
      journal = { version: 1, applied: {} }
    }
    return journal
  }

  const save = async () => {
    const temp = `${journalPath}.tmp`
    await fs.mkdir(path.dirname(journalPath), { recursive: true })
    await fs.writeFile(temp, JSON.stringify(journal, null, 2))
    await fs.rename(temp, journalPath)
  }

  const powerRecords = () => Object.values(journal.applied).flatMap((entry) => entry.atoms.filter((record) => record.atom.kind === 'power'))

  const forgetScheme = (guid) => {
    for (const record of powerRecords()) delete record.prior?.schemes?.[guid]
  }

  const syncPower = async () => {
    const entries = powerRecords()
    if (!entries.length) return
    const scheme = await activeScheme()
    if (!scheme) return
    let changed = false
    let touched = false
    for (const record of entries) {
      const priors = record.prior?.schemes ?? {}
      record.prior = { schemes: priors }
      if (priors[scheme] !== undefined) continue
      const info = await powerQuery(scheme, record.atom.sub, record.atom.setting)
      if (!powerFits(info, record.atom.value)) continue
      priors[scheme] = info.ac
      changed = true
      if (info.ac !== record.atom.value) {
        await run(TOOLS.powercfg, ['/setacvalueindex', scheme, record.atom.sub, record.atom.setting, String(record.atom.value)])
        touched = true
      }
    }
    if (touched) await run(TOOLS.powercfg, ['/setactive', scheme])
    if (changed) await save()
  }

  const computeAvailability = async () => {
    const known = facts()
    const ids = Object.keys(TWEAKS)
    const atoms = await mapLimit(ids, 6, (id) => resolveTweak(id, known))
    return ids.filter((id, index) => !atoms[index].length)
  }

  const state = async () => {
    await load()
    if (!availability) availability = computeAvailability().catch(() => [])
    const unavailable = await availability
    return {
      applied: Object.keys(journal.applied),
      unavailable: unavailable.filter((id) => !journal.applied[id]),
      elevated: await elevated(),
    }
  }

  const apply = (ids) => serial(async () => {
    await load()
    await syncPower().catch(() => {})
    const result = { applied: [], already: [], failed: [], unavailable: [] }
    const known = facts()
    const work = []
    for (const id of new Set(ids)) {
      if (!TWEAKS[id]) continue
      if (journal.applied[id]) {
        result.already.push(id)
        continue
      }
      work.push({ id })
    }
    await mapLimit(work, 6, async (item) => {
      item.records = (await resolveTweak(item.id, known)).map((atom) => ({ atom }))
    })
    const ready = work.filter((item) => {
      if (item.records.length) return true
      result.unavailable.push(item.id)
      return false
    })
    if (!ready.length) return result
    await applyRecords(ready.flatMap((item) => item.records))
    if (ready.some((item) => item.records.some(({ atom, prior }) => atom.kind === 'plan' && prior?.created))) forgetScheme(BLANK_PLAN)
    const rollback = []
    for (const item of ready) {
      if (item.records.every((record) => record.ok)) {
        journal.applied[item.id] = {
          at: Date.now(),
          atoms: item.records.filter((record) => !record.skip).map(({ atom, prior }) => ({ atom, prior })),
        }
        result.applied.push(item.id)
      } else {
        result.failed.push(item.id)
        rollback.push(...item.records.filter((record) => record.ok && !record.skip && record.prior !== undefined))
      }
    }
    if (rollback.length) await restoreRecords(rollback.map(({ atom, prior }) => ({ atom, prior })))
    await save()
    await syncPower().catch(() => {})
    return result
  })

  const revert = (ids) => serial(async () => {
    await load()
    await syncPower().catch(() => {})
    const result = { reverted: [], missing: [], failed: [] }
    const work = []
    for (const id of new Set(ids)) {
      const entry = journal.applied[id]
      if (!entry) {
        if (TWEAKS[id]) result.missing.push(id)
        continue
      }
      work.push({ id, records: entry.atoms.map(({ atom, prior }) => ({ atom, prior })) })
    }
    if (!work.length) return result
    await restoreRecords(work.flatMap((item) => item.records))
    for (const item of work) {
      if (item.records.every((record) => record.ok)) {
        delete journal.applied[item.id]
        result.reverted.push(item.id)
      } else {
        result.failed.push(item.id)
      }
    }
    if (work.some((item) => item.records.some(({ atom, prior }) => atom.kind === 'plan' && prior?.created))) forgetScheme(BLANK_PLAN)
    await save()
    await syncPower().catch(() => {})
    return result
  })

  const warm = () => {
    state().catch(() => {})
  }

  return { state, apply, revert, warm }
}
