export function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
}
export function ctx2d(c) {
    const g = c.getContext("2d");
    if (!g)
        throw new Error("Canvas is not supported in this browser.");
    return g;
}
/** High-quality resize (stepwise halving avoids jagged edges). */
export function scaleCanvas(src, w, h) {
    const tw = Math.max(1, Math.round(w));
    const th = Math.max(1, Math.round(h));
    let cur = src;
    let cw = src.width;
    let ch = src.height;
    while (cw / 2 > tw && ch / 2 > th) {
        const nw = Math.round(cw / 2);
        const nh = Math.round(ch / 2);
        const step = makeCanvas(nw, nh);
        const sg = ctx2d(step);
        sg.imageSmoothingQuality = "high";
        sg.drawImage(cur, 0, 0, nw, nh);
        cur = step;
        cw = nw;
        ch = nh;
    }
    const out = makeCanvas(tw, th);
    const g = ctx2d(out);
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, tw, th);
    return out;
}
export function fitMax(src, maxSide) {
    const k = Math.min(1, maxSide / Math.max(src.width, src.height));
    return scaleCanvas(src, src.width * k, src.height * k);
}
export function canvasToBlob(c, type, quality) {
    return new Promise((resolve, reject) => {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), type, quality);
    });
}
export async function blobToCanvas(blob) {
    const bmp = await createImageBitmap(blob);
    const c = makeCanvas(bmp.width, bmp.height);
    ctx2d(c).drawImage(bmp, 0, 0);
    bmp.close();
    return c;
}
export function canvasToBase64(c, type, quality) {
    const url = c.toDataURL(type, quality);
    const i = url.indexOf(",");
    return i >= 0 ? url.slice(i + 1) : url;
}
/** Bounding box of the opaque person, ignoring tiny stray specks. */
export function alphaBounds(c, threshold = 128) {
    const W = c.width;
    const H = c.height;
    const d = ctx2d(c).getImageData(0, 0, W, H).data;
    const rows = new Uint32Array(H);
    const cols = new Uint32Array(W);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (d[(y * W + x) * 4 + 3] > threshold) {
                rows[y]++;
                cols[x]++;
            }
        }
    }
    const minRow = Math.max(3, Math.round(W * 0.002));
    const minCol = Math.max(3, Math.round(H * 0.002));
    let y0 = 0;
    while (y0 < H && rows[y0] < minRow)
        y0++;
    let y1 = H - 1;
    while (y1 > y0 && rows[y1] < minRow)
        y1--;
    let x0 = 0;
    while (x0 < W && cols[x0] < minCol)
        x0++;
    let x1 = W - 1;
    while (x1 > x0 && cols[x1] < minCol)
        x1--;
    if (y0 >= y1 || x0 >= x1)
        return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export function cropCanvas(c, b) {
    const out = makeCanvas(b.w, b.h);
    ctx2d(out).drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return out;
}
/** Softens the cut-out edge: 1px erode + 3x3 blur on alpha only (removes halos). */
export function featherAlpha(c) {
    const W = c.width;
    const H = c.height;
    const g = ctx2d(c);
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    const a = new Uint8ClampedArray(W * H);
    for (let i = 0; i < a.length; i++)
        a[i] = d[i * 4 + 3];
    const er = new Uint8ClampedArray(W * H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            let m = a[i];
            if (x > 0)
                m = Math.min(m, a[i - 1]);
            if (x < W - 1)
                m = Math.min(m, a[i + 1]);
            if (y > 0)
                m = Math.min(m, a[i - W]);
            if (y < H - 1)
                m = Math.min(m, a[i + W]);
            er[i] = m;
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let sum = 0;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= H)
                    continue;
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= W)
                        continue;
                    sum += er[yy * W + xx];
                    n++;
                }
            }
            d[(y * W + x) * 4 + 3] = sum / n;
        }
    }
    g.putImageData(img, 0, 0);
}
// ---- Lab colour transfer (match visitor's lighting/colour to the base photo) ----
const SRGB_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const c = i / 255;
    SRGB_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
function fwd(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}
function inv(t) {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}
function gamma(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return v < 0 ? 0 : v > 1 ? 255 : v * 255;
}
function toLab(r, g, b, out) {
    const R = SRGB_LIN[r];
    const G = SRGB_LIN[g];
    const B = SRGB_LIN[b];
    const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / XN;
    const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / YN;
    const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / ZN;
    const fx = fwd(x);
    const fy = fwd(y);
    const fz = fwd(z);
    out[0] = 116 * fy - 16;
    out[1] = 500 * (fx - fy);
    out[2] = 200 * (fy - fz);
}
function fromLab(L, a, b) {
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const X = XN * inv(fx);
    const Y = YN * inv(fy);
    const Z = ZN * inv(fz);
    const R = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    const G = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
    const B = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return [gamma(R), gamma(G), gamma(B)];
}
function labStats(data, minAlpha) {
    const tmp = new Float32Array(3);
    const sum = [0, 0, 0];
    const sq = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < minAlpha)
            continue;
        toLab(data[i], data[i + 1], data[i + 2], tmp);
        for (let k = 0; k < 3; k++) {
            sum[k] += tmp[k];
            sq[k] += tmp[k] * tmp[k];
        }
        n++;
    }
    if (n === 0)
        return { mean: [50, 0, 0], std: [1, 1, 1] };
    const mean = [sum[0] / n, sum[1] / n, sum[2] / n];
    const std = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
        std[k] = Math.sqrt(Math.max(1e-6, sq[k] / n - mean[k] * mean[k]));
    }
    return { mean, std };
}
/** Moves the cut-out's colour statistics toward the reference photo's. */
export function colorTransfer(cutout, reference, strength) {
    if (strength <= 0)
        return;
    const ref = fitMax(reference, 256);
    const refData = ctx2d(ref).getImageData(0, 0, ref.width, ref.height).data;
    const rs = labStats(refData, 1);
    const g = ctx2d(cutout);
    const img = g.getImageData(0, 0, cutout.width, cutout.height);
    const d = img.data;
    const ss = labStats(d, 200);
    const maxShift = [14, 10, 10];
    const k = [];
    const target = [];
    for (let c = 0; c < 3; c++) {
        const s = c === 0 ? strength * 0.8 : strength;
        const shift = Math.max(-maxShift[c], Math.min(maxShift[c], (rs.mean[c] - ss.mean[c]) * s));
        target[c] = ss.mean[c] + shift;
        const tStd = ss.std[c] + (rs.std[c] - ss.std[c]) * s;
        k[c] = Math.max(0.75, Math.min(1.3, tStd / ss.std[c]));
    }
    const tmp = new Float32Array(3);
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0)
            continue;
        toLab(d[i], d[i + 1], d[i + 2], tmp);
        const L = (tmp[0] - ss.mean[0]) * k[0] + target[0];
        const a = (tmp[1] - ss.mean[1]) * k[1] + target[1];
        const b = (tmp[2] - ss.mean[2]) * k[2] + target[2];
        const [r, gg, bb] = fromLab(L, a, b);
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = bb;
    }
    g.putImageData(img, 0, 0);
}
