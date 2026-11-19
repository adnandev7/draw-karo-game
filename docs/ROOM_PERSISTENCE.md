# Room persistence — scope

Rooms live in the Render process's memory. When that process goes away, so do
the rooms: codes stop working, scores vanish, and everyone is stuck on
"Room not found". This document sizes the fix, the options, and the exact
failure modes it removes.

## 1. What actually kills a room today

| Cause | Frequency | What players see |
|---|---|---|
| **Deploy/restart** | Every push to `apps/server`, `packages/**`, `render.yaml` — now automatic via the Render deploy hook | Server dies mid-turn, sockets drop. Clients auto-reconnect, but the room no longer exists; the drawer loses the word and everyone loses the scoreboard |
| **Free-tier spin-down** | 15 min with no inbound traffic | If *every* phone backgrounded (very common: people put the phone down between rounds), the instance sleeps. Waking up starts a fresh process — game gone |
| **Platform restart / OOM** | Rare, but documented for free instances | Same as above |

A live game with at least one open socket counts as traffic, so sleep does not
hit mid-turn while someone is actively looking at the screen. The realistic
loss case is **everyone backgrounds for 15+ minutes**, plus **deploys**.

Note: the deploy hook we just added makes case 1 *more* frequent, not less. That
is the strongest argument for fixing this properly rather than tuning deploy
discipline.

## 2. Constraint: ₹0

| Option | ₹0? | Verdict |
|---|---|---|
| Render persistent disk | No — disks are not available on free web services | Out |
| Render Key Value (free, 25 MB) | Yes | **Useless here** — [free instances are in-memory only](https://render.com/docs/free#free-key-value); a restart wipes the data, which is exactly the scenario we are insuring against |
| Render Starter instance ($7/mo) + disk, or Key Value 256 MB ($10/mo) | No | Out |
| Cloudflare Workers + Durable Objects | Yes (SQLite backend on the free plan) | Architecturally the best fit — room state lives *in* the room object and survives hibernation. But Socket.IO has to be replaced with raw WebSockets, i.e. a rewrite of the transport on both server and client. Weeks of work, high regression risk for a party game |
| **Upstash Redis REST (free)** | Yes | **Chosen.** 500K commands/month, 250 MB, no card, no TCP client — plain `fetch`, so no new dependency |
| Deploy discipline only (deploy between games) | Yes | Partial mitigation, no durability, breaks the moment Render restarts on its own |

## 3. Chosen design: snapshot + restore

Rooms keep running exactly as they do now. A background writer copies each
room's state to Redis at a throttled rate, and boot restores whatever it finds.

### What is persisted

Everything needed to rebuild the room *except* live sockets and timers:

players (id, name, avatar, score, host flag, `guessedCurrent`, `turnPoints`,
`guessOrder`, `turnStartScore`), settings, `phase`, `round`, `turn`,
`drawerId`, `word`, `wordMask`, `hintsRevealed`, `strokes` (including fill
images), `chat`, `usedWords`, `wordOptions`.

Dropped on purpose: sockets, timers, per-player rate-limit windows,
`disconnectTimer` handles. All of those are cheap to recreate and dangerous to
fake.

### Resume rules

The hard part of persistence is never the bytes — it's timers that were
counting down in a process that no longer exists. Rather than guess how much
time was left, the restore path **never resumes a timer mid-flight**. It
re-enters the game through a state the code already knows how to run:

| Persisted phase | On the first player joining the restored room |
|---|---|
| `lobby` | Nothing to do — the room is exactly as it was |
| `selecting` | Re-open word choice for the same drawer with a fresh 15 s window. If that drawer is gone, skip to the next turn |
| `drawing` | **Finish the turn as if time ran out**: award drawer/guesser points, show the normal turn-end overlay, then continue. Nobody loses points they earned, nobody gets a second bite at a half-guessed word |
| `turnEnd` / `roundEnd` / `gameEnd` | Re-broadcast the overlay and run its normal duration, then continue |

Restored rooms sit **paused** (no timers, `timeLeftMs: 0`) until someone joins.
A room restored and never rejoined is swept like any other abandoned room.

### Write path

- `Room` marks itself dirty on state broadcast, stroke/fill, chat, and word
  choice.
- `RoomManager` writes at most **once per 5 s per room** (trailing write, so the
  last change is never lost).
- `SIGTERM`/`SIGINT` flushes every dirty room before exit. Render sends
  `SIGTERM` on deploy with a grace period, so a deploy loses at most the last
  few seconds of strokes.
- Keys are `dk:room:<CODE>` with a 6 h TTL, refreshed on write, deleted when the
  room is swept or emptied.

### Snapshot size

Caps at **1.5 MB per room**: fill images are ~400 KB each, so overflow drops
fills oldest-first, then oldest strokes, then trims chat. A room that hits the
cap keeps playing; it just resurrects with a partial canvas.

### Storage adapter

```ts
interface RoomStore {
  list(): Promise<RoomSnapshot[]>;
  save(snap: RoomSnapshot): Promise<void>;
  remove(code: string): Promise<void>;
  readonly persistent: boolean;
}
```

Three implementations, selected by env:

| Env | Store | Used for |
|---|---|---|
| *(none)* | `MemoryStore` | Default. Identical to today's behaviour — no persistence, no new failure mode |
| `PERSIST_DIR` | `FileStore` | Local dev and the CI resume test (a restart is just process death, so a temp dir proves the whole path) |
| `UPSTASH_REDIS_REST_URL` + `..._TOKEN` | `UpstashStore` | Production |

## 4. Work breakdown

| # | Task | Files | Size |
|---|---|---|---|
| 1 | `RoomStore` interface + `MemoryStore` + `FileStore` | `apps/server/src/persist.ts` (new) | ~120 lines |
| 2 | `UpstashStore` over REST `fetch` (`SET … EX`, `SCAN`, `DEL`, pipeline) | same file | ~70 lines |
| 3 | `Room.snapshot()` / `Room.fromSnapshot()` + paused flag | `apps/server/src/room.ts` | ~90 lines |
| 4 | `Room.resume()` implementing the phase table above | `apps/server/src/room.ts` | ~50 lines |
| 5 | Dirty tracking, 5 s throttle, `flushAll()`, `SIGTERM` hook | `room.ts` + `apps/server/src/index.ts` | ~70 lines |
| 6 | Boot: `await manager.hydrate()` before `listen()`, health gains `persistent` + `restored` | `index.ts` | ~20 lines |
| 7 | Resume integration test: create room → kill process → restart → reconnect → assert scores/turn survive | `apps/server/scripts/resume-test.mjs` (new) + CI step | ~120 lines |
| 8 | Docs: env vars, Upstash setup, the drill, troubleshooting | `docs/DEPLOY.md`, `render.yaml` | ~40 lines |

Roughly **450 lines**, one focused day including the live restart drill.

## 5. Cost, in real numbers

- Upstash free: **500K commands/month** (~16K/day), 250 MB, no card.
- One write per room per 5 s = 720 writes/room-hour. A heavy night — 3 rooms,
  2 hours — is ~1,700 commands. Even 20 hours of live play per day stays under
  budget. If it ever gets close, the throttle is one constant.
- Reads only happen at boot (`SCAN` + one `GET` per room).
- Storage: one snapshot per room, most a few hundred KB, capped at 1.5 MB.

**Setup needs a human step once:** create a free Upstash database (GitHub/Google
login), copy the REST URL + token into Render's environment. If the two env
vars are absent, the server behaves exactly as it does today.

## 6. Verification

1. **Local, automated (CI):** `FileStore` + a script that boots the server,
   creates a room with two socket clients, kills the process, boots again, and
   asserts the room code still resolves, scores are intact, and the phase table
   behaves. No network, no account, runs in the existing CI job.
2. **Live drill:** start a real game on the Vercel site, hit Manual Deploy in
   Render mid-turn, watch both clients reconnect into the restored room. Then
   repeat with a forced sleep (`/health` idle for 15 min is impractical, so
   restart the service from the dashboard).
3. **Regression:** `tsc --noEmit`, `eslint --max-warnings=0`, existing CI.

## 7. Rollback

Unset `UPSTASH_REDIS_REST_URL`/`_TOKEN` on Render and redeploy. The server falls
back to `MemoryStore`; behaviour is byte-for-byte today's. No client change is
involved at any point, so the web app and any installed APK keep working
throughout.

## 8. Out of scope

- **Multi-instance / horizontal scale.** Free Render gives one instance; sticky
  sessions and a shared room registry are a different project.
- **Surviving a Redis outage.** If Upstash is unreachable, saves fail and are
  logged; the game continues in memory. Fire-and-forget by design.
- **Persistence across a word-pack change** that deletes a previously used word
  — the restored room re-picks that turn's word from the current pool.
- **Chat/canvas history beyond the caps** in §3.
- **Moving to Durable Objects.** Worth revisiting only if Render's cold starts
  become the complaint rather than restarts.
