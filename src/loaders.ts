import { CONFIG } from "./config.js";
import type { ImglyModule, PoseLandmarkerLike, VisionModule } from "./types.js";

let imglyPromise: Promise<ImglyModule> | null = null;
let posePromise: Promise<PoseLandmarkerLike | null> | null = null;

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
