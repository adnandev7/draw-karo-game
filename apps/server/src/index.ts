/**
 * Draw Karo — authoritative game server (M0 skeleton).
 *
 * M0 scope: HTTP health check + Socket.IO wiring + connection lifecycle.
 * The full room manager / state machine lands in M1 — the socket contract
 * (@drawkaro/shared) is already wired here so events can be filled in one by one.
 */
import http from "node:http";
import cors from "cors";
import express from "express";
import { Server, type Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@drawkaro/shared";

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

type InterServerEvents = Record<string, never>;
type SocketData = { playerName?: string; roomCode?: string };

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

// Health check — used by Render / uptime monitors.
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "draw-karo-server", time: new Date().toISOString() });
});

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: { origin: CORS_ORIGIN },
    pingInterval: 10_000,
    pingTimeout: 20_000,
  }
);

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
  const who = socket.id;
  console.log(`[socket] connected: ${who}`);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${who} (${reason})`);
  });

  // M1: room:create / room:join / game flow handlers go here.
});

httpServer.listen(PORT, () => {
  console.log(`[draw-karo] server listening on :${PORT}`);
});
