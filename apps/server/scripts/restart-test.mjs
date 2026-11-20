#!/usr/bin/env node
/**
 * Restart drill: a room must survive the server process dying.
 *
 *   boot with PERSIST_DIR → play half a turn → SIGKILL → boot again
 *   → reconnect with the same profile IDs → the room, scores and turn are back
 *
 * SIGKILL is deliberate: it skips the SIGTERM flush, so this only passes if the
 * throttled background snapshots are doing the job. A second pass checks the
 * graceful path (SIGTERM flushes immediately).
 *
 * Run: node apps/server/scripts/restart-test.mjs
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const PORT = 4101;
const URL = `http://127.0.0.1:${PORT}`;
const AVATAR = {
  skinTone: "#f25c54",
  expression: "happy",
  mouth: "squiggle",
  hairstyle: "none",
  accessory: "none",
  outfitColor: "#f25c54",
};
const NAMES = ["Adnan", "Sania", "Ravi"];
const IDS = ["drill-player-1", "drill-player-2", "drill-player-3"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(dir) {
  const proc = spawn(process.execPath, ["apps/server/dist/index.js"], {
    env: { ...process.env, PORT: String(PORT), CORS_ORIGIN: "*", PERSIST_DIR: dir, UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (process.env.VERBOSE) proc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[server!] ${d}`));
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${URL}/health`);
      if (res.ok) return { proc, health: await res.json() };
    } catch {
      /* not up yet */
    }
    await wait(250);
  }
  throw new Error("server did not come up");
}

function connect() {
  const sock = io(URL, { transports: ["websocket"], reconnection: false, timeout: 5_000 });
  sock.on("connect_error", () => {});
  return new Promise((resolve, reject) => {
    sock.once("connect", () => resolve(sock));
    sock.once("connect_error", reject);
  });
}

function ack(sock, event, ...args) {
  return new Promise((resolve, reject) => {
    sock.timeout(5_000).emit(event, ...args, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

function onceAny(socks, event, pred = () => true, ms = 20_000) {
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

async function until(label, fn, ms = 15_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await wait(100);
  }
  throw new Error("timed out waiting for " + label);
}

async function openPlayers() {
  return Promise.all(NAMES.map(() => connect()));
}

async function joinAll(code, sockets) {
  const states = [];
  for (let i = 0; i < sockets.length; i++) {
    const res = await ack(sockets[i], "room:join", code, {
      profileId: IDS[i],
      name: NAMES[i],
      avatar: AVATAR,
    });
    assert.equal(res.ok, true, `${NAMES[i]} could not rejoin after restart: ${JSON.stringify(res)}`);
    states.push(res.roomState);
  }
  return states;
}

let failures = 0;
async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "drawkaro-restart-"));
  let servers = [];
  let clients = [];
  try {
    // ── first life ─────────────────────────────────────────────────────────
    const first = await boot(dir);
    servers.push(first.proc);
    assert.equal(first.health.persistent, true, "health should report a persistent store");

    const host = await connect();
    clients.push(host);
    let state = null;
    host.on("room:state", (s) => (state = s));

    const created = await ack(host, "room:create", { rounds: 1, drawTimeSec: 30, wordChoices: 2 }, {
      profileId: IDS[0],
      name: NAMES[0],
      avatar: AVATAR,
    });
    assert.equal(created.ok, true, "create failed");
    const code = created.roomState.code;

    for (let i = 1; i < NAMES.length; i++) {
      const sock = await connect();
      clients.push(sock);
      const res = await ack(sock, "room:join", code, {
        profileId: IDS[i],
        name: NAMES[i],
        avatar: AVATAR,
      });
      assert.equal(res.ok, true, "join failed");
    }

    const all = [...clients];
    host.emit("game:start");

    const selected = await onceAny(all, "turn:selecting", () => true, 15_000);
    const drawerId = selected.payload.drawerId;
    const drawerSock = all[IDS.indexOf(drawerId)];
    assert.ok(drawerSock, "drawer socket not found");

    const drawingP = onceAny(all, "turn:drawing", (p) => !!p.word, 15_000);
    drawerSock.emit("word:choose", 0);
    const drawing = await drawingP;
    const word = drawing.payload.word;

    // one guesser scores; the other stays silent so the turn is still live at
    // the moment the process dies
    const guessers = all.filter((s) => s !== drawerSock);
    const scorer = guessers[0];
    const scorerId = IDS[all.indexOf(scorer)];
    const correctP = onceAny(all, "guess:correct", (p) => p.playerId === scorerId, 5_000);
    scorer.emit("guess:text", word);
    const correct = await correctP;
    const scoredPoints = correct.payload.points;
    assert.ok(scoredPoints > 0, "guesser should have scored");

    // wait until a snapshot exists that contains that score
    const snapshotFile = path.join(dir, `room-${code}.json`);
    await until(
      "snapshot with the guess in it",
      async () => {
        try {
          const snap = JSON.parse(await fs.readFile(snapshotFile, "utf8"));
          const p = snap.players?.find((x) => x.id === scorerId);
          return !!p && p.score === scoredPoints;
        } catch {
          return false;
        }
      },
      15_000
    );

    // ── kill it hard ───────────────────────────────────────────────────────
    first.proc.kill("SIGKILL");
    for (const c of clients) c.close();
    clients = [];
    await wait(800);

    // ── second life ────────────────────────────────────────────────────────
    const second = await boot(dir);
    servers.push(second.proc);
    assert.equal(second.health.persistent, true, "restarted server should still be persistent");
    assert.ok(second.health.restored >= 1, `expected a restored room, got ${second.health.restored}`);

    const revived = await openPlayers();
    clients = revived;
    // listen before joining: resuming a mid-drawing room emits turn:end inside
    // the join itself, before the ack comes back
    const turnEndP = onceAny(revived, "turn:end", () => true, 10_000);
    const revivedStates = await joinAll(code, revived);

    // joining a room that was mid-drawing settles the aborted turn...
    const turnEnd = await turnEndP;
    assert.equal(turnEnd.payload.results.length, NAMES.length, "turn-end table after restore");
    assert.equal(turnEnd.payload.word, word, "the restored turn should be the same word");

    const stateAfter = revivedStates[revivedStates.length - 1];
    assert.equal(stateAfter.players.length, NAMES.length, "players after restore");
    const scorerRow = stateAfter.players.find((p) => p.id === scorerId);
    assert.ok(scorerRow, "scorer seat missing after restore");
    assert.ok(scorerRow.score >= scoredPoints, `score lost in restart: ${scorerRow.score} < ${scoredPoints}`);

    // ...and the game carries on with the next drawer
    const nextPick = await onceAny(revived, "turn:selecting", () => true, 15_000);
    assert.ok(nextPick.payload.drawerId, "no drawer after resume");

    // ── graceful path: SIGTERM writes immediately ──────────────────────────
    second.proc.kill("SIGTERM");
    for (const c of revived) c.close();
    await wait(1500);
    const third = await boot(dir);
    servers.push(third.proc);
    assert.ok(third.health.restored >= 1, "SIGTERM should have flushed the room");
    const thirdSockets = await openPlayers();
    clients = thirdSockets;
    const finalStates = await joinAll(code, thirdSockets);
    const finalState = finalStates[finalStates.length - 1];
    assert.equal(finalState.players.length, NAMES.length, "players after graceful restart");

    console.log(
      `  room ${code}: killed → restored (${second.health.restored}) → SIGTERM → restored (${third.health.restored}), 3 players intact`
    );
    console.log("\n  PASS — room, scores and turn survived a hard restart\n");
  } catch (err) {
    failures++;
    console.error("\n  FAIL —", err?.message ?? err);
    console.error(err?.stack ?? "");
  } finally {
    for (const c of clients) c.close();
    for (const s of servers) s.kill("SIGKILL");
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
  process.exitCode = failures ? 1 : 0;
}

main();
