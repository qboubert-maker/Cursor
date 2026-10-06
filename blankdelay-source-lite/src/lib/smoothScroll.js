import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

let lenis
let ticker

export function initSmoothScroll() {
  if (lenis) return lenis
  lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
    syncTouch: true,
    syncTouchLerp: 0.08,
    wheelMultiplier: 1,
    touchMultiplier: 1.1,
    autoRaf: false,
    allowNestedScroll: true,
  })
  lenis.on('scroll', ScrollTrigger.update)
  ticker = (time) => lenis?.raf(time * 1000)
  gsap.ticker.add(ticker)
  gsap.ticker.lagSmoothing(0)
  return lenis
}

export function destroySmoothScroll() {
  if (ticker) gsap.ticker.remove(ticker)
  ticker = null
  lenis?.destroy()
  lenis = null
}

let scrollHolds = 0

export function pauseSmoothScroll() {
  scrollHolds += 1
  lenis?.stop()
  document.documentElement.style.overflowY = 'auto'
}

export function resumeSmoothScroll() {
  scrollHolds = Math.max(0, scrollHolds - 1)
  if (scrollHolds > 0) return
  document.documentElement.style.removeProperty('overflow-y')
  lenis?.start()
}

export function scrollToY(y, { immediate = false } = {}) {
  if (!lenis) {
    window.scrollTo(0, y)
    return
  }
  lenis.scrollTo(y, { immediate, force: true })
}
