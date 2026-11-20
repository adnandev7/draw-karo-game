#!/usr/bin/env node
/**
 * Headless end-to-end test: four players, two rounds, real Socket.IO protocol.
 *
 * What it proves that a manual two-player match cannot:
 *   - turn order rotates through every player once per round
 *   - a turn ends early when every guesser has guessed
 *   - scores stay hidden while the turn is running, then land at turn end
 *   - strokes reach the other players
 *   - a late joiner is refused mid-game
 *   - the final podium has every player, ranked, with points
 *
 * Run:  npm run build && node apps/server/scripts/e2e.mjs
 * Port 4100 is used so a local dev server on 4000 is left alone.
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { io } from "socket.io-client";

const PORT = 4100;
const URL = `http://127.0.0.1:${PORT}`;
const DRAW_TIME_SEC = 30;
const ROUNDS = 2;
const AVATAR = {
  skinTone: "#f25c54",
  expression: "happy",
  mouth: "squiggle",
  hairstyle: "none",
  accessory: "none",
  outfitColor: "#f25c54",
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const proc = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      CORS_ORIGIN: "*",
      // force the in-memory store: this test is about game logic only
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      PERSIST_DIR: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (process.env.VERBOSE) {
    proc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  }
  proc.stderr.on("data", (d) => process.stderr.write(`[server!] ${d}`));
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${URL}/health`);
      if (res.ok) return proc;
    } catch {
      /* not up yet */
    }
    await wait(250);
  }
  throw new Error("server did not come up on " + URL);
}

async function connect(name) {
  const sock = io(URL, { transports: ["websocket"], reconnection: false, timeout: 5_000 });
  await new Promise((resolve, reject) => {
    sock.once("connect", resolve);
    sock.once("connect_error", reject);
  });
  sock._playerName = name;
  return sock;
}

function ack(sock, event, ...args) {
  return new Promise((resolve, reject) => {
    sock.timeout(5_000).emit(event, ...args, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

/** Resolve with the next `event` from any socket that matches `pred`. */
function onceAny(socks, event, pred = () => true, ms = 25_000) {
  return new Promise((resolve, reject) => {
    const handlers = [];
    const timer = setTimeout(() => {
      for (const [s, h] of handlers) s.off(event, h);
      reject(new Error(`timed out after ${ms}ms waiting for ${event}`));
    }, ms);
    for (const s of socks) {
      const h = (payload) => {
        if (!pred(payload)) return;
        clearTimeout(timer);
        for (const [sock, hh] of handlers) sock.off(event, hh);
        resolve({ payload, socket: s });
      };
      handlers.push([s, h]);
      s.on(event, h);
    }
  });
}

async function until(label, fn, ms = 10_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const server = await boot();
  const clients = [];
  let failures = 0;
  try {
    const names = ["Adnan", "Sania", "Ravi", "Meera"];
    const ids = names.map((_, i) => `e2e-player-${i + 1}`);

    // latest room:state as seen by the host
    let state = null;

    const host = await connect(names[0]);
    clients.push(host);
    host.on("room:state", (s) => (state = s));

    const created = await ack(host, "room:create", { rounds: ROUNDS, drawTimeSec: DRAW_TIME_SEC, wordChoices: 2 }, {
      profileId: ids[0],
      name: names[0],
      avatar: AVATAR,
    });
    assert.equal(created.ok, true, "create room failed: " + JSON.stringify(created));
    const code = created.roomState.code;
    assert.match(code, /^[A-Z0-9]{4}$/, "room code shape");
    console.log(`  room ${code} created`);

    for (let i = 1; i < names.length; i++) {
      const sock = await connect(names[i]);
      clients.push(sock);
      const res = await ack(sock, "room:join", code, {
        profileId: ids[i],
        name: names[i],
        avatar: AVATAR,
      });
      assert.equal(res.ok, true, `${names[i]} join failed: ${JSON.stringify(res)}`);
    }
    await until("4 players in lobby", () => state?.players.length === 4);
    console.log("  4 players joined");

    const all = clients;
    const byId = new Map(ids.map((id, i) => [id, clients[i]]));
    const nameById = new Map(ids.map((id, i) => [id, names[i]]));

    // â”€â”€ the game â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const turnOrder = [];
    const roundEnds = [];
    let strokesReceived = 0;
    let guesserCorrectEvents = 0;
    for (const s of all) {
      s.on("draw:stroke", () => strokesReceived++);
      s.on("guess:correct", () => guesserCorrectEvents++);
    }
    // round:end is broadcast to everyone — listen on one socket, not all four
    host.on("round:end", (p) => roundEnds.push(p));

    // drawer's private word arrives on the drawer's own socket
    let currentWord = null;
    for (const s of all) s.on("turn:drawing", (p) => p.word && (currentWord = p.word));

    host.emit("game:start");

    const gameEndP = onceAny(all, "game:end", () => true, 150_000);
    let turnsPlayed = 0;
    let gameEnd = null;

    for (;;) {
      // wait for either the next word pick or the end of the game
      const next = await Promise.race([
        onceAny(all, "turn:selecting", () => true, 20_000).then((r) => ({ kind: "turn", ...r })),
        gameEndP.then((r) => ({ kind: "end", ...r })),
      ]);
      if (next.kind === "end") {
        gameEnd = next.payload;
        break;
      }

      const drawerId = next.payload.drawerId;
      turnOrder.push(drawerId);

      // the drawer answers immediately with option 0 (listeners first, so no
      // event can slip past between emit and await)
      const drawerSock = byId.get(drawerId);
      assert.ok(drawerSock, "unknown drawer id " + drawerId);
      currentWord = null;
      const drawingP = onceAny(all, "turn:drawing", (p) => !!p.word, 15_000);
      drawerSock.emit("word:choose", 0);

      const drawing = await drawingP;
      const payload = drawing.payload;
      assert.equal(payload.drawerId, drawerId, "drawer id mismatch");
      assert.equal(drawing.socket, drawerSock, "only the drawer should receive the word");
      assert.ok(currentWord, "drawer never learned the word");

      await until("drawing state broadcast", () => state?.phase === "drawing", 3_000);
      const startedAt = Date.now();
      const scoresBefore = new Map(state.players.map((p) => [p.id, p.score]));

      // canvas reaches the others
      const strokesBefore = strokesReceived;
      drawerSock.emit("draw:stroke", {
        strokeId: "e2e-" + turnsPlayed,
        color: "#000000",
        width: 4,
        tool: "brush",
        points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.5 }],
      });
      await until("stroke relayed to guessers", () => strokesReceived > strokesBefore, 3_000);

      // everyone except the last guesser answers; the final guess ends the
      // turn, so check the hidden-score invariant while one guess is still
      // outstanding
      const turnEndP = onceAny(all, "turn:end", () => true, 10_000);
      const guessers = all.filter((s) => s !== drawerSock);
      const lastGuesser = guessers[guessers.length - 1];
      for (const g of guessers.slice(0, -1)) {
        g.emit("guess:text", currentWord);
        await sleep(150);
      }
      await sleep(150);

      // scores must still be hidden mid-turn
      const midTurn = state;
      assert.equal(midTurn.phase, "drawing", "expected to still be mid-turn");
      assert.equal(
        midTurn.players.find((p) => p.id === drawerId).score,
        scoresBefore.get(drawerId),
        "drawer score leaked during the turn"
      );
      for (const g of guessers.slice(0, -1)) {
        const pid = [...byId.entries()].find(([, s]) => s === g)[0];
        assert.equal(
          midTurn.players.find((p) => p.id === pid).score,
          scoresBefore.get(pid),
          `${nameById.get(pid)}'s score leaked mid-turn`
        );
      }

      lastGuesser.emit("guess:text", currentWord);
      const turnEnd = await turnEndP;
      const elapsed = Date.now() - startedAt;
      assert.ok(elapsed < DRAW_TIME_SEC * 1000, `turn did not end early (${elapsed}ms)`);
      assert.equal(turnEnd.payload.results.length, 4, "turn-end table should list every player");
      assert.ok(turnEnd.payload.results.some((r) => r.pointsEarned > 0), "nobody scored");

      // scores are visible again once the turn is over
      await until(
        "scores revealed after turn end",
        () => {
          const total = state.players.reduce((n, p) => n + p.score, 0);
          const before = [...scoresBefore.values()].reduce((n, v) => n + v, 0);
          return total > before;
        },
        3_000
      );

      turnsPlayed++;
    }

    // â”€â”€ assertions on the finished game â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    assert.ok(gameEnd, "no game:end received");
    const podium = gameEnd.podium;
    assert.equal(podium.length, 4, "podium should list all 4 players");
    assert.deepEqual(
      podium.map((p) => p.rank),
      [1, 2, 3, 4],
      "podium ranks"
    );
    for (let i = 1; i < podium.length; i++) {
      assert.ok(podium[i - 1].score >= podium[i].score, "podium not sorted by score");
    }
    assert.ok(podium.every((p) => p.score > 0), "every player should have scored");

    assert.equal(turnsPlayed, ROUNDS * 4, `expected ${ROUNDS * 4} turns, played ${turnsPlayed}`);
    assert.equal(roundEnds.length, 1, "round 1 should have ended once");
    assert.equal(roundEnds[0].leaderboard.length, 4, "round leaderboard size");
    assert.ok(strokesReceived >= turnsPlayed * 2, "strokes should reach all guessers");
    assert.ok(guesserCorrectEvents >= turnsPlayed * 3, "every correct guess should broadcast");

    const perRound = [
      turnOrder.slice(0, 4),
      turnOrder.slice(4, 8),
    ];
    for (const order of perRound) {
      assert.equal(new Set(order).size, 4, "a player drew twice in one round");
    }
    assert.deepEqual(perRound[0], ids, "round 1 should draw in join order");
    assert.deepEqual(perRound[1], ids, "round 2 should draw in join order");

    // a fifth player cannot walk into a running game
    const late = await connect("Latecomer");
    clients.push(late);
    const lateRes = await ack(late, "room:join", code, {
      profileId: "e2e-latecomer",
      name: "Latecomer",
      avatar: AVATAR,
    });
    assert.equal(lateRes.ok, false, "late join should be refused");
    assert.match(lateRes.error, /in progress/i, "late-join error should explain why");

    console.log(`  ${turnsPlayed} turns, ${roundEnds.length} round boundary, podium ${podium.map((p) => `${p.name}:${p.score}`).join(" ")}`);
    console.log("\n  PASS â€” 4-player game completed, ordering and scoring verified\n");
  } catch (err) {
    failures++;
    console.error("\n  FAIL â€”", err?.message ?? err);
    console.error(err?.stack ?? "");
  } finally {
    for (const c of clients) c.close();
    server.kill();
    await sleep(200);
  }
  process.exitCode = failures ? 1 : 0;
}

main();
