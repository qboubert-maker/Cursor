import { useEffect, useRef, useState } from 'react'

const DRIFT_MS = 2500

function readPad() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()] : []
  return pads.find((pad) => pad && pad.connected) || null
}

export default function usePad() {
  const [pad, setPad] = useState(null)
  const [measuring, setMeasuring] = useState(false)
  const sample = useRef(null)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const gp = readPad()
      if (gp) {
        const axes = gp.axes
        const next = {
          name: gp.id.replace(/\s*\(.*?\)\s*/g, ' ').trim() || 'Controller',
          left: { x: axes[0] || 0, y: axes[1] || 0 },
          right: { x: axes[2] || 0, y: axes[3] || 0 },
          lt: gp.buttons[6]?.value || 0,
          rt: gp.buttons[7]?.value || 0,
          buttons: gp.buttons.map((button) => button.pressed),
        }
        if (sample.current) {
          const run = sample.current
          run.left = Math.max(run.left, Math.hypot(next.left.x, next.left.y))
          run.right = Math.max(run.right, Math.hypot(next.right.x, next.right.y))
          run.lx += next.left.x
          run.ly += next.left.y
          run.rx += next.right.x
          run.ry += next.right.y
          run.n += 1
        }
        setPad(next)
      } else {
        setPad(null)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const measureDrift = (onDone) => {
    if (measuring || !pad) return
    sample.current = { left: 0, right: 0, lx: 0, ly: 0, rx: 0, ry: 0, n: 0 }
    setMeasuring(true)
    setTimeout(() => {
      const run = sample.current
      sample.current = null
      setMeasuring(false)
      const n = Math.max(1, run.n)
      onDone({
        left: run.left,
        right: run.right,
        leftBias: { x: run.lx / n, y: run.ly / n },
        rightBias: { x: run.rx / n, y: run.ry / n },
      })
    }, DRIFT_MS)
  }

  return { pad, measuring, measureDrift }
}
