// Test player 2 — joins <roomCode> over a real socket and plays properly:
// - as drawer: picks word, leaks it via drawer-chat (so the browser can guess)
// - as guesser: guesses whatever the other player types in chat
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", { transports: ["websocket"] });
const ROOM = process.argv[2] || "4YMS";
const profile = {
  profileId: "test-rani-playtest-01",
  name: "TestRani",
  avatar: { skinTone: "#c68642", expression: "grin", hairstyle: "braid", accessory: "none", outfitColor: "#e5484d" },
};

socket.on("connect", () => {
  socket.emit("room:join", ROOM, profile, (res) => {
    console.log("JOIN", ROOM + ":", res.ok ? "ok" : res.error);
  });
});

socket.on("room:state", (s) => {
  console.log(`STATE phase=${s.phase} players=${s.players.length} t=${Math.round(s.timeLeftMs / 1000)}s`);
});

socket.on("turn:selecting", (p) => {
  if (p.words) {
    console.log("I AM CHOOSING:", p.words.join(" | "));
    socket.emit("word:choose", 0);
  }
});

socket.on("turn:drawing", (p) => {
  if (p.word) {
    console.log("I AM DRAWING, word:", p.word);
    // leak the word via drawer chat so the browser guesser can find it
    setTimeout(() => socket.emit("chat:msg", p.word), 1500);
    // draw something so remote stroke rendering can be verified
    let x = 0.2;
    const timer = setInterval(() => {
      socket.emit("draw:stroke", {
        strokeId: "remote-rani",
        color: "#e5484d",
        width: 0.018,
        tool: "brush",
        points: [
          { x, y: 0.25 + 0.2 * Math.abs(Math.sin(x * 20)) },
          { x: x + 0.02, y: 0.3 + 0.2 * Math.abs(Math.sin(x * 20)) },
        ],
      });
      x += 0.04;
      if (x > 0.8) clearInterval(timer);
    }, 200);
  }
});

socket.on("chat:entry", (e) => {
  if (e.kind === "chat" && e.playerId !== profile.profileId) {
    socket.emit("guess:text", e.text);
    console.log("GUESSING:", e.text);
  }
});

socket.on("guess:correct", (p) => console.log("GUESS CORRECT by", p.playerId, "+", p.points));
socket.on("turn:end", (p) => console.log("TURN END, word was:", p.word));
socket.on("round:end", (p) => console.log("ROUND END", JSON.stringify(p.leaderboard)));
socket.on("disconnect", () => console.log("disconnected"));

setTimeout(() => {
  socket.emit("room:leave");
  process.exit(0);
}, 240_000);
