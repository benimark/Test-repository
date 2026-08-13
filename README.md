# Test-repository
Hepertyő CLI testing

## Singularity

Egy React felület (Vite + Tailwind CSS v4 + shadcn/ui) és egy Express API egyetlen
repóban. Az egyetlen oldal egy feketelyuk-designos üdvözlő képernyő, amely élőben mutatja,
hogy a backend válaszol-e.

### Felépítés

```
client/            React SPA (Vite root)
  src/components/  a jelenet (starfield, black-hole) és a shadcn/ui komponensek
  src/hooks/       use-health: az /api/health lekérdezése
server/src/        Express app (app.ts) és a bootstrap (index.ts)
```

### Parancsok

| Parancs             | Mit csinál                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `npm install`       | függőségek telepítése                                              |
| `npm run dev`       | Vite (`:5173`) és Express (`:3001`) együtt, `/api` proxyval        |
| `npm test`          | Vitest — kliens (jsdom) és szerver (node) projekt                  |
| `npm run typecheck` | TypeScript ellenőrzés mindhárom tsconfigra                         |
| `npm run build`     | a kliens buildje a `dist/client` könyvtárba                        |
| `npm start`         | production szerver, amely az API mellett a buildelt SPA-t is adja  |

Az API port a `PORT` környezeti változóval állítható (alapértelmezés: `3001`).
