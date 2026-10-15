export const DELAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const POLL_HZ = [8000, 4000, 2000, 1000, 500, 250, 125, 63, 31, 16, 8]

export function formatMs(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return '0'
  return String(Math.round(n))
}

export function formatHz(value) {
  const step = Math.min(10, Math.max(0, Math.round(Number(value) || 0)))
  const hz = POLL_HZ[step]
  if (hz >= 1000) return `${hz / 1000}k`
  return String(hz)
}

export function sameMs(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.005
}
