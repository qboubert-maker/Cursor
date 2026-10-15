import { useSyncExternalStore } from 'react'

const listeners = new Set()
let active = read()

function read() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible' && document.hasFocus()
}

function update() {
  const next = read()
  if (next === active) return
  active = next
  document.documentElement.classList.toggle('is-idle', !next)
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  document.documentElement.classList.toggle('is-idle', !active)
  window.addEventListener('focus', update)
  window.addEventListener('blur', update)
  document.addEventListener('visibilitychange', update)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function appActive() {
  return active
}

export default function useAppActive() {
  return useSyncExternalStore(subscribe, appActive, () => true)
}
