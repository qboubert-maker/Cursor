import { useMemo } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { PRODUCTS } from '../lib/content'
import { EASE_EXPO } from '../lib/rig'

const REST_SHADOW = '0 0 0 0px rgba(255,255,255,0), 0 0 0px rgba(255,255,255,0), inset 0 0 0px rgba(255,255,255,0)'
const HOT_SHADOW = '0 0 0 1px rgba(255,255,255,0.55), 0 0 60px rgba(255,255,255,0.18), inset 0 0 48px rgba(255,255,255,0.06)'

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 48, scale: 0.97, borderColor: 'rgba(255,255,255,0.1)', boxShadow: REST_SHADOW },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    boxShadow: REST_SHADOW,
    transition: { duration: 1, ease: EASE_EXPO },
  },
  hover: {
    scale: 1.025,
    borderColor: 'rgba(255,255,255,0.95)',
    boxShadow: HOT_SHADOW,
    transition: { type: 'spring', stiffness: 320, damping: 24 },
  },
}

const glowVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 0 },
  hover: { opacity: 1, transition: { duration: 0.45 } },
}

function FpsVisual({ active }) {
  const { stock, tuned } = useMemo(() => {
    const pts = 48
    const stockPts = []
    const tunedPts = []
    for (let i = 0; i < pts; i++) {
      const x = (i / (pts - 1)) * 400
      const spike = i % 9 === 4 ? 34 : i % 13 === 7 ? 26 : 0
      const jitter = Math.sin(i * 1.7) * 9 + Math.sin(i * 0.63) * 6 + spike
      stockPts.push(`${x.toFixed(1)},${(78 - jitter).toFixed(1)}`)
      tunedPts.push(`${x.toFixed(1)},${(36 + Math.sin(i * 0.5) * 1.6).toFixed(1)}`)
    }
    return { stock: `M${stockPts.join(' L')}`, tuned: `M${tunedPts.join(' L')}` }
  }, [])

  return (
    <div className="relative mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
        <span>Frame pacing</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-white/40" /> Stock
          </span>
          <span className="flex items-center gap-1.5 text-white">
            <span className="h-px w-4 bg-white" /> Blank Delay
          </span>
        </span>
      </div>
      <svg viewBox="0 0 400 110" className="h-28 w-full overflow-visible" preserveAspectRatio="none">
        {[22, 55, 88].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        <motion.path
          d={stock}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: active ? 1 : 0 }}
          transition={{ duration: 1.6, delay: active ? 0.4 : 0, ease: EASE_EXPO }}
        />
        <motion.path
          d={tuned}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))' }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: active ? 1 : 0 }}
          transition={{ duration: 1.8, delay: active ? 0.7 : 0, ease: EASE_EXPO }}
        />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
        <div>
          <div className="text-white">Stable</div>Frametime
        </div>
        <div>
          <div className="text-white">Unparked</div>CPU cores
        </div>
        <div>
          <div className="text-white">Purged</div>Bloat
        </div>
      </div>
    </div>
  )
}

function PollingVisual({ active }) {
  const bars = 28
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex h-14 items-end gap-[3px]">
        {Array.from({ length: bars }, (_, i) => (
          <motion.span
            key={i}
            className="w-full origin-bottom rounded-[2px] bg-white"
            style={{ height: '100%' }}
            initial={{ scaleY: 0.15, opacity: 0.3 }}
            animate={
              active
                ? { scaleY: [0.15, 1, 0.3, 0.85, 0.15], opacity: [0.3, 1, 0.5, 0.9, 0.3] }
                : { scaleY: 0.15, opacity: 0.3 }
            }
            transition={
              active ? { duration: 1.1, repeat: Infinity, delay: i * 0.035, ease: 'easeInOut' } : { duration: 0.3 }
            }
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-white/40">125 Hz · 8 ms</span>
        <span className="text-white/40">→</span>
        <span className="text-white">1000 Hz · 1 ms</span>
      </div>
    </div>
  )
}

const KEYS = ['Q', 'E', 'R', 'F', 'SHIFT']

const KEY_IDLE = { backgroundColor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)' }

function KeysVisual({ active }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2">
        {KEYS.map((k, i) => (
          <motion.span
            key={k}
            className={`grid h-11 place-items-center rounded-lg border font-mono text-[11px] font-bold ${k.length > 1 ? 'flex-[1.8]' : 'flex-1'}`}
            initial={KEY_IDLE}
            animate={
              active
                ? {
                    backgroundColor: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0.02)'],
                    color: ['rgba(255,255,255,0.6)', 'rgba(0,0,0,1)', 'rgba(255,255,255,0.6)'],
                    borderColor: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0.15)'],
                  }
                : KEY_IDLE
            }
            transition={
              active
                ? { duration: 0.5, repeat: Infinity, repeatDelay: 1.6, delay: 0.6 + i * 0.12, ease: 'easeOut' }
                : { duration: 0.3 }
            }
          >
            {k}
          </motion.span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-white/40">5-key chain</span>
        <span className="text-white">&lt; 1 ms execution</span>
      </div>
    </div>
  )
}

const VISUALS = { fps: FpsVisual, polling: PollingVisual, keys: KeysVisual }

function BentoCard({ product, className, active, compact = false }) {
  const mx = useMotionValue(-600)
  const my = useMotionValue(-600)
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${mx}px ${my}px, rgba(255,255,255,0.16), transparent 55%)`
  const Icon = product.icon
  const Visual = VISUALS[product.visual]

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mx.set(e.clientX - rect.left)
    my.set(e.clientY - rect.top)
  }

  return (
    <motion.article
      variants={cardVariants}
      whileHover="hover"
      onMouseMove={onMove}
      className={`group pointer-events-auto relative flex min-h-0 flex-col overflow-hidden rounded-[28px] border bg-white/5 p-5 backdrop-blur-xl md:p-6 tall:md:p-7 ${className}`}
    >
      <motion.div aria-hidden variants={glowVariants} className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />
      <motion.div
        aria-hidden
        variants={glowVariants}
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.12] via-white/[0.03] to-transparent"
      />

      <div className="relative flex items-start justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.04] transition-colors duration-500 group-hover:border-white group-hover:bg-white group-hover:text-black">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-white/40">
          {product.index}
          <ArrowUpRight
            size={14}
            className="text-white/30 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
          />
        </div>
      </div>

      <h3 className="font-display stretch-wide relative mt-4 text-[20px] leading-[1.02] font-extrabold uppercase tracking-[-0.01em] md:text-[24px] tall:md:mt-6 tall:md:text-[28px]">
        {product.title}
      </h3>
      <p className="relative mt-2 text-[14px] font-semibold text-white">{product.tagline}</p>
      <p
        className={`relative mt-2 hidden max-w-xl text-[13.5px] leading-relaxed text-white/55 ${compact ? 'tall:md:block' : 'md:block'}`}
      >
        {product.body}
      </p>

      <div className="relative hidden md:block">
        <Visual active={active} />
      </div>

      <div className={`relative mt-auto hidden flex-wrap gap-1.5 pt-4 ${compact ? 'tall:md:flex' : 'md:flex'}`}>
        {product.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/50"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.article>
  )
}

export default function BentoGrid({ active }) {
  const [fps, controller, keyboard] = PRODUCTS
  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}
      className="grid grid-cols-1 gap-3 md:h-full md:grid-cols-12 md:grid-rows-2 md:gap-4"
    >
      <BentoCard product={fps} active={active} className="md:col-span-7 md:row-span-2" />
      <BentoCard product={controller} active={active} compact className="md:col-span-5" />
      <BentoCard product={keyboard} active={active} compact className="md:col-span-5" />
    </motion.div>
  )
}
