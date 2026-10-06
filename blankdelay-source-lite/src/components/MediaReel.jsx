import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MediaReel({ slides, onEmpty }) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState({})
  const drag = useRef(null)
  const videoRef = useRef(null)

  const available = slides.filter((slide) => !hidden[slide.src])
  const count = available.length
  const safeIndex = count ? Math.min(index, count - 1) : 0
  const slide = available[safeIndex]

  useEffect(() => {
    setIndex(0)
    setHidden({})
  }, [slides])

  useEffect(() => {
    if (slides.length && slides.every((slide) => hidden[slide.src])) onEmpty?.()
  }, [hidden, slides, onEmpty])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    if (slide?.type === 'video') {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
    return undefined
  }, [slide])

  if (!slide) return null

  const go = (next) => {
    if (count < 2) return
    setIndex((current) => {
      const bounded = Math.min(current, count - 1)
      return (bounded + next + count) % count
    })
  }

  const onPointerDown = (event) => {
    drag.current = { x: event.clientX, id: event.pointerId }
  }

  const onPointerUp = (event) => {
    if (!drag.current) return
    const delta = event.clientX - drag.current.x
    drag.current = null
    if (delta < -48) go(1)
    else if (delta > 48) go(-1)
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" data-lenis-prevent>
      <div
        className="relative flex min-h-0 w-full flex-1 touch-pan-y items-center justify-center [container-type:size]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <div className="relative">
          {slide.type === 'video' ? (
            <video
              ref={videoRef}
              key={slide.src}
              src={slide.src}
              controls
              playsInline
              preload="none"
              className="block aspect-video h-auto w-[min(100cqw,calc(100cqh*16/9))] max-w-full rounded-2xl"
              onError={() => setHidden((current) => ({ ...current, [slide.src]: true }))}
            />
          ) : (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt || ''}
              draggable={false}
              className="block h-auto max-h-[100cqh] w-auto max-w-[100cqw] rounded-2xl object-contain select-none"
              onError={() => setHidden((current) => ({ ...current, [slide.src]: true }))}
            />
          )}
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/75 text-white"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => go(1)}
                className="absolute top-1/2 right-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/75 text-white"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {available.map((item, dot) => (
            <button
              key={item.src}
              type="button"
              aria-label={item.type === 'video' ? 'Video' : `Image ${dot + 1}`}
              onClick={() => setIndex(dot)}
              className={`h-1.5 rounded-full transition-all ${dot === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
