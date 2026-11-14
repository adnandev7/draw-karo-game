/**
 * Typed socket.io client for the Draw Karo game server.
 *
 * Server URL resolution:
 *  1. EXPO_PUBLIC_GAME_SERVER env (e.g. http://192.168.1.5:4000 for a phone on LAN)
 *  2. http://localhost:4000 — works on web, and on Android/iOS via `adb reverse tcp:4000 tcp:4000`
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@drawkaro/shared";

export const SERVER_URL: string =
  process.env.EXPO_PUBLIC_GAME_SERVER ?? "http://localhost:4000";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: GameSocket = io(SERVER_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
