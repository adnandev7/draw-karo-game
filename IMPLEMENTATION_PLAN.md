# 🎨 Draw Karo — Implementation Plan

> **Draw Karo** — desi masti wala draw-and-guess game. Skribbl.io ka core dil, Desi Avatar Studio, Hinglish word packs, reactions, voice chat, badges aur Funniest Drawing Award ke saath.
>
> Mobile-first (Android/iOS/Web) · React Native + Expo · Free-to-play, guest-first.

---

## 1. Vision & Core Philosophy

Skribbl.io ke core loop ko exactly replicate karna hai — kyunki wo loop proven fun hai. Hamara differentiation (USP) **desi flavor + social expressiveness + voice** hai. Rule of thumb for every feature decision:

1. **Join in < 10 seconds** — no signup, no downloads beyond the app itself. Name + avatar → play.
2. **Masti > competition** — points and badges reward fun (funniest drawing, worst artist), not just skill.
3. **Voice makes it a hangout** — a game you can play like you're sitting on a call with friends.
4. **Desi by default** — Hinglish words, Bollywood references, tapori emoji reactions — not a translation layer.

---

## 2. Tech Stack (with rationale)

| Layer | Choice | Why |
|---|---|---|
| App | **React Native + Expo (SDK 54+), expo-router** | Single codebase → Android, iOS, Web. File-based routing keeps screens organized. |
| Language | **TypeScript (strict)** | Shared types between app & server prevent socket-event bugs. |
| Drawing canvas | **@shopify/react-native-skia (v3, Graphite)** | GPU-rendered, built for freehand drawing; v3 renders off the UI thread so chat/voice UI never jank the canvas. Works on web via CanvasKit WASM. *Does not run in Expo Go → we use **expo-dev-client** + **EAS builds** (also required for voice).* |
| Gestures | **react-native-gesture-handler + reanimated** | 60fps stroke capture, UI-thread driven. |
| Realtime game | **Node.js 20 + TypeScript + Socket.IO (authoritative server)** | Game state (turns, scores, timer) lives ONLY on the server → no cheating, no desync. Socket.IO handles reconnection + fallback transports for flaky mobile networks. |
| Server hosting | **Render.com (free tier)** | Free Node.js web service with WebSocket support; sleeps after 15 min idle (~1 min cold start on next join). 750 free hours/month — sleeping hours don't count. ₹0. |
| Voice chat | **LiveKit Cloud (free tier) + @livekit/react-native-expo-plugin** | First-class Expo plugin, WebRTC SFU, works on Android/iOS/Web. Mic-only usage fits free tier easily. |
| Client state | **Zustand** | Lightweight game-state store; plays well with socket updates. |
| Local persistence | **react-native-mmkv** | Guest profile, avatar config, achievements cache — survives app restarts, no backend needed. |
| Server persistence | **SQLite (initial) → Postgres later** | Word packs, badge definitions, report logs. Player data stays client-side (guest-first). |

**Monorepo layout (npm workspaces):**

```
draw-karo/
├── apps/
│   ├── mobile/          # Expo app (Android / iOS / Web)
│   └── server/          # Node + Socket.IO authoritative game server
├── packages/
│   ├── shared/          # TypeScript types, socket event contract, scoring utils
│   └── words/           # Desi word packs (JSON) + validation/profanity filter
└── docs/
```

---

## 3. Game Core (skribbl parity)

### 3.1 The loop

```
Lobby → Round starts
  └─ For each player (drawer order = join order, shuffled per game):
        ├─ TURN_SELECT  (15s): drawer picks 1 of 3 words
        ├─ TURN_DRAW    (default 80s, configurable 30–180):
        │     · drawer draws, strokes broadcast in real time
        │     · guessers type guesses in chat
        │     · hint letters revealed at 50% and 25% time remaining (configurable)
        │     · correct guess → private "You guessed it!" + green chat line;
        │       guesser's chat becomes hidden to non-guessers (skribbl behavior)
        └─ TURN_END (5s): reveal word, show points earned this turn
  └─ Round ends → leaderboard interstitial → next round
→ GAME_END: podium + badges + (every 2nd game) Funniest Drawing Award
→ Back to Lobby (same room persists)
```

### 3.2 Scoring (skribbl-faithful)

- **Guesser:** `points = round(100 × (timeRemaining / totalTime)) + 50` base — first correct guesser gets the most, later guessers get proportionally less. Wrong guesses: 0, unlimited attempts.
- **Drawer:** `points = round(400 / numberOfGuessers) × correctGuessers` — scaled by how many people guessed it.
- **Hints reduce** the potential guesser score by 25% per revealed letter (configurable).
- Anti-spam: rate-limit guesses (max ~5 per 3s), ignore repeated guesses, and *no penalty* for wrong guesses — skribbl chaos preserved.

### 3.3 Room settings (host-configurable, like skribbl private rooms)

| Setting | Range | Default |
|---|---|---|
| Rounds | 1–10 | 3 |
| Draw time | 30–180s | 80s |
| Max players | 2–16 | 8 (voice-friendly) |
| Word choices per turn | 2–4 | 3 |
| Hints | on/off, count | on, 2 letters |
| Word packs | multi-select | Bollywood + Indian Food + Memes |
| Inside Joke Mode | on/off | off |
| Funniest Drawing Award | off / every 2 rounds / final | final |
| Voice chat | on/off | on |

- **Room codes**: 4-character codes (e.g., `K7TP`) + shareable deep link `drawkaro.app/join/K7TP` (web) / app scheme `drawkaro://join/K7TP` (mobile). Public "Play Now" matchmaking = auto-join a random open public room.

---

## 4. The Desi USP Feature Specs

### 4.1 🧑‍🎨 Desi Avatar Studio
- **Layered vector avatar system** (same approach as skribbl, but desi parts): base face → skin tone → eyes/expression → hairstyle → accessories (turban, cap, chashma, jhumke, beard styles, tikka) → outfit color.
- Rendered with **react-native-skia** as composable path/parts — no image assets to download, infinitely reusable in player list, chat bubbles, and podium.
- **Studio screen**: carousel swiping per layer (skribbl-style arrows, but Indianized default sets + festive festival drops later — Diwali/holi seasonal accessory packs).
- Avatar config saved locally (MMKV), synced to room as a small JSON descriptor (≤ 1 KB) — all clients render the same avatar from parts.

### 4.2 📚 Desi Word Packs
- Shipped as **JSON files in `packages/words`** — easy to extend, no server deploy needed for new packs (versioned, fetched on app start).
- Launch packs: **Bollywood, Cricket, Indian Food, Memes, College Life, Slang/Hinglish** (~200–400 words each, difficulty-tagged easy/medium/hard — harder words worth more, skribbl-style).
- Words include *accepted spellings list* (e.g., "paneer tikka", "panner tikka", "paneer tikka Masala" all accept) and a **normalized-compare function** (lowercase, strip spaces/punctuation, leet-ish variants) in `packages/shared`.
- **Host picks packs per room**; the mix is shuffled server-side.

### 4.3 🎉 Reactions
- Reaction bar (😂 💀 🔥 😱 ❤️ 🙏 👏 🤡) floating over the canvas — tap → ephemeral animated emoji drifts up from your player bubble (Skia animation), broadcast via socket as a tiny event (~40 bytes). No chat pollution.
- Cooldown (1 per 2s) per player; sound optional.
- **Drawer-specific reaction**: guessers can spam 🔥 at the artist — feeds the Picasso badge.

### 4.4 🏆 Funniest Drawing Award
- Trigger: configurable (default: after the **final round**).
- **Gallery screen**: every turn's drawing snapshot (Skia `makeImageSnapshot` → PNG, kept in server memory per room, expiring with the room) shown one-by-one, anonymized.
- Everyone votes (can't vote own drawing); 15s timer; ties split the award.
- Winner gets **+250 bonus points**, a 🤡 crown on the podium, and the "Comedy King" badge increment.

### 4.5 🏅 Achievement Badges (server-awarded, client-cached)
| Badge | Trigger |
|---|---|
| ⚡ Fastest Guesser | Guess correct in < 5s (any turn) |
| 🖌️ Picasso | Drawing got ≥ 80% correct guessers, 3 times |
| 🤡 Worst Artist | Your drawing: 0 correct guesses, 3 times |
| 🧠 Mind Reader | First correct guesser 5 times in one game |
| 👑 Comeback King | Win a game after being last at any round end |
| 😂 Comedy King | Funniest Drawing Award winner |
| 🔥 Hype Squad | Send 50 reactions lifetime |
| 🎙️ Radio Jockey | Talk in voice chat for > 30 min total |

- Tracked on the **server per room, merged client-side** into the local profile (guest-first design). Badge unlock → confetti toast + entry on profile.
- Room lifetime leaderboards only (no global backend needed in v1 — keeps it free & private).

### 4.6 🤫 Inside Joke Mode
- In room lobby, host (or anyone, if allowed) can add **custom words** ("Sharma ji ka beta", "canteen wale bhaiya", "Rohan ka crush") — textarea + paste list support.
- Toggle: **"Mix with packs"** or **"Only our words"**.
- Stored per-room on the server (volatile — room ends, words end). Local "save this joke list" (named lists in MMKV, re-loadable in future rooms) — v1.1.
- Profanity/abuse filter runs on custom words before they enter the pool (see §8).

### 4.7 🎙️ Voice Chat (our biggest differentiator over skribbl)
- **LiveKit room per game room** — auto-join when you join the game room, mic **muted by default**, big push-to-talk or toggle button.
- Mic permission requested contextually (first game start), not at app launch.
- **Server-driven voice logic** via LiveKit server API (server holds the API key, generates room-scoped JWT tokens on game join):
  - Auto-mute ALL during `TURN_SELECT` for the drawer's fair word choice? No — keep it simple: free chat always; **host can mute/unmute any participant**; **personal mute** button; drawer gets a "mute all" quick action.
  - When a player leaves the game room → LiveKit participant auto-removed (token expiry + server kick).
- Voice UI: tiny speaker bubbles above player avatars with animated speaking-indicator rings (LiveKit audio level events) — feels alive without dominating the screen.
- Web (browser) supported via `livekit-client`; **known limitation**: iOS Safari requires a user tap before audio — the "Join Voice" button handles this.
- Fallback: if voice fails to connect (network/firewall), the game continues silently + toast explains. Game never blocks on voice.

---

## 5. Architecture

```
┌───────────────────────────  Expo App  ───────────────────────────┐
│  Screens (expo-router)      Zustand store        Skia Canvas     │
│  Home / Join / Lobby ─────────────┐                (draw + avatar│
│  Game / Results / Awards ─────────┤                 + reactions) │
│        │                          │                     ▲        │
│  socket.io-client ◄───────────────┼──── stroke/state    │        │
│  livekit-client ◄──────────────┐  │     updates         │        │
└────────────────────────────────┼──┼─────────────────────┼────────┘
                                 │  ▼                     │
                     ┌───────────┴────────────────────────┴─────┐
                     │      Node.js Game Server (authoritative) │
                     │  Room manager · State machine · Scoring  │
                     │  Word picker · Hints · Badge triggers    │
                     │  Socket.IO │ REST /health │ LiveKit token│
                     └───────────────┬──────────────────────────┘
                                     │ server API key (JWT mint)
                             ┌───────▼────────┐
                             │  LiveKit Cloud │  WebRTC audio SFU
                             └────────────────┘
```

**Key principles:**
- The server is the **only source of truth** for: word, timer, scores, turn order, guesses validity. Clients render state; they never decide it.
- Client clocks are ignored — server schedules all phase transitions and emits countdown snapshots.
- Room is a self-contained in-memory object; server restart → rooms lost (acceptable for v1; note in FAQ "refresh = new room" like skribbl).

---

## 6. Screens & UX Flow

| # | Screen | Contents |
|---|---|---|
| 1 | **Home** | Big "Draw Karo!" doodle-style logo, name input, avatar preview + "Banao" (edit) button, Play Now (public), Create Private Room, Join with code |
| 2 | **Avatar Studio** | Layered swiping editor (skin/face/hair/accessory/outfit), randomize 🎲 button, Save |
| 3 | **Room Lobby** | Players list (avatar + name), settings panel (host only, live-updating), word packs multi-select, Inside Joke textarea, share invite (code + copy + WhatsApp share sheet), chat lounge, "Shuru Karo!" |
| 4 | **Game** | Canvas center, word underscores top (letters fill in as guessed/hinted), timer ring, players sidebar with scores + speaking rings, chat drawer bottom (guess input), drawing toolbar (colors, brush sizes, eraser, undo, clear) for drawer, reaction bar, voice button |
| 5 | **Turn End overlay** | Word reveal + who guessed + points animation |
| 6 | **Round End / Leaderboard** | Podium with avatars, animated score bars |
| 7 | **Funniest Award** | Full-screen drawing gallery + vote buttons + live vote counts |
| 8 | **Game End / Podium** | Winner crown, badges earned (confetti), rematch ("Phir Se!"), awards |
| 9 | **Profile** | Badge shelf, lifetime stats, avatar, edit |

**Mobile-first layout** — portrait; canvas always ≥ 60% of screen height. Web gets the same layout with a wider chat pane.

---

## 7. Data Models & Socket Contract (abridged)

### 7.1 Core types (`packages/shared`)

```ts
type Player = { id: string; name: string; avatar: AvatarDescriptor; score: number;
  isHost: boolean; connected: boolean; guessedCurrent: boolean; };

type RoomSettings = { rounds: number; drawTimeSec: number; maxPlayers: number;
  wordChoices: number; hints: number; packs: WordPackId[]; customWords: string[];
  onlyCustom: boolean; awardMode: 'off'|'final'|'every2'; voice: boolean; };

type RoomState = { code: string; players: Player[]; settings: RoomSettings;
  phase: 'lobby'|'selecting'|'drawing'|'turnEnd'|'roundEnd'|'award'|'gameEnd';
  drawerId: string|null; wordMask: string; timeLeftMs: number; round: number; turn: number; };

type Stroke = { id: string; color: string; width: number; tool: 'brush'|'eraser';
  points: Array<{ x: number; y: number }>; };   // x,y normalized 0..1 — resolution independent
```

### 7.2 Socket events

**Client → Server**
`room:create(settings)` · `room:join(code, profile)` · `room:leave` · `room:settings(update)` · `game:start` · `word:choose(idx)` · `draw:stroke(strokeDelta)` · `draw:undo` · `draw:clear` · `guess:text` · `chat:msg` · `reaction:send(emoji)` · `award:vote(playerId)` · `host:kick(playerId)` · `host:mute(playerId)`

**Server → Client**
`room:state(fullSnapshot)` (on join/reconnect — includes **full stroke history**) · `player:joined|left|kicked` · `game:started` · `turn:selecting` (drawer gets 3 words, others get mask) · `turn:drawing(wordLength)` · `draw:stroke(broadcast)` · `draw:undo|clear(broadcast)` · `guess:wrong(generic)` · `guess:close(word)` ("you're close!") · `guess:correct(playerId, points)` · `hint:reveal(mask)` · `turn:end(word, turnResults)` · `round:end(leaderboard)` · `award:start(gallery)` · `award:end(winner)` · `game:end(podium, badges)` · `reaction:broadcast` · `voice:token(livekitJWT)` · `error(code, message)`

### 7.3 Drawing sync strategy (the heart of the game)
1. **Vector strokes, not pixels** — each stroke = color/width/tool + decimated point list (min-distance filter ~1.5% of canvas, applied on the sender before emit). A whole drawing is typically < 15 KB — skribbl-cheap, and replayable on late join.
2. **Throttled batching** — capture points locally every frame (Reanimated), emit partial stroke deltas every ~50 ms; server rebroadcasts immediately (no buffering).
3. **Normalization** — coordinates 0..1 relative to canvas → perfect rendering across phone sizes/aspect ratios.
4. **Late join / reconnect** — `room:state` carries full stroke history for the current turn; client replays instantly.
5. **Undo** — server pops last stroke of current drawer, broadcasts `draw:undo`.

---

## 8. Safety, Moderation & Fair Play
- **Word/answer check is server-side** — clients never receive the word until reveal.
- Name, custom words & chat pass a **bad-word filter** (Hindi + English + transliterations) → blocked or asterisked.
- Report + mute player (persisted locally; the room host can kick). Vote-kick (majority) for public rooms.
- Rate limiting on guesses/chat/reactions; identical-guess dedupe.
- Public rooms: turn-off-able voice, and drawings auto-removed when the room ends (nothing stored server-side beyond room lifetime).

## 9. Deployment & Dev Workflow
- **Dev**: `npx expo start` (dev-client on device) + `npm run dev` server locally with `adb reverse` / LAN URL. Tunnel mode (`--tunnel`) for testing on physical devices over different networks.
- **Server deploy**: Render free-tier web service; env: `LIVEKIT_API_KEY/SECRET`, `LIVEKIT_URL`, `CORS_ORIGIN`. `GET /health` for uptime checks. Add a friendly "server jaag raha hai..." splash for the ~1 min cold start after idle.
- **Strict ₹0 mode**: see §13 — everything above stays free; app ships as sideloaded APK + free web build, no Play Store / App Store fees.
- **Client builds**: EAS Build free tier (Android APK/AAB first; iOS via EAS later or local). EAS Update for OTA JS fixes. Web: static export (`expo export --platform web`) hosted on Render static site (free) — websocket URL points to game server.
- **Secrets in EAS env**, never in repo.

## 10. Milestones

| Phase | Deliverable | Includes |
|---|---|---|
| **M0 — Setup** (day 1–2) | Monorepo skeleton runs | Expo app (dev-client, Skia, gesture-handler wired) + server scaffold + shared package + socket contract types + health check + deploy pipeline |
| **M1 — Core loop playable** (week 1–2) | Two phones can play a full game | Rooms (create/join/code), lobby, turn state machine, Skia draw + live stroke sync, guess flow, scoring, turn/round end, leaderboard, reconnect handling |
| **M2 — Core polish** (week 3) | Feels like skribbl | Hints, close-guess feedback, drawer tools (colors/sizes/eraser/undo/clear), word selection UI, public matchmaking, kick/mute, avatar basics in player lists |
| **M3 — Desi Wave 1** (week 4) | The flavor lands | All 6 word packs + difficulty tiers, Desi Avatar Studio (full layer set), reactions overlay |
| **M4 — Voice** (week 5) | Hangout mode | LiveKit integration (mobile+web), auto-join, mute controls, speaking rings, host mute, graceful fallback |
| **M5 — Desi Wave 2** (week 6) | Full USP set | Inside Joke Mode (+ saved joke lists), Funniest Drawing Award (gallery + voting), full badge system + profile, deep links + WhatsApp share |
| **M6 — Launch** (week 7–8) | APK + web live | Android APK via EAS free tier (direct share on WhatsApp — sideload, no Play Store fee), web build live on Render static, perf pass (low-end Android FPS test), moderation pass, onboarding tutorial ("Kaise Khelna Hai"), share assets |

Each milestone ends playable — M1 is the "it's a real game" moment; everything after adds masti.

## 11. Key Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Skia web WASM payload (~2–3 MB) slows web first-load | Lazy-load canvas route; preload after Home renders |
| Voice chat battery/data drain on mobile | Mic-only (no video), dtx enabled, auto-pause when app backgrounds, off-toggle |
| Flaky Indian networks (socket drops mid-turn) | Socket.IO auto-reconnect + full `room:state` resync; timer runs server-side so game continues for others |
| Cheating via devtools on web | All logic server-side; word never sent to guesser clients |
| LiveKit free tier limits | Mic-only rooms of ≤ 8 use trivial bandwidth; upgrade path documented if viral |
| Custom words used for abuse | Filter at submission + report/mute/kick |
| iOS audio autoplay restrictions | Voice join behind explicit tap |

## 12. Open Questions (post-M5 decisions)
- Monetization later: cosmetic avatar packs (festive drops) — never pay-to-win; word packs stay free.
- Global (non-desi) word packs for reach — architecture already supports it.
- Push notifications ("Room K7TP started!") — needs a small backend addition; defer.

## 13. 💸 Budget — Strict ₹0 Mode (verified Nov 2026)

Everything in this plan costs **₹0**. No credit card is required for any free tier used.

| Item | Service / approach | ₹0 reality |
|---|---|---|
| App code & frameworks | React Native, Expo, Skia, Socket.IO, TypeScript, LiveKit SDKs | Open source, free |
| Game server hosting | Render.com **free web service** | WebSockets supported; sleeps after 15 min idle (~1 min wake, we show a "jaag raha hai..." splash); 750 free instance-hours/month — sleeping hours don't count |
| Voice chat | LiveKit Cloud **Build plan** | Free, no credit card: 5,000 voice participant-minutes/month, 100 concurrent participants. **Hard cap, never a bill** — when exhausted, voice is off for the rest of the month, the game keeps working |
| App distribution | **EAS free tier** builds a `.apk` → shared via WhatsApp, sideloaded | No Play Store fee ($25 avoided) |
| Web version | Expo static export → **Render static site** (free, always free) | iOS users play in Safari — App Store's $99/yr avoided |
| Domain | Render free subdomains (`...onrender.com`) | ₹0 |
| Dev tools | Node.js, VS Code, Git, Android Studio, Expo CLI | Free |

**Known trade-offs of ₹0 mode (limits, not money):**
1. Cold start: first joiner after 15+ idle minutes waits ~1 minute. Once players are connected, WebSocket messages keep the server awake (Render confirmed this from Feb 2026) — mid-game it never sleeps.
2. Voice quota: ~13 one-hour games with 6 voice participants/month free. Voice degrades gracefully (toggle shows "voice off today"); the game never blocks on voice.
3. No iOS native app initially — Safari web version instead (LiveKit + Skia both run on web).
4. Server restarts/deploys wipe in-memory rooms — same as skribbl's "refresh = room gone"; acceptable for v1.

**₹0 escape hatches if the app gets popular (defer until then):**
- Voice quota hit → self-host LiveKit (open source) on Oracle Cloud **Always Free** ARM VM — still ₹0, just some setup work.
- Server always-on needed → paid tier is ~$7/month, only when real usage demands it.
- Play Store listing → one-time $25 fee, only when sideload distribution stops working for you.

**What the developer (you) needs:** a laptop, an Android phone, ~1 hour of guided setup (install Node.js, create free GitHub/Render/LiveKit accounts), and creative inputs (words, jokes, avatar vibes). All coding, commands and troubleshooting are handled during the build.
