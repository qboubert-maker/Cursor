let snapshot = null
let request = null

export function readTweakState() {
  return snapshot
}

export function loadTweakState() {
  if (!request) {
    const bridge = window.optimizerWindow
    request = Promise.resolve(bridge?.tweaksState ? bridge.tweaksState() : null)
      .then((state) => {
        if (state) snapshot = { applied: new Set(state.applied || []), unavailable: new Set(state.unavailable || []) }
        return snapshot
      })
      .catch(() => {
        request = null
        return snapshot
      })
  }
  return request
}

export function recordTweakState({ applied = [], reverted = [], unavailable = [] }) {
  if (!snapshot) snapshot = { applied: new Set(), unavailable: new Set() }
  applied.forEach((id) => snapshot.applied.add(id))
  reverted.forEach((id) => snapshot.applied.delete(id))
  unavailable.forEach((id) => snapshot.unavailable.add(id))
}
