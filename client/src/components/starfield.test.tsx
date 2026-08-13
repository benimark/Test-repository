import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Starfield } from '@/components/starfield'

function renderStars() {
  const { container } = render(<Starfield />)
  return Array.from(container.querySelectorAll<HTMLElement>('span'))
}

describe('Starfield', () => {
  it('exposes each star brightness to the twinkle keyframes', () => {
    const stars = renderStars()

    expect(stars.length).toBeGreaterThan(0)
    // A running CSS animation outranks the inline style attribute, so the keyframes
    // have to read the per-star brightness from this custom property. Setting only
    // `opacity` would leave every star pulsing through the exact same range.
    for (const star of stars) {
      expect(star.style.getPropertyValue('--star-opacity')).not.toBe('')
    }

    const brightnesses = new Set(stars.map((star) => star.style.getPropertyValue('--star-opacity')))
    expect(brightnesses.size).toBeGreaterThan(1)
  })

  it('still dims the stars when the animation is switched off', () => {
    for (const star of renderStars()) {
      expect(star.style.opacity).not.toBe('')
    }
  })
})
