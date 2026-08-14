import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SystemStatus } from '@/components/system-status'
import type { HealthState } from '@/hooks/use-health'

const ANNOUNCEMENTS: [HealthState, string][] = [
  [{ status: 'loading' }, 'Kapcsolódás…'],
  [{ status: 'online', uptime: 90 }, 'Online'],
  [{ status: 'offline' }, 'Nem érhető el'],
]

const STATES = ANNOUNCEMENTS.map(([health]) => health)

describe('SystemStatus', () => {
  it.each(STATES)('holds still in the $status state when motion is reduced', (health) => {
    const { container } = render(<SystemStatus health={health} />)

    const animated = Array.from(container.querySelectorAll('[class*="animate-"]'))

    for (const element of animated) {
      expect(element.className).toContain('motion-reduce:animate-none')
    }
  })

  // The health check answers after the page has been read, so its result has to be
  // announced, not only painted — otherwise a screen reader user who has already passed
  // this tile is never told whether the backend replied.
  it.each(ANNOUNCEMENTS)('announces the $status state', (health, label) => {
    render(<SystemStatus health={health} />)

    expect(screen.getByRole('status')).toHaveTextContent(label)
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
