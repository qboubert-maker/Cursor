import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowRight, CheckCircle2, DollarSign, Target } from 'lucide-react'
import DiscordIcon from './icons/DiscordIcon'
import Products from './Products'
import AffiliateSystem from './AffiliateSystem'
import SocialsUI from './SocialsUI'
import { DISCORD_URL } from '../lib/content'
import { CHECKOUT_PRODUCTS } from '../lib/checkoutCatalog'
import { useCheckout } from '../context/CheckoutContext'
import { EASE_EXPO, SECTIONS, scrollProgress } from '../lib/rig'

const CURRENT_YEAR = new Date().getFullYear()

const lineReveal = {
  hidden: { y: '115%' },
  show: (i = 0) => ({ y: '0%', transition: { duration: 1.15, ease: EASE_EXPO, delay: 0.12 + i * 0.09 } }),
}

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_EXPO, delay: 0.35 + i * 0.08 } }),
}

const letterReveal = {
  hidden: { y: '110%' },
  show: (i) => ({ y: '0%', transition: { duration: 1.25, ease: EASE_EXPO, delay: 0.2 + i * 0.045 } }),
}

function usePanel([a, b, c, d], distance = 70) {
  const opacity = useTransform(scrollProgress, [a, b, c, d], [0, 1, 1, 0])
  const y = useTransform(scrollProgress, [a, b, c, d], [distance, 0, 0, -distance])
  const visibility = useTransform(opacity, (o) => (o < 0.02 ? 'hidden' : 'visible'))
  return { opacity, y, visibility }
}

function Mask({ children, className = '' }) {
  return (
    <span className={`block overflow-hidden px-[0.18em] -mx-[0.18em] pt-[0.12em] pb-[0.08em] -mt-[0.12em] -mb-[0.08em] ${className}`}>
      {children}
    </span>
  )
}

function RevealLine({ children, i = 0, active, className = '' }) {
  return (
    <Mask>
      <motion.span className={`block ${className}`} custom={i} variants={lineReveal} initial="hidden" animate={active ? 'show' : 'hidden'}>
        {children}
      </motion.span>
    </Mask>
  )
}

function Eyebrow({ index, label, active, center = false }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}
      custom={-2}
      className={`flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.32em] text-white/55 md:text-[11px] ${center ? 'justify-center' : ''}`}
    >
      <span className="rounded-full border border-white/20 px-2 py-0.5 text-white">{index}</span>
      <span className="h-px w-10 bg-white/30" />
      {label}
    </motion.div>
  )
}

function MagneticButton({ href, onClick, children }) {
  const anchorRef = useRef(null)
  const [hot, setHot] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 240, damping: 14, mass: 0.7 })
  const sy = useSpring(y, { stiffness: 240, damping: 14, mass: 0.7 })
  const innerX = useTransform(sx, (v) => v * 0.4)
  const innerY = useTransform(sy, (v) => v * 0.4)

  const onMove = (e) => {
    const r = anchorRef.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * 0.5)
    y.set((e.clientY - (r.top + r.height / 2)) * 0.6)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
    setHot(false)
  }

  return (
    <div className="pointer-events-auto relative -m-16 p-16" onMouseMove={onMove} onMouseEnter={() => setHot(true)} onMouseLeave={onLeave}>
      <motion.div style={{ x: sx, y: sy }} className="relative">
        {[0, 0.55].map((delay) => (
          <motion.span
            key={delay}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-white"
            animate={{ scale: [1, hot ? 1.6 : 1.35], opacity: [0.55, 0] }}
            transition={{ duration: hot ? 1 : 1.8, repeat: Infinity, delay, ease: 'easeOut' }}
          />
        ))}
        <motion.button
          type="button"
          ref={anchorRef}
          onClick={(event) => {
            if (href) {
              event.preventDefault()
              window.open(href, '_blank', 'noopener,noreferrer')
              return
            }
            onClick?.(event)
          }}
          animate={{ scale: hot ? 1.07 : 1 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          className={`relative inline-flex items-center overflow-hidden rounded-full bg-white px-9 py-6 text-black transition-shadow duration-500 md:px-16 md:py-9 ${
            hot ? 'cta-glow-hot' : 'cta-glow'
          }`}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-linear-to-r from-transparent via-black/15 to-transparent"
            animate={{ x: hot ? ['0%', '520%'] : '0%' }}
            transition={hot ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.4, ease: 'easeInOut' } : { duration: 0 }}
          />
          <motion.span style={{ x: innerX, y: innerY }} className="relative flex items-center gap-4 md:gap-5">
            {children}
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
  )
}

function BuyNow({ productId, children }) {
  const { openCheckout } = useCheckout()
  return (
    <MagneticButton
      onClick={async () => {
        const product = CHECKOUT_PRODUCTS[productId]
        const result = await openCheckout(product)
        if (!result?.ok) window.alert(result?.error || 'Checkout could not open. Try again.')
      }}
    >
      {children}
    </MagneticButton>
  )
}

function HeroPanel({ booted, onNavigate }) {
  const opacity = useTransform(scrollProgress, [0, 0.06, 0.112], [1, 1, 0])
  const scale = useTransform(scrollProgress, [0, 0.112], [1, 1.08])
  const y = useTransform(scrollProgress, [0, 0.112], [0, -40])
  const blur = useTransform(scrollProgress, [0.06, 0.112], [0, 12])
  const filter = useTransform([blur], ([b]) => (b < 0.05 ? 'none' : `blur(${b}px)`))
  const visibility = useTransform(opacity, (o) => (o < 0.02 ? 'hidden' : 'visible'))
  const state = booted ? 'show' : 'hidden'
  const words = ['BLANK', 'DELAY']
  let letterIndex = 0

  return (
    <motion.section
      style={{ opacity, scale, y, filter, visibility }}
      className="absolute inset-0 flex flex-col items-center justify-center px-5 pt-16 text-center md:justify-end md:pb-[15vh]"
      aria-label="Home"
    >
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate={state}
        custom={-1}
        className="flex items-center gap-3 font-mono text-[9px] whitespace-nowrap uppercase tracking-[0.2em] text-white/60 md:text-[11px] md:tracking-[0.34em]"
      >
        <span className="h-px w-5 bg-white/40 md:w-14" />
        PC Optimization // Hardware Macros
        <span className="h-px w-5 bg-white/40 md:w-14" />
      </motion.div>

      <h1 className="font-display stretch-wide text-halo mt-4 text-[19vw] leading-[0.84] font-black tracking-[-0.045em] uppercase md:text-[9.4vw]">
        {words.map((word, w) => (
          <span key={word} className="block md:inline">
            <Mask className="inline-block align-bottom">
              {word.split('').map((ch) => {
                const i = letterIndex++
                return (
                  <motion.span key={`${word}-${i}`} className="inline-block" custom={i} variants={letterReveal} initial="hidden" animate={state}>
                    {ch}
                  </motion.span>
                )
              })}
            </Mask>
            {w === 0 && <span className="hidden md:inline">&nbsp;</span>}
          </span>
        ))}
      </h1>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate={state}
        custom={4}
        className="font-display stretch-semi mt-6 text-[34px] leading-[1.05] font-semibold tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] sm:text-[46px] md:text-[62px]"
      >
        <span className="sheen">Delay?</span> <span className="text-white/50">We left that Blank.</span>
      </motion.p>

      <motion.div variants={fadeUp} initial="hidden" animate={state} custom={6} className="mt-9 flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onNavigate(SECTIONS.findIndex((section) => section.id === 'products'))}
            className="pointer-events-auto group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-[13px] font-semibold tracking-tight text-black transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.55)]"
          >
            View All Products
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-[13px] font-semibold tracking-tight text-white backdrop-blur-md transition-colors duration-300 hover:border-white hover:bg-white/10"
          >
            <DiscordIcon className="h-4 w-4" />
            Join Discord
          </a>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(SECTIONS.findIndex((section) => section.id === 'affiliates'))}
          className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-[13px] font-semibold tracking-tight text-white backdrop-blur-md transition-colors duration-300 hover:border-white hover:bg-white/10"
        >
          <DollarSign size={16} />
          Become an affiliate today
        </button>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate={state}
        custom={9}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 font-mono text-[10px] uppercase tracking-[0.34em] text-white/50"
      >
        Scroll
        <span className="relative block h-10 w-px overflow-hidden bg-white/15">
          <motion.span
            className="absolute inset-x-0 top-0 h-1/2 bg-white"
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
        <ArrowDown size={12} className="text-white/40" />
      </motion.div>
    </motion.section>
  )
}

function ProductsPanel({ active }) {
  const style = usePanel([0.99, 0.994, 1.5, 2])
  return (
    <motion.section style={style} className="absolute inset-0 flex flex-col px-5 pt-20 pb-4 md:px-10 md:pt-24 md:pb-5" aria-label="View All Products">
      <div className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col">
        <div className="mb-3 shrink-0">
          <Eyebrow index="12" label="Purchase" active={active} />
          <h2 className="font-display stretch-wide mt-2 text-[9vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[3.6vw]">
            <RevealLine i={0} active={active}>
              View All
            </RevealLine>
            <RevealLine i={1} active={active} className="text-outline">
              Products
            </RevealLine>
          </h2>
        </div>
        <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto md:flex md:flex-col md:overflow-hidden">
          <Products active={active} />
        </div>
        <footer className="mt-3 flex shrink-0 flex-col items-center justify-between gap-2 border-t border-white/10 pt-3 font-mono text-[9.5px] uppercase tracking-[0.24em] text-white/40 md:flex-row">
          <span>© {CURRENT_YEAR} Blank Delay</span>
          <span>Delay? We left that Blank.</span>
        </footer>
      </div>
    </motion.section>
  )
}

function AffiliatePanel({ active }) {
  const style = usePanel([0.238, 0.283, 0.34, 0.362])
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => {
    if (!active) setApplyOpen(false)
  }, [active])

  useEffect(() => {
    if (!applyOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setApplyOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyOpen])

  return (
    <motion.section style={style} className="absolute inset-0 flex items-center px-5 pt-20 pb-6 md:px-10 md:pt-24" aria-label="Premium Affiliate System">
      <div className="pointer-events-auto mx-auto grid h-full max-h-[calc(100vh-7rem)] w-full max-w-[1320px] items-center gap-6 overflow-visible lg:grid-cols-[0.78fr_1.22fr] lg:gap-10">
        <div>
          <Eyebrow index="02" label="Partner Network" active={active} />
          <h2 className="font-display stretch-wide mt-4 text-[10vw] leading-[0.84] font-black tracking-[-0.04em] uppercase md:text-[4.2vw]">
            <RevealLine i={0} active={active} className="text-outline">
              Premium
            </RevealLine>
            <RevealLine i={1} active={active}>
              Affiliate
            </RevealLine>
            <RevealLine i={2} active={active}>
              System
            </RevealLine>
          </h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={active ? 'show' : 'hidden'}
            custom={2}
            className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60"
          >
            Every operator you bring in pays you back. Live referrals, tiered commission, and a payout rail that does not wait on anyone.
          </motion.p>
          <div className="relative mt-6">
            <button
              type="button"
              onClick={() => setApplyOpen((open) => !open)}
              aria-expanded={applyOpen}
              aria-controls="affiliate-apply-menu"
              className="pointer-events-auto group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-[13px] font-semibold tracking-tight text-black transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.55)]"
            >
              Apply Now
              <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <AnimatePresence>
              {applyOpen && (
                <motion.div
                  id="affiliate-apply-menu"
                  role="dialog"
                  aria-label="Affiliate application"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: EASE_EXPO }}
                  className="absolute left-0 top-full z-30 mt-3 w-[min(100%,320px)] rounded-2xl border border-white/15 bg-black/85 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">Discord</p>
                  <p className="mt-3 text-[15px] font-semibold leading-snug">Join Discord</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/60">Make a support ticket to submit your application.</p>
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white px-5 py-3 text-[13px] font-semibold tracking-tight text-black transition-shadow duration-300 hover:shadow-[0_0_32px_rgba(255,255,255,0.45)]"
                  >
                    <DiscordIcon className="h-4 w-4" />
                    Join Discord
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <AffiliateSystem active={active} />
      </div>
    </motion.section>
  )
}

function SocialsPanel({ active }) {
  const style = usePanel([0.408, 0.418, 0.455, 0.48])
  return (
    <motion.section style={style} className="absolute inset-0 flex items-center px-5 pt-20 pb-8 md:px-10" aria-label="Connect With Us">
      <div className="w-full max-w-[560px] md:ml-[6vw]">
        <Eyebrow index="03" label="Signal" active={active} />
        <h2 className="font-display stretch-wide mt-4 w-max text-[12vw] leading-[0.9] font-black tracking-[-0.02em] uppercase md:text-[4.6vw]">
          <RevealLine i={0} active={active}>
            Connect
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            With Us
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={active ? 'show' : 'hidden'}
          custom={2}
          className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60 md:text-[15px]"
        >
          Hover a channel for its mark. Click it to choose an account.
        </motion.p>
        <SocialsUI active={active} />
      </div>
    </motion.section>
  )
}

function ControllerPanel({ active }) {
  const style = usePanel([0.56, 0.578, 0.61, 0.622], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Controller Macro"
    >
      <div className="w-full max-w-[980px] text-center">
        <Eyebrow index="04" label="Hardware" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[8.5vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[4.6vw]">
          <RevealLine i={0} active={active}>
            Controller
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            Macro
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Hardware-level polling rate override. Absolute sub-1ms input latency for PS5 and Xbox.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={4} className="mt-8 flex justify-center">
          <BuyNow productId="controller-macro">
            <span className="font-display stretch-wide text-[22px] font-black tracking-[-0.02em] uppercase md:text-[34px]">Buy Now</span>
          </BuyNow>
        </motion.div>
      </div>
    </motion.section>
  )
}

function DeskPanel({ active }) {
  const style = usePanel([0.634, 0.642, 0.658, 0.668], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Elite Keyboard and Mouse Macro"
    >
      <div className="w-full max-w-[1040px] text-center">
        <Eyebrow index="05" label="Peripherals" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[7.4vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[4.2vw]">
          <RevealLine i={0} active={active}>
            Elite Keyboard
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            &amp; Mouse Macro
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Sub-millisecond execution. Bound to your keyboard and mouse. Absolute mechanical dominance.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={4} className="mt-8 flex justify-center">
          <BuyNow productId="keyboard-macro">
            <span className="font-display stretch-wide text-[22px] font-black tracking-[-0.02em] uppercase md:text-[34px]">Buy Now</span>
          </BuyNow>
        </motion.div>
      </div>
    </motion.section>
  )
}

function KernelPanel({ active }) {
  const style = usePanel([0.67, 0.676, 0.69, 0.694], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Zero Delay OS App"
    >
      <div className="w-full max-w-[1040px] text-center">
        <Eyebrow index="06" label="Software" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[7.4vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[4.2vw]">
          <RevealLine i={0} active={active}>
            Zero Delay
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            OS App
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Kernel-level optimization. Uncapped FPS. Zero input latency. The ultimate software override.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={4} className="mt-8 flex justify-center">
          <BuyNow productId="zero-delay-os">
            <span className="font-display stretch-wide text-[22px] font-black tracking-[-0.02em] uppercase md:text-[34px]">Buy Now</span>
          </BuyNow>
        </motion.div>
      </div>
    </motion.section>
  )
}

function FpsPanel({ active }) {
  const style = usePanel([0.696, 0.699, 0.708, 0.714], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Elite FPS Boost"
    >
      <div className="w-full max-w-[1040px] text-center">
        <Eyebrow index="07" label="Performance" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[7.4vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[4.2vw]">
          <RevealLine i={0} active={active}>
            Elite FPS
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            Boost
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Shatter your frame cap. Pure system optimization for maximum refresh rate dominance.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={4} className="mt-8 flex justify-center">
          <BuyNow productId="fps-boost">
            <span className="font-display stretch-wide text-[22px] font-black tracking-[-0.02em] uppercase md:text-[34px]">Buy Now</span>
          </BuyNow>
        </motion.div>
      </div>
    </motion.section>
  )
}

function UtilityPanel({ active }) {
  const style = usePanel([0.716, 0.722, 0.734, 0.744], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Premium Utility"
    >
      <div className="w-full max-w-[1040px] text-center">
        <Eyebrow index="08" label="Drivers" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[8vw] leading-[0.86] font-black tracking-[-0.04em] uppercase md:text-[4.8vw]">
          <RevealLine i={0} active={active}>
            Premium
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            Utility
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Hardware-level driver and registry tuning. Maximum GPU power state override for Nvidia and AMD Radeon.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={4} className="mt-8 flex justify-center">
          <BuyNow productId="premium-utility">
            <span className="font-display stretch-wide text-[22px] font-black tracking-[-0.02em] uppercase md:text-[34px]">Buy Now</span>
          </BuyNow>
        </motion.div>
      </div>
    </motion.section>
  )
}

function AimPanel({ active }) {
  const style = usePanel([0.8, 0.822, 0.842, 0.858], 80)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-5 pt-20 pb-10 md:pb-16"
      aria-label="Elite Aim Bundle"
    >
      <div className="w-full max-w-[1100px] text-center">
        <Eyebrow index="09" label="Crosshair" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-4 text-[9vw] leading-[0.86] font-black tracking-[-0.045em] uppercase md:text-[6.2vw]">
          <RevealLine i={0} active={active}>
            Elite Aim
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            Bundle
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-2xl text-[14px] leading-relaxed text-white/60 md:text-[17px]"
        >
          Algorithmic precision. Custom crosshair overlays. Perfect tracking. Feel the zero-latency override.
        </motion.p>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={4}
          className="font-display stretch-wide mt-8 text-[22px] font-black tracking-[-0.02em] text-white/80 uppercase md:text-[34px]"
        >
          Coming soon
        </motion.p>
      </div>
    </motion.section>
  )
}

const PILLARS = [
  {
    icon: AlertTriangle,
    header: 'The Issue',
    text: 'Pro-level optimization was locked behind private Discord configs, expensive coaches, and sketchy downloads. Most players felt delay every fight — and had no trusted way to fix it.',
  },
  {
    icon: Target,
    header: 'The Task',
    text: 'Make statistically proven, zero-delay performance one click away — on PC and console. No tech degree. No guesswork. Leave delay blank.',
  },
  {
    icon: CheckCircle2,
    header: 'The Payoff',
    text: 'Built for competitive players who want zero input lag, higher FPS, and lower ping — with safe, reversible system tweaks.',
  },
]

function GamesPanel({ active }) {
  const style = usePanel([0.898, 0.908, 0.922, 0.934], 70)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section
      style={style}
      className="absolute inset-0 flex items-end justify-center px-4 pt-20 pb-8 md:px-8 md:pb-12"
      aria-label="Multiversal Compatibility"
    >
      <div className="w-full max-w-[1180px] text-center">
        <Eyebrow index="10" label="Engines" active={active} center />
        <h2 className="font-display stretch-wide text-halo mt-3 text-[7.4vw] leading-[0.86] font-black tracking-[-0.045em] uppercase md:text-[4.8vw]">
          <RevealLine i={0} active={active}>
            Multiversal
          </RevealLine>
          <RevealLine i={1} active={active} className="text-outline">
            Compatibility
          </RevealLine>
        </h2>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={state}
          custom={2}
          className="mx-auto mt-4 max-w-3xl text-[13px] leading-relaxed text-white/60 md:text-[16px]"
        >
          Universal engine integration. Sub-millisecond kernel execution across Fortnite, GTA 5, Minecraft, COD Warzone, Apex Legends, Rocket League, and CS2.
        </motion.p>
      </div>
    </motion.section>
  )
}

function AboutPanel({ active }) {
  const style = usePanel([0.946, 0.956, 0.968, 0.978], 60)
  const state = active ? 'show' : 'hidden'
  return (
    <motion.section style={style} className="absolute inset-0 flex items-end px-4 pt-14 pb-2 md:px-8 md:pt-20 md:pb-8" aria-label="About Blank Delay">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col">
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={0} className="mx-auto max-w-3xl text-center">
          <Eyebrow index="11" label="Founder" active={active} center />
          <h2 className="font-display stretch-wide text-halo mt-2 text-[7vw] leading-[0.88] font-black tracking-[-0.045em] uppercase md:mt-3 md:text-[3.4vw]">
            About Blank Delay
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-white/70 md:mt-3 md:text-[16px]">
            Hi, I'm Blank — owner of Blank Delay. Content creator and marketing specialist.
          </p>
        </motion.div>
        <div className="mt-3 grid gap-2 md:mt-6 md:grid-cols-3 md:gap-4">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <motion.article
                key={pillar.header}
                variants={fadeUp}
                initial="hidden"
                animate={state}
                custom={i + 1}
                className="pointer-events-auto rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md md:p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/40 text-white">
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <h3 className="font-display text-[16px] font-bold tracking-tight text-white md:text-[18px]">{pillar.header}</h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-snug text-white/65 md:mt-3 md:text-[14px] md:leading-relaxed">{pillar.text}</p>
              </motion.article>
            )
          })}
        </div>
        <motion.div variants={fadeUp} initial="hidden" animate={state} custom={5} className="mt-3 text-center md:mt-5">
          <p className="inline-flex max-w-full rounded-full border border-white/20 bg-white px-4 py-2 text-center text-[10px] font-semibold tracking-[0.08em] text-black uppercase shadow-[0_0_32px_rgba(255,255,255,0.45)] md:px-5 md:text-[11px] md:tracking-[0.14em]">
            Competitive Integrity Pledge — 100% Anti-Cheat Safe & Reversible
          </p>
          <p className="mt-2 font-mono text-[9px] tracking-[0.14em] text-white/50 uppercase md:mt-3 md:text-[11px] md:tracking-[0.22em]">
            All tweaks, macros, and website developed by Nouzen Studios
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}

function Hud({ active, booted }) {
  const percent = useTransform(scrollProgress, (v) => `${(v * 100).toFixed(1).padStart(5, '0')}%`)
  const section = SECTIONS[active]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: booted ? 1 : 0 }}
      transition={{ duration: 1.2, delay: 0.8 }}
      className="pointer-events-none absolute inset-0 hidden lg:block"
    >
      <div className="absolute top-1/2 left-7 flex -translate-y-1/2 -rotate-90 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 origin-left">
        <span className="text-white">{section.index}</span>
        <span className="h-px w-8 bg-white/30" />
        {section.label}
      </div>
      <div className="absolute top-1/2 right-7 flex -translate-y-1/2 flex-col items-end gap-3">
        {SECTIONS.map((s, i) => (
          <span
            key={s.id}
            className={`block h-px transition-all duration-500 ${i === active ? 'w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]' : 'w-4 bg-white/30'}`}
          />
        ))}
        <motion.span className="mt-2 font-mono text-[10px] tracking-[0.2em] text-white/50 tabular-nums">{percent}</motion.span>
      </div>
    </motion.div>
  )
}

function ScreenFlash() {
  const opacity = useTransform(scrollProgress, [0.703, 0.706, 0.71, 0.714], [0, 1, 0.28, 0])
  return <motion.div style={{ opacity }} className="pointer-events-none absolute inset-0 z-30 bg-white" aria-hidden />
}

export default function UIOverlay({ active, booted, onNavigate }) {
  const { isTheaterOpen, isCheckoutOpen } = useCheckout()
  const hidden = isTheaterOpen || isCheckoutOpen
  return (
    <div className={`pointer-events-none fixed inset-0 z-20 select-none transition-opacity duration-500 ${hidden ? 'opacity-0' : ''}`}>
      <HeroPanel booted={booted} onNavigate={onNavigate} />
      <AffiliatePanel active={booted && active === 1} />
      <SocialsPanel active={booted && active === 2} />
      <ControllerPanel active={booted && active === 3} />
      <DeskPanel active={booted && active === 4} />
      <KernelPanel active={booted && active === 5} />
      <FpsPanel active={booted && active === 6} />
      <UtilityPanel active={booted && active === 7} />
      <AimPanel active={booted && active === 8} />
      <GamesPanel active={booted && active === 9} />
      <AboutPanel active={booted && active === 10} />
      <ProductsPanel active={booted && active === 11} />
      <ScreenFlash />
      <Hud active={active} booted={booted} />
    </div>
  )
}
