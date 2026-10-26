import { CONFIG } from "./config.js";
import { fitMax } from "./imaging.js";
import { loadImgly } from "./loaders.js";
import { buildComposite } from "./pipeline.js";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const fileInput = el<HTMLInputElement>("file");
const pickLabel = el<HTMLLabelElement>("pick");
const statusEl = el<HTMLParagraphElement>("status");
const barWrap = el<HTMLDivElement>("barWrap");
const bar = el<HTMLDivElement>("bar");
const pctEl = el<HTMLSpanElement>("pct");
const etaEl = el<HTMLSpanElement>("eta");
const download = el<HTMLAnchorElement>("download");

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

let baseCanvas: HTMLCanvasElement | null = null;
let busy = false;
let lastUrl: string | null = null;

const INITIAL_ESTIMATE_S = 45;

interface ProgressState {
  target: number;
  shown: number;
  start: number;
  timer: number | null;
}

const prog: ProgressState = { target: 0, shown: 0, start: 0, timer: null };

function renderProgress(): void {
  bar.style.width = `${prog.shown.toFixed(1)}%`;
  pctEl.textContent = `${Math.floor(prog.shown)}%`;
  if (prog.shown < 4) {
    etaEl.textContent = `about ${INITIAL_ESTIMATE_S}s`;
    return;
  }
  const elapsed = (performance.now() - prog.start) / 1000;
  const left = Math.ceil((elapsed * (100 - prog.shown)) / prog.shown);
  etaEl.textContent = left <= 3 ? "almost done…" : `about ${left}s left`;
}

function tick(): void {
  if (prog.shown < prog.target) {
    prog.shown += (prog.target - prog.shown) * 0.15 + 0.05;
  } else {
    // Keep creeping slowly inside a long step so the bar never looks frozen.
    prog.shown += (Math.min(98, prog.target + 20) - prog.shown) * 0.01;
  }
  prog.shown = Math.min(prog.shown, prog.target >= 100 ? 100 : 98);
  renderProgress();
}

function startProgress(): void {
  stopProgress();
  prog.target = 0;
  prog.shown = 0;
  prog.start = performance.now();
  barWrap.hidden = false;
  renderProgress();
  prog.timer = window.setInterval(tick, 100);
}

function stopProgress(): void {
  if (prog.timer !== null) {
    window.clearInterval(prog.timer);
    prog.timer = null;
  }
}

function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function setBusy(value: boolean): void {
  busy = value;
  fileInput.disabled = value;
  pickLabel.classList.toggle("disabled", value);
}

async function loadBase(): Promise<HTMLCanvasElement> {
  const res = await fetch(CONFIG.basePhoto);
  if (!res.ok) throw new Error("Base photo not found.");
  const bmp = await createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
  const c = fitMax(bmp, CONFIG.baseMaxSide);
  bmp.close();
  return c;
}

async function handleFile(file: File): Promise<void> {
  if (busy) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.", true);
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    setStatus("Photo is too large (max 30 MB). Please choose a smaller one.", true);
    return;
  }
  setBusy(true);
  download.hidden = true;
  setStatus("Starting…");
  startProgress();
  try {
    if (!baseCanvas) baseCanvas = await loadBase();
    const blob = await buildComposite(file, baseCanvas, (msg, p) => {
      setStatus(msg);
      prog.target = Math.max(prog.target, p);
    });
    prog.target = 100;
    prog.shown = 100;
    renderProgress();
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    download.href = lastUrl;
    download.download = "my-photo.jpg";
    download.hidden = false;
    setStatus("Your photo is ready.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    setStatus(`${msg} Please try again.`, true);
  } finally {
    stopProgress();
    barWrap.hidden = true;
    setBusy(false);
    fileInput.value = "";
  }
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void handleFile(f);
});

// Warm up the heavy parts while the visitor is choosing a photo.
void loadBase()
  .then((c) => {
    baseCanvas = c;
  })
  .catch(() => {
    /* reported when the visitor uploads */
  });
void loadImgly().catch(() => {
  /* reported when the visitor uploads */
});
