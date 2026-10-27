import { burst } from "./confetti.js";
import { CONFIG } from "./config.js";
import { Estimator } from "./estimator.js";
import { startFun } from "./fun.js";
import { fitMax } from "./imaging.js";
import { modelFraction, modelState, preloadModel } from "./loaders.js";
import { buildComposite } from "./pipeline.js";
function el(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing element #${id}`);
    return node;
}
const hero = el("hero");
const bubble = el("bubble");
const sayEl = el("say");
const subEl = el("sub");
const stageEl = el("stage");
const fileInput = el("file");
const pickLabel = el("pick");
const progressBox = el("progress");
const fill = el("fill");
const rider = el("rider");
const pctEl = el("pct");
const etaEl = el("eta");
const stepsEl = el("steps");
const download = el("download");
const confetti = el("confetti");
const arena = el("arena");
const scoreEl = el("score");
const mascot = el("mascot");
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const STEPS = [
    { id: "read", text: "Tumhari photo padh raha hu" },
    { id: "model", text: "AI ko jagaya" },
    { id: "segment", text: "Background hata raha hu" },
    { id: "analyze", text: "Body check kar raha hu" },
    { id: "generate", text: "Neeche ki body bana raha hu" },
    { id: "compose", text: "Tumhe mere saath khada kar raha hu" },
];
const stepNodes = new Map();
let baseCanvas = null;
let busy = false;
let lastUrl = null;
function setMood(m) {
    hero.dataset["mood"] = m;
}
let typeTimer = 0;
/** Shows text in the speech bubble with a typewriter effect. */
function say(text, isError = false) {
    window.clearInterval(typeTimer);
    bubble.classList.toggle("error", isError);
    bubble.classList.remove("pop");
    void bubble.offsetWidth; // restart the pop animation
    bubble.classList.add("pop");
    sayEl.textContent = "";
    const chars = Array.from(text);
    let i = 0;
    typeTimer = window.setInterval(() => {
        i += 1;
        sayEl.textContent = chars.slice(0, i).join("");
        if (i >= chars.length)
            window.clearInterval(typeTimer);
    }, 20);
}
function buildSteps() {
    stepsEl.replaceChildren();
    stepNodes.clear();
    for (const s of STEPS) {
        const li = document.createElement("li");
        li.dataset["state"] = "todo";
        const dot = document.createElement("span");
        dot.className = "dot";
        const txt = document.createElement("span");
        txt.textContent = s.text;
        li.append(dot, txt);
        stepsEl.append(li);
        stepNodes.set(s.id, li);
    }
}
function setStep(id, state) {
    const n = stepNodes.get(id);
    if (n)
        n.dataset["state"] = state;
}
function fmtEta(sec) {
    if (sec <= 3)
        return "bas ho gaya…";
    if (sec < 60) {
        const s = sec <= 15 ? Math.round(sec) : Math.round(sec / 5) * 5;
        return `~${s}s baaki`;
    }
    const m = Math.floor(sec / 60);
    const s = Math.round((sec % 60) / 5) * 5;
    return s === 0 || s === 60 ? `~${s === 60 ? m + 1 : m} min baaki` : `~${m} min ${s}s baaki`;
}
function renderProgress(percent, etaText) {
    const p = Math.max(0, Math.min(100, percent));
    fill.style.width = `${p.toFixed(1)}%`;
    rider.style.left = `${p.toFixed(1)}%`;
    pctEl.textContent = `${Math.floor(p)}%`;
    etaEl.textContent = etaText;
    progressBox.setAttribute("aria-valuenow", String(Math.floor(p)));
}
function setBusy(value) {
    busy = value;
    fileInput.disabled = value;
    pickLabel.classList.toggle("disabled", value);
}
async function loadBase() {
    const res = await fetch(CONFIG.basePhoto);
    if (!res.ok)
        throw new Error("Base photo not found.");
    const bmp = await createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
    const c = fitMax(bmp, CONFIG.baseMaxSide);
    bmp.close();
    return c;
}
function celebrate() {
    const r = mascot.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    burst(confetti, { x: r.left + r.width / 2, y: r.top + r.height * 0.2, angle: -Math.PI / 2, spread: Math.PI * 1.2, count: 120, speed: 14 });
    window.setTimeout(() => burst(confetti, { x: 20, y: H - 30, angle: -Math.PI * 0.3, spread: 0.9, count: 90, speed: 17 }), 250);
    window.setTimeout(() => burst(confetti, { x: W - 20, y: H - 30, angle: -Math.PI * 0.7, spread: 0.9, count: 90, speed: 17 }), 450);
    let n = 0;
    const rain = window.setInterval(() => {
        burst(confetti, { x: Math.random() * W, y: -10, angle: Math.PI / 2, spread: 0.6, count: 10, speed: 3 });
        n += 1;
        if (n > 14)
            window.clearInterval(rain);
    }, 140);
}
async function handleFile(file) {
    if (busy)
        return;
    if (!file.type.startsWith("image/")) {
        setMood("sad");
        say("Ye image file nahi lag rahi. Koi photo chuno 🙏", true);
        return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        setMood("sad");
        say("Photo bahut badi hai (max 30 MB). Chhoti photo chuno.", true);
        return;
    }
    setBusy(true);
    download.hidden = true;
    buildSteps();
    progressBox.hidden = false;
    setMood("work");
    subEl.dataset["stage"] = "";
    const fun = startFun({ say: (t) => say(t), hero, mascot, arena, score: scoreEl, confetti });
    const est = new Estimator(file.size);
    let active = null;
    let shownEta = -1;
    let lastTick = performance.now();
    const reporter = {
        enter(stage, label) {
            if (active)
                setStep(active, "done");
            active = stage;
            est.enter(stage);
            setStep(stage, "active");
            subEl.dataset["stage"] = label;
        },
        skip(stage) {
            est.skip(stage);
            setStep(stage, "skip");
        },
    };
    const tick = () => {
        const now = performance.now();
        const dt = (now - lastTick) / 1000;
        lastTick = now;
        const s = est.snapshot();
        // Smooth the ETA: falls quickly, rises slowly, so it never jumps around.
        if (shownEta < 0)
            shownEta = s.etaSeconds;
        else if (s.etaSeconds < shownEta)
            shownEta += (s.etaSeconds - shownEta) * 0.35;
        else
            shownEta += Math.min(s.etaSeconds - shownEta, dt * 1.5);
        renderProgress(s.percent, fmtEta(shownEta));
        if (s.stage === "model" && !modelState.done && modelState.total > 0) {
            stageEl.textContent = `AI download: ${Math.floor(modelFraction() * 100)}% (sirf pehli baar lagta hai)`;
        }
        else {
            stageEl.textContent = subEl.dataset["stage"] ?? "";
        }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    try {
        if (!baseCanvas)
            baseCanvas = await loadBase();
        const blob = await buildComposite(file, baseCanvas, reporter);
        if (active)
            setStep(active, "done");
        est.finish();
        renderProgress(100, "ho gaya!");
        if (lastUrl)
            URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        download.href = lastUrl;
        download.download = "photo-with-parth.jpg";
        download.hidden = false;
        const score = fun.stop();
        progressBox.hidden = true;
        setMood("happy");
        say(score > 0
            ? `Taaaa-daaa! 🎉 Photo ready hai. Aur tumne ${score} balloons phode, champion! 🏆`
            : "Taaaa-daaa! 🎉 Tumhari photo mere saath ready hai. Download dabao!");
        celebrate();
    }
    catch (err) {
        fun.stop();
        const msg = err instanceof Error ? err.message : "Kuch gadbad ho gayi.";
        progressBox.hidden = true;
        setMood("sad");
        say(`${msg} Ek baar phir try karo 🙏`, true);
    }
    finally {
        window.clearInterval(timer);
        stageEl.textContent = "";
        setBusy(false);
        fileInput.value = "";
    }
}
fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f)
        void handleFile(f);
});
mascot.addEventListener("click", () => {
    if (hero.dataset["mood"] === "work")
        return;
    setMood("happy");
    window.setTimeout(() => {
        if (!busy && download.hidden)
            setMood("idle");
    }, 900);
});
// Warm up while the visitor is choosing a photo: base photo + AI model download.
void loadBase()
    .then((c) => {
    baseCanvas = c;
})
    .catch(() => {
    /* reported when the visitor uploads */
});
void preloadModel();
