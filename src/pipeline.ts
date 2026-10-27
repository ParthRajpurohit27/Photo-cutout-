import { analyzeBody, extendBody } from "./body.js";
import { composeFinal } from "./compose.js";
import { CONFIG } from "./config.js";
import { alphaBounds, blobToCanvas, canvasToBlob, cropCanvas, fitMax } from "./imaging.js";
import { IMGLY_CONFIG, loadImgly, loadPose, preloadModel } from "./loaders.js";
import type { Reporter } from "./types.js";

export async function buildComposite(file: File, base: HTMLCanvasElement, rep: Reporter): Promise<Blob> {
  rep.enter("read", "Reading your photo…");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const src = fitMax(bmp, CONFIG.visitorMaxSide);
  bmp.close();

  rep.enter("model", "Waking up the AI…");
  await Promise.all([preloadModel(), loadPose()]);
  const imgly = await loadImgly();

  rep.enter("segment", "Cutting you out of the background…");
  const cutBlob = await imgly.removeBackground(await canvasToBlob(src, "image/jpeg", 0.92), IMGLY_CONFIG);
  const cutFull = await blobToCanvas(cutBlob);
  const bounds = alphaBounds(cutFull);
  if (!bounds) throw new Error("No person found in the photo. Please upload a clearer photo of yourself.");
  let person = cropCanvas(cutFull, bounds);

  rep.enter("analyze", "Checking how much of you is in the photo…");
  const info = await analyzeBody(src, bounds, cutFull.height);

  if (info.fullBody) {
    rep.skip("generate");
  } else {
    rep.enter("generate", "Growing the missing part of the body…");
    person = await extendBody(person, info.visibleFraction, imgly);
  }

  rep.enter("compose", "Matching light and standing you next to me…");
  const final = composeFinal(base, person);
  return await canvasToBlob(final, "image/jpeg", 0.95);
}
