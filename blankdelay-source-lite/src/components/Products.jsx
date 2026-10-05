import { motion } from 'framer-motion'
import { Crosshair, Gamepad2, Keyboard, Layers, Zap } from 'lucide-react'
import { useCheckout } from '../context/CheckoutContext'
import { CHECKOUT_PRODUCTS, formatPrice } from '../lib/checkoutCatalog'
import { EASE_EXPO } from '../lib/rig'

const CATALOG = [
  {
    id: 'fps-boost',
    index: '01',
    icon: Zap,
    title: 'FPS Boost',
    price: formatPrice(CHECKOUT_PRODUCTS['fps-boost'].price),
    tagline: 'Kernel frame pacing for a locked, even delivery.',
    span: 'md:col-span-2',
  },
  {
    id: 'controller-macro',
    index: '02',
    icon: Gamepad2,
    title: 'Zero Delay Controller Macro',
    price: formatPrice(CHECKOUT_PRODUCTS['controller-macro'].price),
    tagline: 'Polling overrides and frame-perfect pad macros.',
    span: 'md:col-span-2',
  },
  {
    id: 'keyboard-macro',
    index: '03',
    icon: Keyboard,
    title: 'Keyboard Macro',
    price: formatPrice(CHECKOUT_PRODUCTS['keyboard-macro'].price),
    tagline: 'Sub-millisecond chains on a single keystroke.',
    span: 'md:col-span-2',
  },
  {
    id: 'aim-bundle',
    index: '04',
    icon: Crosshair,
    title: 'Aim Bundle',
    price: formatPrice(CHECKOUT_PRODUCTS['aim-bundle'].price),
    tagline: 'FPS Boost, controller, and keyboard on one license.',
    comingSoon: true,
    span: 'md:col-span-3',
  },
  {
    id: 'premium-utility',
    index: '05',
    icon: Layers,
    title: 'Premium Utility',
    price: formatPrice(CHECKOUT_PRODUCTS['premium-utility'].price),
    tagline: 'The full stack, private profiles, and early builds.',
    span: 'md:col-span-3',
  },
]

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_EXPO } },
}

function PurchaseCard({ product }) {
  const { openTheater } = useCheckout()
  const Icon = product.icon
  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -4, borderColor: 'rgba(255,255,255,0.95)' }}
      className={`pointer-events-auto group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_rgba(255,255,255,0)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_0_48px_rgba(255,255,255,0.16)] md:h-full md:min-h-0 md:p-5 ${product.span}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent opacity-80" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/15 bg-black/40">
          <Icon size={16} strokeWidth={1.75} />
        </span>
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/40">{product.index}</span>
      </div>
      <div className="relative mt-4">
        <h3 className="font-display stretch-wide text-[18px] leading-none font-black tracking-[-0.03em] uppercase md:text-[22px]">{product.title}</h3>
        <p className="mt-2 max-w-[36ch] text-[13px] leading-snug text-white/55">{product.tagline}</p>
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        {product.comingSoon ? (
          <span className="font-display stretch-semi text-[22px] font-black tracking-tight">Coming soon</span>
        ) : (
          <>
            <span className="font-display stretch-semi text-[22px] font-black tracking-tight">{product.price}</span>
            <button
              type="button"
              onClick={() => openTheater(CHECKOUT_PRODUCTS[product.id])}
              className="pointer-events-auto inline-flex items-center rounded-full bg-white px-4 py-2 text-[12px] font-semibold tracking-tight text-black transition-shadow duration-300 group-hover:shadow-[0_0_28px_rgba(255,255,255,0.65)]"
            >
              Purchase
            </button>
          </>
        )}
      </div>
    </motion.article>
  )
}

export default function Products({ active }) {
  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}
      className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-6 md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
    >
      {CATALOG.map((product) => (
        <PurchaseCard key={product.id} product={product} />
      ))}
    </motion.div>
  )
}
