# Draw Karo 🎨

> Desi draw-and-guess party game — skribbl.io ka core, Desi Avatar Studio, Hinglish
> word packs, reactions, voice chat aur Funniest Drawing Award ke saath.
> **Strict ₹0** — see `IMPLEMENTATION_PLAN.md` §13.

Monorepo layout (npm workspaces):

```
apps/
  mobile/    Expo app (Android / iOS / Web) — Expo Router + Skia canvas
  server/    Node.js authoritative game server (Express + Socket.IO)
packages/
  shared/    TypeScript types, socket event contract, scoring logic
  words/     Desi word packs (Bollywood, Indian Food, Memes, ...)
```

## Play

| Where | Link |
|---|---|
| Web | <https://draw-karo-web.onrender.com> |
| Android APK | built with EAS — see [`docs/DEPLOY.md`](docs/DEPLOY.md) §3 |

The game server is on Render's free tier, so the first visit after ~15 minutes of
idle waits 30–60 s for a cold start. Rooms live in server memory: a restart ends
live games.

## Deploy your own (₹0)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/adnandev7/draw-karo-game)

The blueprint (`render.yaml`) creates two free services: the Socket.IO game
server and the static Expo web app. After Render asks for the `sync: false`
variables, set `EXPO_PUBLIC_GAME_SERVER` on **draw-karo-web** to your server's
URL. Full walkthrough, free-tier caveats and a smoke-test checklist live in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Local development (first time)

```bash
npm install            # installs all workspaces
npm run build:packages # compiles shared + words
npm run dev:server     # game server on http://localhost:4000 (GET /health)
npm run start:mobile   # Expo dev server (then press a / w or scan QR)
```

## Milestones

See `IMPLEMENTATION_PLAN.md` §10. M0 = this skeleton.
