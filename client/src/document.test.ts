import { describe, expect, it } from 'vitest'

import documentHtml from '../index.html?raw'

/**
 * The document and the public directory are pulled in through Vite rather than read off
 * disk: this project types itself against `vite/client` alone, so a client test that
 * reached for `node:fs` would be one that cannot typecheck.
 */
const iconLink = new DOMParser()
  .parseFromString(documentHtml, 'text/html')
  .querySelector('link[rel="icon"]')

/** Everything Vite copies verbatim into the build root, keyed by its path under `client/`. */
const publicFiles = import.meta.glob('../public/**/*')

/**
 * `client/index.html` is the document Vite builds around, and it sits above `src/` where no
 * component test reaches it. The chrome it carries is guarded here instead.
 */
describe('the HTML document', () => {
  // A document that names no icon does not leave the tab alone: the browser then asks for
  // `/favicon.ico`, which nothing in the build produces. Every visit spends a request on a
  // 404 and the tab keeps the browser's blank placeholder — the one surface the black hole
  // never reaches, on a page whose whole job is how it looks.
  it('names an icon so no browser falls back to /favicon.ico', () => {
    expect(iconLink?.getAttribute('href')).toBe('/favicon.svg')
    expect(iconLink?.getAttribute('type')).toBe('image/svg+xml')
  })

  // Vite copies `client/public` verbatim into the build root, so the href above only
  // resolves for as long as a file really sits behind that exact name.
  it('ships the icon it names', () => {
    expect(Object.keys(publicFiles)).toContain(`../public${iconLink?.getAttribute('href')}`)
  })
})
