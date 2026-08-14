import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SystemStatus } from '@/components/system-status'
import type { HealthState } from '@/hooks/use-health'

const STATES: HealthState[] = [
  { status: 'loading' },
  { status: 'online', uptime: 90 },
  { status: 'offline' },
]

describe('SystemStatus', () => {
  it.each(STATES)('holds still in the $status state when motion is reduced', (health) => {
    const { container } = render(<SystemStatus health={health} />)

    const animated = Array.from(container.querySelectorAll('[class*="animate-"]'))

    for (const element of animated) {
      expect(element.className).toContain('motion-reduce:animate-none')
    }
  })

  // The unit the panel prints has to agree with the threshold that picked it: the
  // seconds branch only runs below a minute, so it must never round up to "60 mp".
  it.each([
    [12, '12 mp'],
    [59.6, '59 mp'],
    [90, '1 perc'],
    [7200, '2 óra'],
  ])('prints an uptime of %d seconds as "%s"', (uptime, expected) => {
    render(<SystemStatus health={{ status: 'online', uptime }} />)

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
