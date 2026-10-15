import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMotionValueEvent } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Experience from './components/Experience'
import UIOverlay from './components/UIOverlay'
import Navbar from './components/Navbar'
import Cursor from './components/Cursor'
import { SECTIONS, SECTION_TARGETS, scrollProgress, sectionFromProgress } from './lib/rig'
import { destroySmoothScroll, initSmoothScroll, pauseSmoothScroll, resumeSmoothScroll, scrollToY } from './lib/smoothScroll'
import { useCheckout } from './context/CheckoutContext'

// One continuous pass. Speed eases down through each chapter and never stops,
// so the camera stays glued to the clock instead of stalling and catching up.
const PLAY_SECONDS = 28
const HOLDS = [
  [0.02, 0.55, 0.055],
  [0.305, 1.2, 0.05],
  [0.388, 1.45, 0.02],
  [0.438, 1.2, 0.028],
  [0.594, 1.2, 0.032],
  [0.65, 2.0, 0.013],
  [0.683, 2.15, 0.011],
  [0.703, 2.6, 0.009],
  [0.728, 2.15, 0.013],
  [0.834, 1.25, 0.032],
  [0.916, 1.4, 0.02],
  [0.958, 1.85, 0.022],
  [0.996, 1.55, 0.014],
]

const holdWeight = (p) => {
  let weight = 1
  for (let i = 0; i < HOLDS.length; i++) {
    const [center, amp, sigma] = HOLDS[i]
    const x = (p - center) / sigma
    weight += amp * Math.exp(-0.5 * x * x)
  }
  return weight
}

const EASE_STEPS = 800
const easeTime = new Float64Array(EASE_STEPS + 1)
{
  const weights = new Float64Array(EASE_STEPS)
  let sum = 0
  for (let i = 0; i < EASE_STEPS; i++) {
    weights[i] = holdWeight((i + 0.5) / EASE_STEPS)
    sum += weights[i]
  }
  let acc = 0
  for (let i = 0; i < EASE_STEPS; i++) {
    acc += weights[i]
    easeTime[i + 1] = acc / sum
  }
}

const playEase = (t) => {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = EASE_STEPS
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (easeTime[mid] < t) lo = mid + 1
    else hi = mid
  }
  const i = Math.max(1, lo)
  const t0 = easeTime[i - 1]
  const t1 = easeTime[i]
  return (i - 1 + (t - t0) / (t1 - t0 || 1)) / EASE_STEPS
}

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const booted = true
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playback = useRef(null)
  const { pendingSection, clearPendingSection } = useCheckout()

  const releaseScroll = useCallback(() => {
    const st = ScrollTrigger.getAll()[0]
    if (st && !st.enabled) st.enable(false, false)
    ScrollTrigger.update()
  }, [])

  const stopPlayback = useCallback(() => {
    playback.current?.kill()
    playback.current = null
    releaseScroll()
    resumeSmoothScroll()
    setPlaying(false)
  }, [releaseScroll])

  const playSlideshow = useCallback(() => {
    const root = document.documentElement
    root.classList.remove('is-booting')
    root.style.overflowY = 'auto'
    document.body.style.overflowY = 'visible'
    ScrollTrigger.refresh()

    const scroller = document.scrollingElement || root
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    const st = ScrollTrigger.getAll()[0]
    const animation = st?.animation
    if (max <= 0 || !st || !animation) return

    playback.current?.kill()
    if (!st.enabled) st.enable(false, false)
    pauseSmoothScroll()
    window.scrollTo(0, 0)
    ScrollTrigger.update()
    st.disable(false, true)

    const driver = { p: 0 }
    animation.progress(0)
    playback.current = gsap.to(driver, {
      p: 1,
      duration: PLAY_SECONDS,
      ease: playEase,
      onUpdate: () => {
        animation.progress(driver.p)
        window.scrollTo(0, max * driver.p)
      },
      onComplete: () => {
        animation.progress(1)
        window.scrollTo(0, max)
        playback.current = null
        releaseScroll()
        resumeSmoothScroll()
        setPlaying(false)
      },
    })
    setPlaying(true)
  }, [releaseScroll])

  const togglePlayback = useCallback(() => {
    if (playback.current) stopPlayback()
    else playSlideshow()
  }, [playSlideshow, stopPlayback])

  useEffect(() => {
    initSmoothScroll()
    return () => {
      playback.current?.kill()
      const st = ScrollTrigger.getAll()[0]
      if (st && !st.enabled) st.enable(false, false)
      destroySmoothScroll()
    }
  }, [])

  useMotionValueEvent(scrollProgress, 'change', (v) => {
    const next = sectionFromProgress(v)
    setActive((prev) => (prev === next ? prev : next))
  })

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('is-booting', !booted)
    if (booted) ScrollTrigger.refresh()
  }, [booted])

  const navigate = useCallback(
    (index) => {
      stopPlayback()
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollToY(max * SECTION_TARGETS[index])
    },
    [stopPlayback],
  )

  useEffect(() => {
    if (pendingSection == null) return
    navigate(pendingSection)
    clearPendingSection()
  }, [pendingSection, navigate, clearPendingSection])

  return (
    <div className="relative bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <Experience />
      </div>
      <div className="vignette pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
      <div className="scanlines pointer-events-none fixed inset-0 z-[2]" aria-hidden="true" />

      <main id="scroll-container" className="pointer-events-none relative z-10 h-[2480vh]">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-label={section.label}
            style={{ height: `${(section.range[1] - section.range[0]) * 100}%` }}
          />
        ))}
      </main>

      <UIOverlay active={active} booted={booted} onNavigate={navigate} />
      <Navbar
        active={active}
        booted={booted}
        playing={playing}
        onTogglePlay={togglePlayback}
        onNavigate={navigate}
      />

      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden opacity-[0.09] mix-blend-overlay" aria-hidden="true">
        <div className="grain absolute" />
      </div>
      <Cursor />
    </div>
  )
}
