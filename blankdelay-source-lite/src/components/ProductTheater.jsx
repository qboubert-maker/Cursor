import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, X } from 'lucide-react'
import { useCheckout } from '../context/CheckoutContext'
import { CHECKOUT_PRODUCTS, formatPrice } from '../lib/checkoutCatalog'
import { DISCORD_URL } from '../lib/content'
import { SECTIONS } from '../lib/rig'
import { pauseSmoothScroll, resumeSmoothScroll } from '../lib/smoothScroll'
import DiscordIcon from './icons/DiscordIcon'
import MediaReel from './MediaReel'
import { CONTROLLER_SLIDES } from '../lib/controllerSlides'
import { KEYBOARD_SLIDES } from '../lib/keyboardSlides'
import { FPS_SLIDES } from '../lib/fpsSlides'
import { ZERO_DELAY_SLIDES } from '../lib/zeroDelaySlides'
import { PREMIUM_SLIDES } from '../lib/premiumSlides'

const PRODUCT_SLIDES = {
  'controller-macro': CONTROLLER_SLIDES,
  'keyboard-macro': KEYBOARD_SLIDES,
  'fps-boost': FPS_SLIDES,
  'zero-delay-os': ZERO_DELAY_SLIDES,
  'premium-utility': PREMIUM_SLIDES,
}

const DEMOS = [
  { productId: 'controller-macro', sectionId: 'controllers', line: 'Polling override, live on PS5 and Xbox.' },
  { productId: 'keyboard-macro', sectionId: 'desk', line: 'Sub-millisecond chains on your keyboard and mouse.' },
  { productId: 'zero-delay-os', sectionId: 'kernel', line: 'The OS app opening the kernel path.' },
  { productId: 'fps-boost', sectionId: 'fps', line: 'Frame pacing across both processors.' },
  { productId: 'premium-utility', sectionId: 'utility', line: 'The Premium app: games, optimization lanes, and debloat.' },
  { productId: 'aim-bundle', sectionId: 'aim', line: 'The crosshair locking to the cursor.' },
]

export default function ProductTheater() {
  const { isTheaterOpen, theaterProductId, closeTheater, watchDemonstration, openCheckout } = useCheckout()
  const activeId = theaterProductId && CHECKOUT_PRODUCTS[theaterProductId] ? theaterProductId : DEMOS[0].productId
  const demo = DEMOS.find((item) => item.productId === activeId) || DEMOS[0]
  const product = CHECKOUT_PRODUCTS[demo.productId]

  useEffect(() => {
    if (!isTheaterOpen) return undefined
    pauseSmoothScroll()
    const onKey = (event) => {
      if (event.key === 'Escape') closeTheater()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      resumeSmoothScroll()
    }
  }, [isTheaterOpen, closeTheater])

  const [slidesReady, setSlidesReady] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [buyError, setBuyError] = useState('')
  const slides = PRODUCT_SLIDES[demo.productId]

  useEffect(() => {
    setSlidesReady(true)
  }, [demo.productId])

  useEffect(() => {
    if (!isTheaterOpen) return
    setLeaving(false)
    setBuyError('')
  }, [isTheaterOpen])

  const play = () => {
    const index = SECTIONS.findIndex((section) => section.id === demo.sectionId)
    if (index >= 0) watchDemonstration(index)
  }

  return (
    <AnimatePresence>
      {isTheaterOpen && product && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[75] flex items-center justify-center bg-transparent p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Product demonstrations"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-[min(90vh,960px)] w-[min(96vw,1500px,max(920px,calc((90vh-248px)*16/9)))] max-w-[1500px] flex-col overflow-hidden rounded-[36px] border border-white/25 bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <header className="flex shrink-0 items-end justify-between px-7 pt-5 pb-4 md:px-8">
              <div>
                <p className="font-mono text-[11px] tracking-[0.34em] text-white/45 uppercase">Demonstration</p>
                <h2 className="font-display stretch-wide mt-2 text-[28px] leading-none font-black tracking-[-0.045em] uppercase md:text-[36px]">See what you're buying</h2>
              </div>
              <button
                type="button"
                onClick={closeTheater}
                aria-label="Close demonstrations"
                className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/5 text-white/70 transition-colors hover:border-white hover:bg-white hover:text-black"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col border-t border-white/15 px-6 pt-6 pb-4 md:px-8 md:pt-7">
              {slides && slidesReady ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <MediaReel key={demo.productId} slides={slides} onEmpty={() => setSlidesReady(false)} />
                  <p className="mt-3 shrink-0 font-mono text-[11px] tracking-[0.2em] text-white/45 uppercase">
                    {slides.some((slide) => slide.type === 'video') ? 'Slide through the product, then the video.' : 'Slide through the product.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={play}
                  className="group relative flex min-h-[320px] flex-1 flex-col justify-between overflow-hidden rounded-[28px] border border-white/15 bg-black/35 p-6 text-left md:min-h-[520px] md:p-8"
                >
                  <div className="flex justify-end font-mono text-[11px] tracking-[0.26em] text-white/45 uppercase">
                    <span>{product.badge}</span>
                  </div>
                  <span className="absolute top-1/2 left-1/2 grid h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-white text-black shadow-[0_0_48px_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover:scale-105">
                    <Play size={28} fill="currentColor" className="translate-x-0.5" />
                  </span>
                  <div className="relative">
                    <p className="font-display stretch-wide max-w-[12ch] text-[36px] leading-[0.88] font-black tracking-[-0.045em] uppercase md:text-[52px]">{product.name}</p>
                    <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/60">{demo.line}</p>
                  </div>
                </button>
              )}
            </div>

            <footer className="grid shrink-0 grid-cols-1 items-center gap-4 border-t border-white/15 bg-black/35 px-6 py-6 md:grid-cols-[1fr_auto_1fr] md:px-8">
              <div className="hidden md:block" aria-hidden="true" />
              <button
                type="button"
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true)
                  setBuyError('')
                  const result = await openCheckout(product)
                  if (!result?.ok) {
                    setLeaving(false)
                    setBuyError(result?.error || 'Stripe could not be opened.')
                  }
                }}
                className="inline-flex min-h-[76px] w-[min(100%,420px)] items-center justify-center gap-4 justify-self-center rounded-full bg-white px-8 text-black shadow-[0_0_0_8px_rgba(255,255,255,0.22),0_0_90px_rgba(255,255,255,1)] transition-transform duration-300 hover:scale-[1.04] sm:min-h-[92px] sm:gap-5 sm:px-12"
              >
                <span className="text-[16px] font-black tracking-[0.24em] uppercase">Buy now</span>
                <span className="text-[42px] leading-none font-black tracking-[-0.045em]">{formatPrice(product.price)}</span>
              </button>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-self-end gap-2 text-[14px] text-white/55 transition-colors hover:text-white"
              >
                <span>Need help?</span>
                <DiscordIcon className="h-4 w-4" />
                <span className="font-semibold text-white">Join Discord</span>
              </a>
            </footer>
            {buyError ? <p className="px-8 pb-5 text-center text-[13px] text-white/70">{buyError}</p> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
