const listeners = new Set()

const BUTTONS = ['L3', 'R3', 'L1', 'R1', 'L2', 'R2', 'A', 'B', 'X', 'Y', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHARE', 'OPTIONS', 'TOUCH', 'PS']

function emptyDelays() {
  return Object.fromEntries(BUTTONS.map((button) => [button, 0]))
}

const mock = {
  running: false,
  native: false,
  profiles: { ps5: emptyDelays(), xbox: emptyDelays() },
  delays: emptyDelays(),
  liveButtons: [],
  lastJitterUs: 0,
  qpcFrequency: 0,
  timerResolutionMs: 0,
  queueDepth: 0,
}

function bridge() {
  if (typeof window === 'undefined') return null
  return window.controllerOptimizer || null
}

function emit(status) {
  for (const listener of listeners) listener(status)
}

function mockStatus() {
  return {
    ok: true,
    fallback: true,
    status: {
      ...mock,
      buttons: BUTTONS.map((buttonName) => ({
        buttonName,
        targetDelayMs: mock.delays[buttonName] || 0,
        enabled: true,
      })),
    },
  }
}

export function onStatus(listener) {
  listeners.add(listener)
  const api = bridge()
  const detach = api?.onStatus
    ? api.onStatus((status) => {
        listener(status)
      })
    : null
  return () => {
    listeners.delete(listener)
    if (typeof detach === 'function') detach()
  }
}

export async function toggleEngine(enabled, consoleType) {
  try {
    const api = bridge()
    if (!api) {
      mock.running = Boolean(enabled)
      const result = mockStatus()
      emit(result.status)
      return result
    }
    const result = await api.toggleEngine(Boolean(enabled), consoleType)
    if (result?.status) emit(result.status)
    return result
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Engine toggle failed', fallback: true }
  }
}

export async function setOutput(consoleType) {
  try {
    const api = bridge()
    if (!api?.setOutput) return mockStatus()
    const result = await api.setOutput({ consoleType })
    if (result?.status) emit(result.status)
    return result
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Output switch failed', fallback: true }
  }
}

export async function applyDelay(consoleType, button, delayMs) {
  try {
    const api = bridge()
    if (!api) {
      const pad = consoleType === 'xbox' ? 'xbox' : 'ps5'
      const ms = Math.round(Math.max(0, Math.min(10, Number(delayMs) || 0)))
      mock.profiles[pad][button] = ms
      mock.delays[button] = ms
      mock.running = true
      const result = mockStatus()
      emit(result.status)
      return result
    }
    const result = await api.applyDelay({ consoleType, button, delayMs })
    if (result?.status) emit(result.status)
    return result
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Apply failed', fallback: true }
  }
}

export async function getActiveStatus() {
  try {
    const api = bridge()
    if (!api) return mockStatus()
    return await api.getActiveStatus()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Status failed', fallback: true, status: mock }
  }
}
