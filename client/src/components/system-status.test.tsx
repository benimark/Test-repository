import { render } from '@testing-library/react'
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
})
