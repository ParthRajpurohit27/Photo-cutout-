import { CONFIG } from "./config.js";
/** One config for preload and every removeBackground call, so the same model is used everywhere. */
export const IMGLY_CONFIG = {
    model: CONFIG.bgModel,
    output: { format: "image/png" },
};
let imglyPromise = null;
let posePromise = null;
let modelPromise = null;
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
export const modelState = {
    started: false,
    done: false,
    loaded: 0,
    total: 0,
    bytesPerSec: 0,
    startedAt: 0,
    firstByteAt: 0,
};
const files = new Map();
const nowS = () => performance.now() / 1000;
/** Starts downloading the background-removal model (safe to call many times). */
export function preloadModel() {
    if (!modelPromise) {
        modelState.started = true;
        modelState.startedAt = nowS();
        modelPromise = (async () => {
            try {
                const imgly = await loadImgly();
                if (imgly.preload) {
                    await imgly.preload({
                        ...IMGLY_CONFIG,
                        progress: (key, current, total) => {
                            if (!key.startsWith("fetch"))
                                return;
                            files.set(key, { current, total });
                            let l = 0;
                            let t = 0;
                            files.forEach((v) => {
                                l += v.current;
                                t += v.total;
                            });
                            const now = nowS();
                            if (modelState.firstByteAt === 0)
                                modelState.firstByteAt = now;
                            modelState.loaded = l;
                            modelState.total = t;
                            const dt = now - modelState.firstByteAt;
                            if (dt > 0.5)
                                modelState.bytesPerSec = l / dt;
                        },
                    });
                }
            }
            catch {
                /* the real error (if any) shows up when we actually remove the background */
            }
            finally {
                modelState.done = true;
            }
        })();
    }
    return modelPromise;
}
export function modelFraction() {
    if (modelState.done)
        return 1;
    return modelState.total > 0 ? Math.min(1, modelState.loaded / modelState.total) : 0;
}
/** Seconds of model download still left, from the measured speed (or a connection-based guess). */
export function modelRemainingSeconds() {
    if (modelState.done)
        return 0;
    if (modelState.total > 0 && modelState.bytesPerSec > 0) {
        return Math.max(0.3, (modelState.total - modelState.loaded) / modelState.bytesPerSec);
    }
    const conn = navigator.connection;
    const mbps = Math.max(1, conn?.downlink ?? 15);
    const guess = Math.min(150, (CONFIG.estimatedModelMb * 8) / mbps);
    const since = modelState.started ? nowS() - modelState.startedAt : 0;
    return Math.max(2, guess - since);
}
