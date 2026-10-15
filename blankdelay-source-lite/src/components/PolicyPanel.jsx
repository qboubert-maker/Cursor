import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { LOGO_URL } from '../lib/rig'
import { pauseSmoothScroll, resumeSmoothScroll } from '../lib/smoothScroll'

export default function PolicyPanel({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    pauseSmoothScroll()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      resumeSmoothScroll()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-h-[min(88vh,860px)] w-[min(96vw,760px)] flex-col overflow-hidden rounded-[28px] border border-white/20 bg-black/80 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4 md:px-8">
              <div className="flex items-center gap-4">
                <span className="relative block h-12 w-16 overflow-hidden" aria-hidden="true">
                  <img src={LOGO_URL} alt="" className="pointer-events-none absolute top-1/2 left-1/2 h-24 w-24 max-w-none -translate-x-1/2 -translate-y-1/2" />
                </span>
                <div>
                  <p className="font-mono text-[11px] tracking-[0.28em] text-white/45 uppercase">Blank Delay</p>
                  <h2 id="policy-title" className="font-display mt-1 text-[22px] leading-none font-black tracking-[-0.04em] uppercase md:text-[28px]">
                    No Refund Policy
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close policy"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-white/70 transition-colors hover:bg-white hover:text-black"
              >
                <X size={16} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 text-[14px] leading-relaxed text-white/75 md:px-8 md:text-[15px]" data-lenis-prevent>
              <p className="font-mono text-[11px] tracking-[0.18em] text-white/40 uppercase">Last updated: October 13, 2026</p>
              <p className="mt-4">
                At Blank Delay, we appreciate every customer who chooses to support our company. We are committed to providing quality PC optimizations, performance-enhancing tools, and macros designed to improve your overall experience.
              </p>
              <p className="mt-3">
                Because our products are delivered digitally, all purchases are final, and refunds are generally not offered once a purchase has been completed and the digital product has been delivered or accessed.
              </p>
              <h3 className="font-display mt-6 text-[16px] font-black tracking-[-0.03em] text-white uppercase">Why are refunds not available?</h3>
              <p className="mt-2">
                Our PC optimizations and macros are digital products that can be delivered, downloaded, accessed, or used immediately after purchase. Unlike physical products, digital products cannot be returned once they have been delivered or accessed.
              </p>
              <p className="mt-3">
                To protect our work, intellectual property, and the time invested in developing and maintaining our products, we maintain a no-refund policy for completed digital purchases.
              </p>
              <h3 className="font-display mt-6 text-[16px] font-black tracking-[-0.03em] text-white uppercase">Please understand before purchasing</h3>
              <p className="mt-2">By purchasing from Blank Delay, you acknowledge and understand that:</p>
              <ul className="mt-3 space-y-2 pl-4">
                <li><span className="font-semibold text-white">All sales are final.</span> Please make sure you understand what you are purchasing before completing your order.</li>
                <li><span className="font-semibold text-white">Digital delivery.</span> Once your product has been delivered or access has been provided, the purchase is generally non-refundable.</li>
                <li><span className="font-semibold text-white">Compatibility.</span> Please review the product description and system requirements before purchasing to ensure the product is suitable for your PC and setup.</li>
                <li><span className="font-semibold text-white">Personal preferences.</span> Refunds are not generally provided because a customer changes their mind, no longer wants the product, or has different expectations after purchasing.</li>
                <li><span className="font-semibold text-white">Support.</span> If you experience an issue with a product, we encourage you to contact our support team. We will do our best to help troubleshoot the issue and assist you where possible.</li>
              </ul>
              <h3 className="font-display mt-6 text-[16px] font-black tracking-[-0.03em] text-white uppercase">Our commitment to you</h3>
              <p className="mt-2">
                We want every customer to have a positive experience with Blank Delay. Although we generally do not offer refunds for delivered digital products, we are always willing to listen to your concerns and help resolve legitimate technical issues whenever possible.
              </p>
              <p className="mt-3">
                This policy does not exclude any refund, remedy, or other right that may be required by applicable law. If a purchase qualifies for a refund under applicable law or our payment provider&apos;s requirements, we will handle the matter accordingly.
              </p>
              <h3 className="font-display mt-6 text-[16px] font-black tracking-[-0.03em] text-white uppercase">Contact support</h3>
              <p className="mt-2">
                If you have questions about a product or need technical assistance, please contact the Blank Delay support team before making assumptions about your purchase. We appreciate your understanding and support.
              </p>
              <p className="mt-5 font-semibold text-white">Thank you for choosing Blank Delay. We appreciate your trust in our products and our company.</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
