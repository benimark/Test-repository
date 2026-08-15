import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BlackHole } from '@/components/black-hole'

/** The tilted disk is drawn twice: once behind the sphere and once in front of it. */
function renderDiskHalves() {
  const { container } = render(<BlackHole />)

  return {
    container,
    halves: Array.from(container.querySelectorAll<HTMLElement>('[class*="rotateX("]')),
  }
}

describe('BlackHole', () => {
  it('draws the accretion disk as two identically projected halves', () => {
    const { halves } = renderDiskHalves()

    expect(halves).toHaveLength(2)
    expect(new Set(halves.map((half) => half.className)).size).toBe(1)
  })

  // The near half is drawn inside a `mask-image` wrapper, and a mask forces
  // `transform-style: flat` on the element carrying it. A `perspective` property on a
  // shared ancestor therefore reaches the far half — a direct child — but is flattened
  // away before it reaches the near one, so the two halves end up with different
  // projections. Measured in Chrome at the scene's own size: the far half spans 1983px
  // and the near half 1180px, their bottom edges 111px apart. That is not one ring
  // passing in front of the sphere, it is two mismatched ellipses. The perspective has
  // to travel in each half's own transform, where no ancestor can drop it.
  it('gives each half a perspective that no ancestor can flatten', () => {
    const { container, halves } = renderDiskHalves()

    for (const half of halves) {
      expect(half.className).toMatch(/\[transform:perspective\(\d+px\)_rotateX\(/)
    }

    expect(container.querySelector('[class*="perspective:"]')).toBeNull()
  })
})
