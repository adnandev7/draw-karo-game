/**
 * Key-value storage that works on Android/iOS (MMKV) and web (localStorage).
 * MMKV needs native code → unavailable on web; this wrapper keeps one API.
 */
import { Platform } from "react-native";

type KV = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

type Scope = "local" | "session";

let impl: KV;
let sessionImpl: KV | null = null; // web only

if (Platform.OS === "web") {
  impl = {
    getString: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set: (key, value) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    delete: (key) => {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
  sessionImpl = {
    getString: (key) => {
      try {
        return globalThis.sessionStorage?.getItem(key) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set: (key, value) => {
      try {
        globalThis.sessionStorage?.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    delete: (key) => {
      try {
        globalThis.sessionStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
} else {
  // Lazy require keeps the web bundle free of native imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mmkv: { getString: (k: string) => string | undefined; set: (k: string, v: string) => void; delete: (k: string) => void } | null = null;
  try {
    const { MMKV } = require("react-native-mmkv");
    mmkv = new MMKV({ id: "draw-karo" });
  } catch (e) {
    console.warn("MMKV unavailable, falling back to in-memory storage:", e);
    mmkv = null;
  }
  const mem = new Map<string, string>();
  impl = {
    getString: (key) => (mmkv ? mmkv.getString(key) : mem.get(key)),
    set: (key, value) => {
      if (mmkv) mmkv.set(key, value);
      else mem.set(key, value);
    },
    delete: (key) => {
      if (mmkv) mmkv.delete(key);
      else mem.delete(key);
    },
  };
}

/**
 * Web: "session" scope reads/writes sessionStorage (per browser tab — each
 * tab is its own player); "local" persists across tabs. Native: both are MMKV
 * (one player per device).
 */
export function storageGet(key: string, scope: Scope = "local"): string | undefined {
  return (scope === "session" ? sessionImpl : impl)?.getString(key);
}

export function storageSet(key: string, value: string, scope: Scope = "local"): void {
  (scope === "session" ? sessionImpl : impl)?.set(key, value);
}
