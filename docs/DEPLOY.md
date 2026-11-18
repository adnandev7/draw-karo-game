# Deploying Draw Karo (₹0)

Two things go live:

| Piece | Host | Cost |
|---|---|---|
| Game server (Node + Socket.IO) | Render free web service | ₹0 |
| Web app (Expo static export) | Render free static site | ₹0 |
| Android APK | EAS free tier (sideload via WhatsApp) | ₹0 |

Voice chat (LiveKit) is not wired yet — the env slots exist but stay empty.

---

## 1. Push the repo to GitHub

```bash
git remote add origin https://github.com/<you>/draw-karo.git
git push -u origin master
```

## 2. Deploy on Render (blueprint)

1. Render Dashboard → **New → Blueprint** → select the repo.
2. Render reads `render.yaml` and creates **draw-karo-server** and **draw-karo-web**.
3. Fill the `sync: false` env vars:

   | Service | Variable | Value |
   |---|---|---|
   | draw-karo-server | `LIVEKIT_*` | leave empty for now |
   | draw-karo-web | `EXPO_PUBLIC_GAME_SERVER` | `https://draw-karo-server.onrender.com` |

4. Wait for both deploys. Server health: `https://draw-karo-server.onrender.com/health` → `ok`.
5. Open `https://draw-karo-web.onrender.com` — create a room, join from your phone using the share link.

> `EXPO_PUBLIC_GAME_SERVER` is compiled into the web bundle. If the server URL
> changes, redeploy **draw-karo-web** (Manual Deploy → Clear build cache & deploy).

### Free-tier behaviour to know

- The server **spins down after ~15 min idle** → the next visitor waits ~30–60 s
  for a cold start (the room screen shows the loading state).
- The server keeps rooms **in memory**: a restart/deploy drops every live game.
  Room codes are invalid after that.
- Keeping it warm: `.github/workflows/keepalive.yml` pings `/health` every 10
  minutes. Set the repo variable `GAME_SERVER_URL` (Settings → Secrets and
  variables → Actions → Variables) to enable it. This uses the 750 free
  hours/month; sleeping hours don't count.

## 3. Android APK (sideload, no Play Store fee)

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

## 4. Post-deploy smoke test

1. Open the web URL on desktop → create room → copy invite link.
2. Open the link on a phone → join screen shows your card + prefilled code → Join.
3. Start a game: word choice, drawing sync, bucket fill, guess chat, hints,
   turn-end scores, final-round → leaderboard.
4. Close a tab mid-game and reopen the link — the seat should be adopted
   (same score, no ghost row).
5. Check the server log stream in Render for errors.
