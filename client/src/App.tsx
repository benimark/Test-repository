import { ArrowUpRight, Sparkles } from 'lucide-react'

import { BlackHole } from '@/components/black-hole'
import { Starfield } from '@/components/starfield'
import { SystemStatus } from '@/components/system-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useHealth } from '@/hooks/use-health'

const REPOSITORY_URL = 'https://github.com/benimark/Test-repository'

export default function App() {
  const health = useHealth()

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#04040a]">
      <Starfield />
      <BlackHole />
      {/* Vignette that pushes the corners into the dark and keeps the copy readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(4,4,10,0.85)_100%)]"
      />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 pt-24 pb-[34vh] text-center">
        <Badge
          variant="outline"
          className="animate-rise motion-reduce:animate-none max-w-full border-white/15 bg-white/5 px-3 py-1 text-[0.7rem] tracking-[0.16em] whitespace-normal uppercase backdrop-blur-sm"
        >
          {/* The icon sits inside the label rather than beside it as a flex item, so
              that when the text breaks onto a second line on narrow viewports both
              lines stay centred instead of the icon being pushed to the far edge. */}
          <span>
            <Sparkles aria-hidden="true" className="mr-1 inline size-3 align-[-0.125em]" />
            React · Tailwind · shadcn/ui · Express
          </span>
        </Badge>

        {/* `hyphens-auto` keeps "eseményhorizonton" from overflowing narrow viewports. */}
        <h1 className="animate-rise motion-reduce:animate-none hyphens-auto text-4xl font-semibold tracking-tight text-balance [animation-delay:100ms] sm:text-6xl lg:text-7xl">
          Üdvözlünk az{' '}
          <span className="from-primary via-foreground to-accent bg-gradient-to-r bg-clip-text text-transparent">
            eseményhorizonton
          </span>
        </h1>

        <p className="animate-rise motion-reduce:animate-none text-muted-foreground max-w-xl text-base text-pretty [animation-delay:200ms] sm:text-lg">
          Vite-tal hajtott React felület shadcn/ui komponensekkel, mögötte egy karcsú Express
          API. Ez a projekt gravitációs középpontja — innen indul minden további funkció.
        </p>

        <div className="animate-rise motion-reduce:animate-none flex flex-wrap items-center justify-center gap-3 [animation-delay:300ms]">
          <Button asChild size="lg">
            <a href="/api/health">
              API állapot
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            {/* The new tab has to be part of the accessible name: no screen reader
                announces `target="_blank"` on its own, so otherwise the user lands in a
                tab that Back cannot leave without ever being told they moved. The visible
                label stays the first words of it, so speech control still matches it. */}
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Forráskód (új lapon nyílik meg)"
            >
              Forráskód
            </a>
          </Button>
        </div>

        <div className="animate-rise motion-reduce:animate-none w-full [animation-delay:400ms]">
          <SystemStatus health={health} />
        </div>
      </main>
    </div>
  )
}
