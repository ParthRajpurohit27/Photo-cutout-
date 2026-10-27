import { CONFIG } from "./config.js";
import type { ImglyModule, ImglyRemoveConfig, PoseLandmarkerLike, VisionModule } from "./types.js";

/** One config for preload and every removeBackground call, so the same model is used everywhere. */
export const IMGLY_CONFIG: ImglyRemoveConfig = {
  model: CONFIG.bgModel,
  output: { format: "image/png" },
};

let imglyPromise: Promise<ImglyModule> | null = null;
let posePromise: Promise<PoseLandmarkerLike | null> | null = null;
let modelPromise: Promise<void> | null = null;

export function loadImgly(): Promise<ImglyModule> {
  if (!imglyPromise) {
    const url: string = CONFIG.imglyUrl;
    imglyPromise = import(url) as Promise<ImglyModule>;
  }
  return imglyPromise;
}

/** Returns null if pose detection can't be loaded (we then fall back to a heuristic). */
export function loadPose(): Promise<PoseLandmarkerLike | null> {
  if (!posePromise) {
    posePromise = (async (): Promise<PoseLandmarkerLike | null> => {
      try {
        const url: string = CONFIG.visionUrl;
        const vision = (await import(url)) as VisionModule;
        const fileset = await vision.FilesetResolver.forVisionTasks(CONFIG.visionWasmUrl);
        return await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: CONFIG.poseModelUrl },
          runningMode: "IMAGE",
          numPoses: 1,
        });
      } catch {
        return null;
      }
    })();
  }
  return posePromise;
}

// ---- AI model download tracking (real bytes + real speed, used for the live ETA) ----

export interface ModelState {
  started: boolean;
  done: boolean;
  loaded: number;
  total: number;
  bytesPerSec: number;
  startedAt: number;
  firstByteAt: number;
}

export const modelState: ModelState = {
  started: false,
  done: false,
  loaded: 0,
  total: 0,
  bytesPerSec: 0,
  startedAt: 0,
  firstByteAt: 0,
};

const files = new Map<string, { current: number; total: number }>();
const nowS = (): number => performance.now() / 1000;

/** Starts downloading the background-removal model (safe to call many times). */
export function preloadModel(): Promise<void> {
  if (!modelPromise) {
    modelState.started = true;
    modelState.startedAt = nowS();
    modelPromise = (async (): Promise<void> => {
      try {
        const imgly = await loadImgly();
        if (imgly.preload) {
          await imgly.preload({
            ...IMGLY_CONFIG,
            progress: (key: string, current: number, total: number): void => {
              if (!key.startsWith("fetch")) return;
              files.set(key, { current, total });
              let l = 0;
              let t = 0;
              files.forEach((v) => {
                l += v.current;
                t += v.total;
              });
              const now = nowS();
              if (modelState.firstByteAt === 0) modelState.firstByteAt = now;
              modelState.loaded = l;
              modelState.total = t;
              const dt = now - modelState.firstByteAt;
              if (dt > 0.5) modelState.bytesPerSec = l / dt;
            },
          });
        }
      } catch {
        /* the real error (if any) shows up when we actually remove the background */
      } finally {
        modelState.done = true;
      }
    })();
  }
  return modelPromise;
}

export function modelFraction(): number {
  if (modelState.done) return 1;
  return modelState.total > 0 ? Math.min(1, modelState.loaded / modelState.total) : 0;
}

/** Seconds of model download still left, from the measured speed (or a connection-based guess). */
export function modelRemainingSeconds(): number {
  if (modelState.done) return 0;
  if (modelState.total > 0 && modelState.bytesPerSec > 0) {
    return Math.max(0.3, (modelState.total - modelState.loaded) / modelState.bytesPerSec);
  }
  const conn = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  const mbps = Math.max(1, conn?.downlink ?? 15);
  const guess = Math.min(150, (CONFIG.estimatedModelMb * 8) / mbps);
  const since = modelState.started ? nowS() - modelState.startedAt : 0;
  return Math.max(2, guess - since);
}
