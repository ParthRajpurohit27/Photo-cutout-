import { modelRemainingSeconds } from "./loaders.js";
export const STAGE_ORDER = ["read", "model", "segment", "analyze", "generate", "compose"];
/** Stages whose speed depends on the visitor's phone/laptop (so one slow stage predicts the next ones). */
const CPU_STAGES = new Set(["read", "segment", "analyze", "compose"]);
const STORAGE_KEY = "photo-site.estimator.v1";
/** First-ever-run guesses in seconds; replaced by what this device really took last time. */
const DEFAULTS = {
    read: 1,
    model: 0,
    segment: 7,
    analyze: 3.5,
    generate: 24,
    compose: 3,
};
const nowS = () => performance.now() / 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function saveHistory(h) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
    }
    catch {
        /* storage may be blocked; estimates just start from defaults next time */
    }
}
/**
 * Real-time estimate built from measurements:
 *  - model download: remaining bytes / measured download speed
 *  - CPU stages: learned from this device's earlier stages in this run, and from its previous runs
 *  - Gemini stage: its own history
 * Progress % = time already spent / (time spent + time still expected), so bar and ETA always agree.
 */
export class Estimator {
    stages = {
        read: { started: null, ended: null, skipped: false },
        model: { started: null, ended: null, skipped: false },
        segment: { started: null, ended: null, skipped: false },
        analyze: { started: null, ended: null, skipped: false },
        generate: { started: null, ended: null, skipped: false },
        compose: { started: null, ended: null, skipped: false },
    };
    history = loadHistory();
    base;
    actual = {};
    t0 = nowS();
    cpuFactor = 1;
    current = null;
    lastPercent = 0;
    finished = false;
    constructor(fileBytes) {
        const mb = fileBytes / 1048576;
        this.base = { ...DEFAULTS, ...this.history, read: 0.5 + mb * 0.12, model: 0 };
    }
    enter(stage) {
        this.closeCurrent(nowS());
        const idx = STAGE_ORDER.indexOf(stage);
        STAGE_ORDER.forEach((id, i) => {
            if (i < idx && this.stages[id].started === null)
                this.stages[id].skipped = true;
        });
        this.stages[stage].started = nowS();
        this.current = stage;
    }
    skip(stage) {
        if (this.stages[stage].started === null)
            this.stages[stage].skipped = true;
    }
    finish() {
        this.closeCurrent(nowS());
        this.finished = true;
        const next = { ...this.history };
        for (const id of ["segment", "analyze", "generate", "compose"]) {
            const a = this.actual[id];
            if (a === undefined)
                continue;
            const old = this.history[id];
            next[id] = old === undefined ? a : 0.5 * old + 0.5 * a;
        }
        saveHistory(next);
    }
    snapshot() {
        if (this.finished)
            return { percent: 100, etaSeconds: 0, stage: null };
        const eta = this.remaining();
        const elapsed = nowS() - this.t0;
        const raw = (elapsed / (elapsed + eta)) * 100;
        const p = Math.max(this.lastPercent, Math.min(99, raw));
        this.lastPercent = p;
        return { percent: p, etaSeconds: eta, stage: this.current };
    }
    expected(id) {
        return this.base[id] * (CPU_STAGES.has(id) ? this.cpuFactor : 1);
    }
    remaining() {
        const t = nowS();
        let sum = 0;
        for (const id of STAGE_ORDER) {
            const s = this.stages[id];
            if (s.skipped || s.ended !== null)
                continue;
            if (id === "model") {
                sum += modelRemainingSeconds();
                continue;
            }
            const exp = this.expected(id);
            if (s.started === null) {
                sum += exp;
            }
            else {
                const el = t - s.started;
                sum += el < exp ? exp - el : Math.max(0.8, exp * 0.25);
            }
        }
        return sum;
    }
    closeCurrent(t) {
        const id = this.current;
        if (!id)
            return;
        const s = this.stages[id];
        s.ended = t;
        const actual = t - (s.started ?? t);
        this.actual[id] = actual;
        if (CPU_STAGES.has(id) && id !== "read" && this.base[id] > 0.3) {
            this.cpuFactor = clamp(0.5 * this.cpuFactor + 0.5 * (actual / this.base[id]), 0.4, 4);
        }
        this.current = null;
    }
}
