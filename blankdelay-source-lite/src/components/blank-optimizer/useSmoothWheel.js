import { useEffect } from 'react'

const LINE = 40
const EASE = 0.2

export default function useSmoothWheel(ref, active) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return undefined
    let current = el.scrollTop
    let target = current
    let frame = 0
    let last = 0

    const step = (now) => {
      const dt = last ? Math.min(64, now - last) : 16.7
      last = now
      current += (target - current) * (1 - Math.pow(1 - EASE, dt / 16.7))
      if (Math.abs(target - current) < 0.5) current = target
      el.scrollTop = current
      if (current === target) {
        frame = 0
        last = 0
        return
      }
      frame = window.requestAnimationFrame(step)
    }

    const onWheel = (event) => {
      if (event.ctrlKey) return
      let delta = event.deltaY
      if (event.deltaMode === 1) delta *= LINE
      else if (event.deltaMode === 2) delta *= el.clientHeight
      if (!delta) return
      event.preventDefault()
      if (!frame) {
        current = el.scrollTop
        target = current
      }
      target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target + delta))
      if (!frame && target !== current) frame = window.requestAnimationFrame(step)
    }

    const onScroll = () => {
      if (frame) return
      current = el.scrollTop
      target = current
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [ref, active])
}
