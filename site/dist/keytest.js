import { CONFIG } from "./config.js";
const out = document.getElementById("out");
const btn = document.getElementById("run");
const info = document.getElementById("keyinfo");
function show(ok, title, detail) {
    if (!out)
        return;
    out.className = ok ? "kt ok" : "kt bad";
    out.replaceChildren();
    const h = document.createElement("strong");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = detail;
    out.append(h, p);
}
async function run() {
    const key = CONFIG.geminiApiKey;
    show(true, "Check ho raha hai…", "Gemini se pooch raha hu.");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}`, {
            headers: { "x-goog-api-key": key },
        });
        const data = (await res.json());
        if (res.ok) {
            show(true, "Key chal rahi hai ✅", `Model "${CONFIG.geminiModel}" mil gaya. Site me body generation chalni chahiye.`);
            return;
        }
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        const hint = key.startsWith("AQ.")
            ? " Ye naye AQ. format ki key hai. Kuch accounts par ye browser/REST se kaam nahi karti. Google Cloud Console, APIs & Services, Credentials me jaakar naya API key (AIza…) banao aur use 'Generative Language API' tak restrict karo."
            : "";
        show(false, `Key nahi chali ❌ (HTTP ${res.status})`, `${msg}${hint}`);
    }
    catch (err) {
        show(false, "Gemini tak pahunch nahi paye ❌", err instanceof Error ? err.message : "Network error");
    }
}
if (info) {
    const k = CONFIG.geminiApiKey;
    info.textContent = `Site me ye key lagi hai: ${k.slice(0, 6)}…${k.slice(-4)} (${k.length} akshar)`;
}
btn?.addEventListener("click", () => void run());
