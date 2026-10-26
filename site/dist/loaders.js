import { CONFIG } from "./config.js";
let imglyPromise = null;
let posePromise = null;
export function loadImgly() {
    if (!imglyPromise) {
        const url = CONFIG.imglyUrl;
        imglyPromise = import(url);
    }
    return imglyPromise;
}
/** Returns null if pose detection can't be loaded (we then fall back to a heuristic). */
export function loadPose() {
    if (!posePromise) {
        posePromise = (async () => {
            try {
                const url = CONFIG.visionUrl;
                const vision = (await import(url));
                const fileset = await vision.FilesetResolver.forVisionTasks(CONFIG.visionWasmUrl);
                return await vision.PoseLandmarker.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: CONFIG.poseModelUrl },
                    runningMode: "IMAGE",
                    numPoses: 1,
                });
            }
            catch {
                return null;
            }
        })();
    }
    return posePromise;
}
