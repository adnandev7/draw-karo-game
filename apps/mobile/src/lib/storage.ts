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

let impl: KV;

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
} else {
  // Lazy require keeps the web bundle free of native imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require("react-native-mmkv");
  const mmkv = new MMKV({ id: "draw-karo" });
  impl = {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    delete: (key) => mmkv.delete(key),
  };
}

export function storageGet(key: string): string | undefined {
  return impl.getString(key);
}

export function storageSet(key: string, value: string): void {
  impl.set(key, value);
}
