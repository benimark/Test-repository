import { cn } from '@/lib/utils'

/**
 * The tilted ring of glowing matter, drawn twice: once behind the sphere and once in front.
 *
 * The perspective rides in the transform rather than on the shared parent, because the
 * near copy is drawn inside a `mask-image` wrapper and a mask forces `transform-style:
 * flat`. A parent `perspective` would reach the far copy and be flattened away before the
 * near one, tilting the two halves into different ellipses instead of one ring.
 */
function AccretionDisk() {
  return (
    <div className="absolute inset-0 [transform:perspective(1400px)_rotateX(74deg)]">
      <div className="animate-accretion motion-reduce:animate-none absolute inset-0 rounded-full opacity-90 blur-md [background:conic-gradient(from_0deg,transparent_0deg,#a855f7_40deg,#ffb347_120deg,#ffffff_168deg,#ffb347_210deg,#38bdf8_290deg,transparent_360deg)] [mask-image:radial-gradient(circle,transparent_33%,#000_40%,#000_66%,transparent_76%)]" />
      <div className="animate-accretion-slow motion-reduce:animate-none absolute inset-[7%] rounded-full opacity-70 blur-xl [background:conic-gradient(from_180deg,transparent_0deg,#ffb347_90deg,#ffffff_150deg,#a855f7_255deg,transparent_360deg)] [mask-image:radial-gradient(circle,transparent_36%,#000_45%,#000_70%,transparent_82%)]" />
    </div>
  )
}

/**
 * Purely decorative CSS black hole: a tilted accretion disk around a lensed photon
 * ring and a pitch black event horizon. No canvas, no images — just a handful of
 * composited animations.
 */
export function BlackHole({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Sunk below the fold so the disk rises from the bottom edge and leaves the copy clear. */}
      <div className="absolute top-[88%] left-1/2 aspect-square w-[min(165vmin,1180px)] -translate-x-1/2 -translate-y-1/2">
        {/* Gravitational glow bleeding out past the disk. */}
        <div className="animate-halo motion-reduce:animate-none absolute inset-[20%] rounded-full bg-[radial-gradient(circle,rgba(255,179,71,0.42)_0%,rgba(168,85,247,0.22)_45%,transparent_70%)] blur-3xl" />

        {/* Far side of the disk, passing behind the sphere. */}
        <AccretionDisk />

        {/* The horizon itself, with the light that orbits around it. */}
        <div className="absolute top-1/2 left-1/2 aspect-square w-[23%] -translate-x-1/2 -translate-y-1/2">
          {/* Lensed ring: disk light bent around the sphere, so it stays a full circle. */}
          <div className="absolute -inset-[15%] rounded-full border border-amber-100/80 shadow-[0_0_70px_rgba(255,196,124,0.7),inset_0_0_40px_rgba(255,196,124,0.45)]" />
          {/* Photon ring. */}
          <div className="animate-accretion motion-reduce:animate-none absolute -inset-[2.5%] rounded-full bg-[conic-gradient(from_90deg,#ffd7a1,#ffffff,#ffb347,#ffffff,#ffd7a1)] blur-[3px]" />
          {/* Event horizon. */}
          <div className="absolute inset-0 rounded-full bg-black shadow-[0_0_90px_36px_rgba(0,0,0,0.95)]" />
        </div>

        {/* Near side of the disk, faded in over the half that occludes the sphere. */}
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_47%,#000_56%)]">
          <AccretionDisk />
        </div>
      </div>
    </div>
  )
}
