/** Native: Skia is compiled in — nothing to preload. */
export function preloadSkiaWeb(): Promise<void> {
  return Promise.resolve();
}

/** Kept for type parity with skiaLoader.web.ts (unused on native). */
export const skiaWebOpts = {};
