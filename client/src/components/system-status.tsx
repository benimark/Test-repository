import { Activity } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import type { HealthState } from '@/hooks/use-health'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<HealthState['status'], string> = {
  loading: 'Kapcsolódás…',
  online: 'Online',
  offline: 'Nem érhető el',
}

const STATUS_DOTS: Record<HealthState['status'], string> = {
  loading: 'bg-muted-foreground animate-pulse motion-reduce:animate-none',
  online: 'bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]',
  offline: 'bg-destructive',
}

function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} mp`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} perc`
  }
  return `${Math.floor(seconds / 3600)} óra`
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 text-left">
      <span className="text-muted-foreground text-[0.7rem] tracking-[0.18em] uppercase">
        {label}
      </span>
      <span className="text-foreground text-sm font-medium">{children}</span>
    </div>
  )
}

/** Small telemetry panel proving that the React page really talks to the Express API. */
export function SystemStatus({ health }: { health: HealthState }) {
  return (
    <div className="grid w-full divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Tile label="Backend">
        <span className="inline-flex items-center gap-2">
          <span className={cn('size-2 rounded-full', STATUS_DOTS[health.status])} />
          {STATUS_LABELS[health.status]}
        </span>
      </Tile>
      <Tile label="Üzemidő">
        {health.status === 'online' ? formatUptime(health.uptime) : '—'}
      </Tile>
      <Tile label="Végpont">
        <Badge variant="outline" className="border-white/15 font-mono text-[0.7rem]">
          <Activity aria-hidden="true" />
          GET /api/health
        </Badge>
      </Tile>
    </div>
  )
}
