import { analyzeBody, extendBody } from "./body.js";
import { composeFinal } from "./compose.js";
import { CONFIG } from "./config.js";
import { alphaBounds, blobToCanvas, canvasToBlob, cropCanvas, fitMax } from "./imaging.js";
import { loadImgly, loadPose } from "./loaders.js";
import type { Report } from "./types.js";

export async function buildComposite(file: File, base: HTMLCanvasElement, report: Report): Promise<Blob> {
  report("Reading your photo…", 5);
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const src = fitMax(bmp, CONFIG.visitorMaxSide);
  bmp.close();

  report("Removing background (first time takes a bit)…", 12);
  const [imgly] = await Promise.all([loadImgly(), loadPose()]);
  const cutBlob = await imgly.removeBackground(await canvasToBlob(src, "image/jpeg", 0.92), {
    output: { format: "image/png" },
  });
  const cutFull = await blobToCanvas(cutBlob);
  const bounds = alphaBounds(cutFull);
  if (!bounds) throw new Error("No person found in the photo. Please upload a clearer photo of yourself.");
  let person = cropCanvas(cutFull, bounds);

  report("Checking body…", 55);
  const info = await analyzeBody(src, bounds, cutFull.height);

  if (!info.fullBody) {
    report("Completing the rest of the body…", 65);
    person = await extendBody(person, info.visibleFraction, imgly);
  }

  report("Matching light and placing you in the photo…", 90);
  const final = composeFinal(base, person);
  const out = await canvasToBlob(final, "image/jpeg", 0.95);
  report("Done", 100);
  return out;
}
