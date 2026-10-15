import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

let lenis
let ticker
let scrollHolds = 0
let scenePaused = false
const sceneListeners = new Set()

function sceneShouldPause() {
  return scrollHolds > 0 || (typeof document !== 'undefined' && document.hidden)
}

function notifyScene() {
  const next = sceneShouldPause()
  if (next === scenePaused) return
  scenePaused = next
  sceneListeners.forEach((fn) => fn(scenePaused))
}

export function subscribeScenePaused(fn) {
  fn(scenePaused)
  sceneListeners.add(fn)
  return () => sceneListeners.delete(fn)
}

export function initSmoothScroll() {
  if (lenis) return lenis
  const mobile = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100
  lenis = new Lenis({
    lerp: mobile ? 0.18 : 0.14,
    smoothWheel: !mobile,
    syncTouch: false,
    wheelMultiplier: 0.9,
    touchMultiplier: 1,
    autoRaf: false,
    allowNestedScroll: true,
  })
  lenis.on('scroll', ScrollTrigger.update)
  ticker = (time) => lenis?.raf(time * 1000)
  gsap.ticker.add(ticker)
  gsap.ticker.lagSmoothing(500, 33)
  document.addEventListener('visibilitychange', notifyScene)
  return lenis
}

export function destroySmoothScroll() {
  if (ticker) gsap.ticker.remove(ticker)
  ticker = null
  document.removeEventListener('visibilitychange', notifyScene)
  lenis?.destroy()
  lenis = null
}

export function pauseSmoothScroll() {
  scrollHolds += 1
  lenis?.stop()
  document.documentElement.style.overflowY = 'auto'
  notifyScene()
}

export function resumeSmoothScroll() {
  scrollHolds = Math.max(0, scrollHolds - 1)
  notifyScene()
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
