import { analyzeBody, extendBody } from "./body.js";
import { composeFinal } from "./compose.js";
import { CONFIG } from "./config.js";
import { alphaBounds, blobToCanvas, canvasToBlob, cropCanvas, fitMax } from "./imaging.js";
import { IMGLY_CONFIG, loadImgly, loadPose, preloadModel } from "./loaders.js";
import type { Reporter } from "./types.js";

export async function buildComposite(file: File, base: HTMLCanvasElement, rep: Reporter): Promise<Blob> {
  rep.enter("read", "Tumhari photo padh raha hu…");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const src = fitMax(bmp, CONFIG.visitorMaxSide);
  bmp.close();

  rep.enter("model", "AI ko jaga raha hu…");
  await Promise.all([preloadModel(), loadPose()]);
  const imgly = await loadImgly();

  rep.enter("segment", "Background hata raha hu…");
  const cutBlob = await imgly.removeBackground(await canvasToBlob(src, "image/jpeg", 0.92), IMGLY_CONFIG);
  const cutFull = await blobToCanvas(cutBlob);
  const bounds = alphaBounds(cutFull);
  if (!bounds) throw new Error("Photo me koi insaan nahi dikha. Koi saaf photo daalo.");
  let person = cropCanvas(cutFull, bounds);

  rep.enter("analyze", "Dekh raha hu photo me kitni body aayi hai…");
  const info = await analyzeBody(src, bounds, cutFull.height);

  if (info.fullBody) {
    rep.skip("generate");
  } else {
    rep.enter("generate", "Neeche ka hissa bana raha hu…");
    person = await extendBody(person, info.visibleFraction, imgly);
  }

  rep.enter("compose", "Roshni match karke tumhe mere saath khada kar raha hu…");
  const final = composeFinal(base, person);
  return await canvasToBlob(final, "image/jpeg", 0.95);
}
