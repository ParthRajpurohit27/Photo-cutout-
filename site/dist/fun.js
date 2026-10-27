import { burst } from "./confetti.js";
/** Each run picks one story at random, so waiting is different every time. */
const STORIES = [
    [
        "Aaj meri 18th birthday hai, aur main thoda nervous hu 😅",
        "Pehle balloons phulaye. 20 phulaye, 3 phat gaye 🎈💥",
        "Phir cake laya. Dukaan wale bhaiya bole: 'Itna bada cake? Kisko khilana hai?' 🎂",
        "Maine kaha: 'Poore khandaan ko, aur is photo wale ko bhi!'",
        "DJ ne gaana lagaya. Papa ne bola 'Band kar!' Phir khud nachne lage 💃",
        "Tab tak teri photo AI ke paas hai. Dhyan se, kharab mat karna bhai!",
        "Main sheeshe me baal theek kar raha hu. Haan, 18 saal ka asar hai 😎",
        "Candle jalayi, wish maangi. Wish bataunga nahi, warna poori nahi hogi 🤫",
        "Bas ab teri photo aur main ek frame me. Almost done!",
    ],
    [
        "Ek zamane me main 1 saal ka tha. Sab bolte the 'kitna cute!' 👶",
        "Phir school gaya. Pehle din roya, doosre din bhi roya, teesre din dost mil gaye 🎒",
        "Boards ka tension aaya. Chemistry ne rula diya 🧪",
        "Aur ab 18 ka ho gaya. Vote bhi de sakta hu, tension bhi le sakta hu 🗳️",
        "Time machine me teri photo daal di hai, ghoom rahi hai ⏳",
        "AI bol raha hai 'bhai itni mehnat?' 😂 Maine kaha: 'Kaam kar, birthday hai!'",
        "Mere saath khade hone ke liye line lagi hai. Tu pehle number pe hai 🎟️",
        "Ek second, collar theek karne do 👔",
        "Time machine wapas aa rahi hai!",
    ],
    [
        "Studio me swagat hai! Aaj sirf ek customer: aap 📸",
        "Photographer (matlab main) ne light set ki 💡",
        "AI bola: 'Pehle background ko alvida bolo' 👋",
        "Maine kaha: 'Dhyan se, kapde mat kaat dena!' ✂️",
        "Shop wale uncle jaise Modi ji ke saath photo banate hain na, waisi hi banegi 😄",
        "Light match ho rahi hai. Tu thoda aur chamak raha hai ✨",
        "Tere liye mere baju me jagah bana raha hu. Thoda adjust ho ja 🕺",
        "Last touch... frame lagate hain 🖼️",
        "Tayyar hone hi wali hai!",
    ],
];
const FILLERS = [
    "Thoda sa sabr. Sabr ka phal meetha hota hai, cake jaisa 🍰",
    "Cake ne party me kya kaha? 'Mujhe kaat do!' 😆",
    "AI coffee break pe gaya tha, wapas aa gaya ☕",
    "Slow internet hai kya? Koi baat nahi, main intezaar kar leta hu ⏳",
    "Balloons phoda kya? Neeche score dekh 😏",
    "Pro tip: golden balloon phodo, 5 points milenge 🌟",
    "Main yahin hu, kahin nahi ja raha. Photo aa rahi hai 🚀",
];
const ACTIONS = ["spin", "dance", "flip", "slide", "pulse", "wave"];
const EMOJIS = ["🎉", "🎈", "✨", "🥳", "🎁", "🍰", "🎂", "🪅", "⭐", "💃"];
const BALLOON_COLORS = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ce82ff", "#ff6fb5"];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Keeps the visitor entertained while the photo is being made. */
export function startFun(d) {
    const timers = new Set();
    let running = true;
    let popped = 0;
    d.score.textContent = "🎈 0";
    const later = (fn, ms) => {
        const id = window.setTimeout(() => {
            timers.delete(id);
            if (running)
                fn();
        }, ms);
        timers.add(id);
    };
    // 1) A story, told line by line (random story every run, then jokes).
    const queue = [...pick(STORIES)];
    const storyStep = () => {
        if (queue.length === 0)
            queue.push(...shuffled(FILLERS));
        const line = queue.shift() ?? "";
        d.say(line);
        later(storyStep, 3800 + line.length * 45);
    };
    storyStep();
    // 2) The character does a different trick every few seconds.
    let lastAct = "";
    const actStep = () => {
        let a = pick(ACTIONS);
        while (a === lastAct)
            a = pick(ACTIONS);
        lastAct = a;
        d.mascot.dataset["act"] = a;
        later(() => {
            delete d.mascot.dataset["act"];
        }, 1300);
        later(actStep, rnd(3000, 4800));
    };
    later(actStep, 1500);
    // 3) Emojis float up around the character.
    const layer = document.createElement("div");
    layer.className = "emo-layer";
    d.hero.append(layer);
    const emoStep = () => {
        const s = document.createElement("span");
        s.className = "emo";
        s.textContent = pick(EMOJIS);
        s.style.left = `${rnd(0, 80)}px`;
        s.style.setProperty("--dx", `${rnd(-30, 30).toFixed(0)}px`);
        layer.append(s);
        window.setTimeout(() => s.remove(), 2600);
        later(emoStep, rnd(450, 950));
    };
    later(emoStep, 400);
    // 4) Party poppers fire from the screen corners.
    const popperStep = () => {
        const left = Math.random() < 0.5;
        const span = document.createElement("span");
        span.className = `popper ${left ? "l" : "r"}`;
        span.textContent = "🎉";
        document.body.append(span);
        later(() => {
            burst(d.confetti, {
                x: left ? 28 : window.innerWidth - 28,
                y: window.innerHeight - 40,
                angle: left ? -Math.PI * 0.33 : -Math.PI * 0.67,
                spread: 0.9,
                count: 70,
                speed: 15,
            });
        }, 250);
        window.setTimeout(() => span.remove(), 1000);
        later(popperStep, rnd(6000, 9500));
    };
    later(popperStep, 1400);
    // 5) Mini game: pop the balloons (golden one = 5 points).
    const pop = (b, golden) => {
        if (b.classList.contains("popped"))
            return;
        b.classList.add("popped");
        const r = b.getBoundingClientRect();
        burst(d.confetti, {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            count: golden ? 60 : 22,
            speed: golden ? 11 : 7,
        });
        popped += golden ? 5 : 1;
        d.score.textContent = `🎈 ${popped}`;
        if (golden)
            d.say("GOLDEN balloon! +5 🌟 Tu to pro nikla!");
        window.setTimeout(() => b.remove(), 160);
    };
    const balloonStep = () => {
        if (d.arena.childElementCount < 8) {
            const golden = Math.random() < 0.1;
            const b = document.createElement("button");
            b.type = "button";
            b.className = golden ? "balloon golden" : "balloon";
            b.setAttribute("aria-label", "Balloon phodo");
            b.style.left = `${rnd(3, 86).toFixed(1)}%`;
            b.style.setProperty("--c", golden ? "#ffc800" : pick(BALLOON_COLORS));
            b.style.setProperty("--t", `${rnd(4.5, 7.5).toFixed(1)}s`);
            b.addEventListener("animationend", (e) => {
                if (e.animationName === "balloon-up")
                    b.remove();
            });
            b.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                pop(b, golden);
            });
            d.arena.append(b);
        }
        later(balloonStep, rnd(800, 1400));
    };
    balloonStep();
    return {
        stop() {
            running = false;
            timers.forEach((id) => window.clearTimeout(id));
            timers.clear();
            delete d.mascot.dataset["act"];
            layer.remove();
            d.arena.replaceChildren();
            return popped;
        },
    };
}
