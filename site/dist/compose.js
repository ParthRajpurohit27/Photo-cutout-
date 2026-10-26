import { CONFIG } from "./config.js";
import { colorTransfer, ctx2d, featherAlpha, makeCanvas, scaleCanvas } from "./imaging.js";
/** Places the visitor's cut-out next to the person in the base photo. Base photo is never altered. */
export function composeFinal(base, visitor) {
    const W = base.width;
    const H = base.height;
    const tH = H * CONFIG.visitorHeightRatio;
    const tW = visitor.width * (tH / visitor.height);
    const v = scaleCanvas(visitor, tW, tH);
    colorTransfer(v, base, CONFIG.colorMatchStrength);
    featherAlpha(v);
    const cx = Math.min(W - v.width / 2, Math.max(v.width / 2, W * CONFIG.visitorCenterX));
    const x = Math.round(cx - v.width / 2);
    const groundY = H * CONFIG.groundY;
    const y = Math.round(groundY - v.height);
    const out = makeCanvas(W, H);
    const g = ctx2d(out);
    g.drawImage(base, 0, 0);
    // Soft ground shadow under the feet.
    const rx = v.width * 0.36;
    const ry = Math.max(6, v.height * 0.02);
    g.save();
    g.translate(x + v.width / 2, groundY - ry * 0.3);
    g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, "rgba(0,0,0,0.42)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.18)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.drawImage(v, x, y);
    return out;
}
