import { IMGLY_CONFIG, loadPose } from "./loaders.js";
import { requestBody } from "./api.js";
import { alphaBounds, blobToCanvas, canvasToBase64, canvasToBlob, cropCanvas, ctx2d, makeCanvas, scaleCanvas, } from "./imaging.js";
/** [landmark indexes, fraction of full body height (from head-top) where that part sits] */
const BODY_LEVELS = [
    [[0], 0.06],
    [[11, 12], 0.19],
    [[13, 14], 0.38],
    [[23, 24], 0.52],
    [[25, 26], 0.72],
    [[27, 28], 0.95],
];
export async function analyzeBody(src, person, cutHeight) {
    const touchesBottom = person.y + person.h >= cutHeight - 3;
    const pose = await loadPose();
    if (pose) {
        try {
            const lm = pose.detect(src).landmarks[0];
            if (lm) {
                const seen = (i) => {
                    const p = lm[i];
                    return !!p && (p.visibility ?? 0) >= 0.6 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 0.985;
                };
                if (seen(27) || seen(28))
                    return { fullBody: true, visibleFraction: 1 };
                let frac = 0;
                for (const [idx, f] of BODY_LEVELS) {
                    if (idx.some(seen))
                        frac = Math.max(frac, f);
                }
                if (frac > 0) {
                    return { fullBody: false, visibleFraction: Math.min(0.93, Math.max(0.18, frac + 0.07)) };
                }
            }
        }
        catch {
            /* fall through to heuristic */
        }
    }
    // Heuristic fallback from the cut-out's shape.
    const ratio = person.h / person.w;
    if (ratio > 2.3 && !touchesBottom)
        return { fullBody: true, visibleFraction: 1 };
    const frac = ratio < 1.1 ? 0.2 : ratio < 1.6 ? 0.35 : ratio < 2.3 ? 0.55 : 0.8;
    return { fullBody: false, visibleFraction: frac };
}
const PROMPT_ASPECT = 9 / 16;
/**
 * Generates only the missing lower body. The visitor's original pixels are kept untouched above the join
 * line (so the face is never altered); generated pixels are used only below it.
 */
export async function extendBody(person, visibleFraction, imgly) {
    const totalH = person.height / visibleFraction;
    let H0 = totalH * 1.05;
    let W0 = H0 * PROMPT_ASPECT;
    if (person.width > W0 * 0.9) {
        W0 = person.width / 0.9;
        H0 = W0 / PROMPT_ASPECT;
    }
    const k = Math.min(1, 1280 / H0);
    const CW = Math.round(W0 * k);
    const CH = Math.round(H0 * k);
    const small = scaleCanvas(person, person.width * k, person.height * k);
    const px = Math.round((CW - small.width) / 2);
    const py = Math.round(CH * 0.02);
    const cutY = py + small.height;
    // Image sent to Gemini: person on white, empty white below.
    const sent = makeCanvas(CW, CH);
    const sg = ctx2d(sent);
    sg.fillStyle = "#ffffff";
    sg.fillRect(0, 0, CW, CH);
    sg.drawImage(small, px, py);
    const genBlob = await requestBody(canvasToBase64(sent, "image/jpeg", 0.92), "image/jpeg");
    const genBmp = await createImageBitmap(genBlob);
    const merged = makeCanvas(CW, CH);
    const mg = ctx2d(merged);
    mg.fillStyle = "#ffffff";
    mg.fillRect(0, 0, CW, CH);
    mg.drawImage(genBmp, 0, 0, CW, CH);
    genBmp.close();
    // Original on top, fading out just above the join line (never reaching the face).
    const fade = Math.max(4, Math.min(CH * 0.04, small.height * 0.12));
    const top = makeCanvas(CW, CH);
    const tg = ctx2d(top);
    tg.drawImage(sent, 0, 0);
    tg.globalCompositeOperation = "destination-in";
    const grad = tg.createLinearGradient(0, cutY - fade, 0, cutY);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    tg.fillStyle = grad;
    tg.fillRect(0, 0, CW, cutY);
    mg.drawImage(top, 0, 0);
    // Remove the white background of the completed full-body image.
    const cutBlob = await imgly.removeBackground(await canvasToBlob(merged, "image/png"), IMGLY_CONFIG);
    const cut = await blobToCanvas(cutBlob);
    const b = alphaBounds(cut);
    if (!b)
        throw new Error("Body ban nahi payi.");
    return cropCanvas(cut, b);
}
