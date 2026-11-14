/**
 * M1 integration test — simulates 3 players playing a fast game over real sockets.
 * Run: node scripts/simulate.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const PORT = 4599;
const SERVER_URL = `http://localhost:${PORT}`;
const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));
const DEBUG = process.env.SIM_DEBUG === "1";

const results = [];
function check(name, cond) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "✅" : "❌"} ${name}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeClient(name) {
  const c = io(SERVER_URL, { transports: ["websocket"], reconnection: false });
  if (DEBUG) {
    c.onAny((ev, ...args) => console.log(`  [${name}] <<< ${ev}`, JSON.stringify(args).slice(0, 160)));
  }
  return c;
}

async function main() {
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  await sleep(1200);

  const [alice, bob, carol] = [makeClient("alice"), makeClient("bob"), makeClient("carol")];
  const profile = (name) => ({
    profileId: `test-${name}-${Math.random().toString(36).slice(2)}`,
    name,
    avatar: {
      skinTone: "#c68642",
      expression: "grin",
      hairstyle: "short-black",
      accessory: "none",
      outfitColor: "#f4a300",
    },
  });

  const pa = profile("Alice");
  const pb = profile("Bob");
  const pc = profile("Carol");

  const created = await new Promise((res) =>
    alice.emit("room:create", { rounds: 1, drawTimeSec: 12 }, pa, res)
  );
  check("room:create returns state with code", created.ok && created.roomState.code.length === 4);
  const CODE = created.ok ? created.roomState.code : "";

  const joined = await new Promise((res) => bob.emit("room:join", CODE, pb, res));
  check("bob joins", joined.ok && joined.roomState.players.length === 2);
  const joined2 = await new Promise((res) => carol.emit("room:join", CODE, pc, res));
  check("carol joins", joined2.ok && joined2.roomState.players.length === 3);

  let startedRound = null;
  alice.on("game:started", (r) => (startedRound = r));
  alice.emit("game:start");
  await sleep(400);
  check("game:started received", startedRound === 1);

  const strokesReceived = { alice: 0, bob: 0, carol: 0 };
  bob.on("draw:stroke", () => strokesReceived.bob++);
  carol.on("draw:stroke", () => strokesReceived.carol++);
  alice.on("draw:stroke", () => strokesReceived.alice++);

  const turnEnds = [];
  for (const [c, p] of [
    [alice, "Alice"],
    [bob, "Bob"],
    [carol, "Carol"],
  ]) {
    c.on("turn:selecting", (payload) => {
      if (DEBUG) console.log(`  [${p}] selecting, words=${JSON.stringify(payload.words)}`);
      if (payload.words) c.emit("word:choose", 0);
    });
    c.on("turn:drawing", (payload) => {
      if (DEBUG) console.log(`  [${p}] drawing, word=${payload.word ?? "(hidden)"}`);
      if (payload.word) {
        setTimeout(() => c.emit("chat:msg", payload.word), 400);
        setTimeout(() => {
          c.emit("draw:stroke", {
            strokeId: "s1",
            color: "#000000",
            width: 0.01,
            tool: "brush",
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.2 },
            ],
          });
        }, 600);
      }
    });
    c.on("turn:end", (payload) => {
      if (DEBUG) console.log(`  [${p}] turn:end word=${payload.word}`);
      turnEnds.push(payload);
    });
  }

  // guessers pick up the leaked word from chat
  bob.on("chat:entry", (e) => {
    if (e.kind === "chat" && e.playerId !== pb.profileId) bob.emit("guess:text", e.text);
  });
  carol.on("chat:entry", (e) => {
    if (e.kind === "chat" && e.playerId !== pc.profileId) carol.emit("guess:text", e.text);
  });

  let roundEnd = null;
  let gameEnd = null;
  alice.on("round:end", (p) => (roundEnd = p));
  alice.on("game:end", (p) => (gameEnd = p));

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && (!gameEnd || turnEnds.length < 3)) {
    await sleep(500);
  }

  console.log("turn words:", turnEnds.map((t) => t.word).join(" | "));
  check("3 turns completed", new Set(turnEnds.map((t) => t.word)).size === 3);
  check("turn ends reveal words", turnEnds.length > 0 && turnEnds.every((t) => t.word.length > 0));
  check("strokes broadcast to guessers", strokesReceived.bob + strokesReceived.carol + strokesReceived.alice >= 3);
  check("round:end received with leaderboard", roundEnd && roundEnd.leaderboard.length === 3);
  check("game:end podium received", gameEnd && gameEnd.podium.length === 3);
  const totalPoints = gameEnd ? gameEnd.podium.reduce((s, e) => s + e.score, 0) : 0;
  check("points are non-zero and conserved", totalPoints > 0);

  alice.close();
  bob.close();
  carol.close();
  server.kill();
  await sleep(300);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("SIMULATION CRASHED:", err);
  process.exit(1);
});
