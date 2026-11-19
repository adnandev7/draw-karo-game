# Deploying Draw Karo (₹0)

Two pieces, two free hosts — because they have different shapes:

| Piece | Host | Why |
|---|---|---|
| Game server (Node + Socket.IO) | **Render** free web service | Needs a long-lived process to hold WebSockets. Vercel functions cannot. |
| Web app (Expo static export) | **Vercel** free plan | Pure static files: fast CDN, no cold start, custom domain. |
| Android APK | EAS free tier (sideload via WhatsApp) | No Play Store fee. |

Voice chat (LiveKit) is not wired yet — the env slots exist but stay empty.

Deploy order matters: the server URL is compiled into the web bundle, so
**Render first, Vercel second**.

---

## 1. Push the repo to GitHub

```bash
git remote add origin https://github.com/<you>/draw-karo-game.git
git push -u origin master
```

## 2. Game server on Render

1. Render Dashboard → **New → Blueprint** → pick the repo.
2. Render reads `render.yaml` and creates **draw-karo-server** (free, Singapore).
3. Fill the `sync: false` variables — `LIVEKIT_*` stay empty for now.
4. Wait for the deploy, then check `https://draw-karo-server.onrender.com/health` → `ok`.
   Copy the real URL (Render appends a suffix if the name is taken).

> Every `git push` to `master` redeploys the server automatically.

### Free-tier behaviour to know

- The server **spins down after ~15 min idle** → the next visitor waits ~30–60 s
  for a cold start (the room screen shows its loading state).
- Rooms live **in memory**: a deploy or restart drops every live game. Codes
  from before the restart are invalid.
- Keeping it warm: `.github/workflows/keepalive.yml` pings `/health` every
  10 minutes. Set the repo variable `GAME_SERVER_URL`
  (Settings → Secrets and variables → Actions → Variables) to enable it.
  This fits in the 750 free hours/month; sleeping hours don't count.

## 3. Web app on Vercel

1. Vercel Dashboard → **Add New → Project** → import the same repo.
2. Leave **Root Directory** at the repo root — `vercel.json` drives the build:
   - install: `npm ci`
   - build: `npm run build:packages && cd apps/mobile && npx expo export --platform web --output-dir dist`
   - output: `apps/mobile/dist`
   - SPA rewrite so `/room` and `?code=XXXX` links work
3. **Environment variable** (Production *and* Preview):

   | Key | Value |
   |---|---|
   | `EXPO_PUBLIC_GAME_SERVER` | your Render URL, e.g. `https://draw-karo-server.onrender.com` |

4. Deploy. `EXPO_PUBLIC_*` is baked in at build time — if the server URL
   changes, edit the variable and **Redeploy**.

Revenue-free extras: Vercel gives a `<project>.vercel.app` URL; a custom domain
also costs nothing to attach if you own one.

## 4. Android APK (sideload, no Play Store fee)

One-time:

```bash
cd apps/mobile
npx eas-cli@latest login          # free Expo account
npx eas-cli@latest build:configure
```

Build the APK:

```bash
npx eas-cli@latest build --profile preview --platform android
```

EAS prints a download URL when done (also on expo.dev). Share that APK link on
WhatsApp — sideloading needs "Install unknown apps" on Android.

`apps/mobile/eas.json` hardcodes `EXPO_PUBLIC_GAME_SERVER=https://draw-karo-server.onrender.com`
for both profiles — update it if your server URL differs.

Production bundle for the Play Store later (one-time $25 developer fee):

```bash
npx eas-cli@latest build --profile production --platform android
```

## 5. Post-deploy smoke test

1. Open the Vercel URL on desktop → create room → copy invite link.
2. Open the link on a phone → join screen shows your card + prefilled code → Join.
   (The link must **not** auto-join.)
3. Start a game: word choice, drawing sync, bucket fill, guess chat, hints,
   turn-end scores, final-round → straight to the leaderboard.
4. Close a tab mid-game and reopen the link — the seat is adopted (same score,
   no ghost row).
5. Check the Render log stream for errors and the Vercel build log for warnings.

## Troubleshooting

**Render build: `TS7016: Could not find a declaration file for module 'express'`**
`NODE_ENV=production` (set as a service env var) makes `npm ci` skip
devDependencies, so TypeScript and `@types/*` never install. The blueprint uses
`npm ci --include=dev` for this reason. If the service already exists, edit
**Settings → Build Command** to the same value — blueprint edits do *not*
retro-apply to a running service.

**Render build: `TS5107: Option 'moduleResolution=node10' is deprecated`**
The host picked a newer TypeScript than the repo pins. The server-side
tsconfigs use `module`/`moduleResolution: node16`, which both TS 5.9 and 6 accept;
`engines.node` is pinned to `22.x` so the host stops choosing Node 26.

**Web app loads but Create Room spins forever**
The server is down or cold-starting. The client gives up after 10 s, shows a
retry message and finishes the pending create/join automatically once the socket
connects. Check `/health` first.

**Vercel project URL has a suffix** (`draw-karo-one.vercel.app`)
The name you typed was taken; the real URL is on the project card. Set
`EXPO_PUBLIC_GAME_SERVER` on the project you actually use and redeploy.
