import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))

const NAMED = {
  Space: 0x20, Tab: 0x09, Enter: 0x0d, Esc: 0x1b, Backspace: 0x08,
  Up: 0x26, Down: 0x28, Left: 0x25, Right: 0x27,
  Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22, Insert: 0x2d, Delete: 0x2e,
  Plus: 0xbb, Minus: 0xbd,
}
const MODS = { Ctrl: 1, Alt: 2, Shift: 4, Super: 8, Command: 8 }

let native

function engine() {
  if (native !== undefined) return native
  try {
    const bundled = path.join(here, '../build/Release/blank_keyboard_engine.node')
    const unpacked = bundled.replace('app.asar', 'app.asar.unpacked')
    const loaded = require(fs.existsSync(unpacked) ? unpacked : bundled)
    native = typeof loaded?.WatchKey === 'function' ? loaded : null
  } catch {
    native = null
  }
  return native
}

export function parseAccelerator(accelerator) {
  let vk = 0
  let mods = 0
  for (const part of String(accelerator || '').split('+').filter(Boolean)) {
    if (MODS[part]) {
      mods |= MODS[part]
      continue
    }
    if (vk) return null
    if (/^[A-Z0-9]$/.test(part)) vk = part.charCodeAt(0)
    else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(part)) vk = 0x6f + Number(part.slice(1))
    else if (NAMED[part]) vk = NAMED[part]
    else return null
  }
  return vk ? { vk, mods } : null
}

export function watchKey(accelerator, onPress) {
  const key = parseAccelerator(accelerator)
  const addon = engine()
  if (!key || !addon) return false
  try {
    return Boolean(addon.WatchKey(key.vk, key.mods, onPress))
  } catch {
    return false
  }
}

export function unwatchKey() {
  try {
    engine()?.UnwatchKey?.()
  } catch {
    /* already stopped */
  }
}
