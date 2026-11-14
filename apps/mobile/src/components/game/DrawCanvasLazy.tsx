/** Native (Android/iOS): Skia is a native module — no WASM loading needed. */
import { DrawCanvas } from "./DrawCanvas";

export const DrawCanvasLazy = DrawCanvas;
export type { DrawCanvasProps } from "./DrawCanvas";
