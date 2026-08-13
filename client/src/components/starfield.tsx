import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

const STAR_COUNT = 160
const STAR_SEED = 0x5eed

/** Deterministic PRNG so the sky is identical on every render, reload and test run. */
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STARS = (() => {
  const random = mulberry32(STAR_SEED)

  return Array.from({ length: STAR_COUNT }, () => ({
    top: random() * 100,
    left: random() * 100,
    size: 0.6 + random() * 1.8,
    opacity: 0.2 + random() * 0.6,
    delay: random() * 6,
    duration: 3 + random() * 5,
  }))
})()

export function Starfield({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      {STARS.map((star, index) => (
        <span
          key={index}
          className="animate-twinkle motion-reduce:animate-none absolute rounded-full bg-white"
          style={
            {
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              // The twinkle keyframes animate `opacity`, and an animation outranks the
              // inline style attribute — so the brightness has to reach them through a
              // custom property. The plain `opacity` below is what remains once
              // `motion-reduce` switches the animation off.
              '--star-opacity': star.opacity,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
