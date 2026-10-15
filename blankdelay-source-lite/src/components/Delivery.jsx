import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { useCheckout } from '../context/CheckoutContext'
import { DISCORD_URL } from '../lib/content'
import { LOGO_URL } from '../lib/rig'
import { pauseSmoothScroll, resumeSmoothScroll } from '../lib/smoothScroll'
import DiscordIcon from './icons/DiscordIcon'

export default function Delivery() {
  const { isCheckoutOpen, selectedProduct, sessionId, closeCheckout } = useCheckout()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isCheckoutOpen) return undefined
    pauseSmoothScroll()
    const onKey = (event) => {
      if (event.key === 'Escape') closeCheckout()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      resumeSmoothScroll()
    }
  }, [isCheckoutOpen, closeCheckout])

  const download = async () => {
    if (!selectedProduct || !sessionId || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/download?session_id=${encodeURIComponent(sessionId)}&product=${encodeURIComponent(selectedProduct.id)}`,
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'The download could not start.')
      }
      const link = document.createElement('a')
      link.href = data.url
      link.target = '_blank'
      link.rel = 'noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError(err.message || 'The download could not start.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {isCheckoutOpen && selectedProduct && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center bg-transparent p-6 md:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-title"
        >
          <button
            type="button"
            onClick={closeCheckout}
            aria-label="Close"
            className="absolute top-6 right-6 grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/40 text-white/80 backdrop-blur-md transition-colors hover:bg-white hover:text-black"
          >
            <X size={18} />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative isolate w-full max-w-[820px] overflow-hidden rounded-[40px] border border-white/25 bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_50px_140px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          >
            <div className="flex flex-col items-center px-8 pt-10 pb-8 md:px-14">
              <span className="relative block h-16 w-[5.5rem] overflow-hidden" aria-hidden="true">
                <img
                  src={LOGO_URL}
                  alt=""
                  className="pointer-events-none absolute top-1/2 left-1/2 h-[9.5rem] w-[9.5rem] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
                />
              </span>
              <p className="font-display stretch-wide mt-3 text-[13px] font-black tracking-[0.22em] text-white">BLANK DELAY</p>
            </div>

            <div className="flex flex-col items-center border-t border-white/15 px-8 py-10 text-center md:px-16 md:py-12">
              <p className="font-mono text-[11px] tracking-[0.34em] text-white/45 uppercase">Payment complete</p>
              <h2
                id="delivery-title"
                className="font-display stretch-wide mt-4 max-w-[14ch] text-[42px] leading-[0.86] font-black tracking-[-0.045em] uppercase md:text-[68px]"
              >
                {selectedProduct.name}
              </h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/60">Yours. Download it straight to this device.</p>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/70">
                For your license key, join Discord, make a support ticket, and have visual proof of purchase ready. Enjoy Blank Delay.
              </p>
              <button
                type="button"
                onClick={download}
                disabled={busy}
                className="mt-9 inline-flex min-h-[76px] w-[min(100%,340px)] items-center justify-center gap-4 rounded-full bg-white px-8 text-black shadow-[0_0_0_8px_rgba(255,255,255,0.16),0_0_72px_rgba(255,255,255,0.9)] transition-transform duration-300 hover:scale-[1.03] disabled:opacity-70 sm:min-h-[88px] sm:px-12"
              >
                <Download size={22} strokeWidth={2.4} />
                <span className="text-[20px] font-black tracking-[0.18em] uppercase">{busy ? 'Downloading' : 'Download now'}</span>
              </button>
              {error ? <p className="mt-4 text-[13px] text-white/70">{error}</p> : null}
            </div>

            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 border-t border-white/15 bg-black/30 px-8 py-5 text-[14px] text-white/60 transition-colors hover:text-white"
            >
              <span>If help is needed, join the Discord</span>
              <DiscordIcon className="h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
