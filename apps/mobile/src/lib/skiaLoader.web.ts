/**
 * Web: preload CanvasKit (Skia WASM) at app boot, before any route
 * that uses Skia gets evaluated by Expo Router.
 *
 * Metro does not serve node_modules' .wasm at the path canvaskit expects
 * (the fetch returns an HTML page instead), so we ship the wasm ourselves
 * in public/canvaskit and tell CanvasKitInit to load it from there.
 */
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export const skiaWebOpts = {
  locateFile: (file: string) => `/canvaskit/${file}`,
};

export function preloadSkiaWeb(): Promise<void> {
  return LoadSkiaWeb(skiaWebOpts);
}
