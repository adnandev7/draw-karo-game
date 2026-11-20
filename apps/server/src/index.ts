/**
 * Draw Karo — authoritative game server (M1).
 * HTTP health check + Socket.IO wiring to the room state machine.
 */
import http from "node:http";
import cors from "cors";
import express, { type Express } from "express";
import { Server } from "socket.io";
import type { ClientToServerEvents, RoomSettings, ServerToClientEvents } from "@drawkaro/shared";
import { RoomManager, type SocketData, type Profile } from "./room";
import { createStore } from "./persist";

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app: Express = express();
app.use(cors({ origin: CORS_ORIGIN }));

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>(
  httpServer,
  {
    cors: { origin: CORS_ORIGIN },
    pingInterval: 10_000,
    pingTimeout: 20_000,
  }
);

const rooms = new RoomManager(io, createStore());
setInterval(() => rooms.sweep(), 30_000).unref();
let restoredRooms = 0;

// Health check — used by Render / uptime monitors. Defined after io init so
// the room count is live. `persistent` says whether rooms survive a restart.
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "draw-karo-server",
    rooms: rooms.count,
    paused: rooms.pausedCount,
    persistent: rooms.persistent,
    restored: restoredRooms,
    time: new Date().toISOString(),
  });
});

io.on("connection", (socket) => {
  let roomCode: string | null = null;

  const withRoom = () => (roomCode ? rooms.get(roomCode) ?? null : null);

  socket.on("room:create", (settings, profile, cb) => {
    if (!validProfile(profile)) return cb({ ok: false, error: "Invalid profile" });
    const room = rooms.create();
    const res = room.join(socket, profile, true);
    if (!res.ok) {
      room.destroy();
      return cb(res);
    }
    if (settings && typeof settings === "object") {
      room.updateSettings({ ...settings } as Partial<RoomSettings>);
    }
    roomCode = room.code;
    console.log(`[rooms] ${room.code} created by ${profile.name}`);
    cb(res);
  });

  socket.on("room:join", (code, profile, cb) => {
    if (!validProfile(profile)) return cb({ ok: false, error: "Invalid profile" });
    const room = rooms.get(String(code));
    if (!room) return cb({ ok: false, error: "Room not found — double-check the code" });
    const res = room.join(socket, profile, false);
    if (res.ok) roomCode = room.code;
    cb(res);
  });

  socket.on("room:leave", () => {
    const room = withRoom();
    if (room && socket.data.profileId) {
      room.playerDisconnected(socket.data.profileId, true);
    }
    if (roomCode) socket.leave(`room:${roomCode}`);
    roomCode = null;
  });

  socket.on("room:settings", (patch) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    const host = room.players.get(socket.data.profileId);
    if (!host?.isHost) return;
    room.updateSettings(patch);
  });

  socket.on("game:start", () => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    const host = room.players.get(socket.data.profileId);
    if (!host?.isHost) return;
    const res = room.startGame();
    if (!res.ok && res.error) {
      socket.emit("error", { code: "start_failed", message: res.error });
    }
  });

  socket.on("word:choose", (index) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.chooseWord(index);
  });

  socket.on("draw:stroke", (delta) => {
    const room = withRoom();
    if (!room || !socket.data.profileId || !delta) return;
    room.addStrokeBatch(socket.data.profileId, delta);
  });

  socket.on("draw:fill", (fill) => {
    const room = withRoom();
    if (!room || !socket.data.profileId || !fill) return;
    room.addFill(socket.data.profileId, fill);
  });

  socket.on("draw:undo", () => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.undoStroke(socket.data.profileId);
  });

  socket.on("draw:clear", () => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.clearStrokes(socket.data.profileId);
  });

  socket.on("guess:text", (text) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.submitGuess(socket.data.profileId, String(text ?? ""));
  });

  socket.on("chat:msg", (text) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.chatMessage(socket.data.profileId, String(text ?? ""));
  });

  socket.on("reaction:send", (emoji) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.sendReaction(socket.data.profileId, String(emoji ?? ""));
  });

  socket.on("draw:rate", (rating) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.rateDrawing(socket.data.profileId, rating === "dislike" ? "dislike" : "like");
  });

  socket.on("host:kick", (playerId) => {
    const room = withRoom();
    if (!room || !socket.data.profileId) return;
    room.kick(socket.data.profileId, String(playerId ?? ""));
  });

  socket.on("host:mute", () => {
    // M4 (voice) — reserved
  });

  socket.on("disconnect", () => {
    const room = withRoom();
    if (room && socket.data.profileId) {
      room.playerDisconnected(socket.data.profileId, false);
    }
  });
});

function validProfile(p: Profile | undefined): p is Profile {
  return (
    !!p &&
    typeof p.profileId === "string" &&
    p.profileId.length >= 8 &&
    typeof p.name === "string" &&
    p.name.trim().length >= 1 &&
    !!p.avatar
  );
}

// Restore persisted rooms before accepting traffic, so the first join lands
// in the room it expects instead of racing the hydration.
void (async () => {
  restoredRooms = await rooms.hydrate();
  httpServer.listen(PORT, () => {
    console.log(`[draw-karo] server listening on :${PORT}`);
  });
})();

/**
 * Render sends SIGTERM on deploy with a grace window: flush every dirty room
 * so a restart loses at most the last few seconds of strokes.
 */
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[draw-karo] ${signal} — flushing rooms`);
  try {
    await rooms.flushAll();
  } catch (err) {
    console.warn(`[persist] flush failed: ${(err as Error).message}`);
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
