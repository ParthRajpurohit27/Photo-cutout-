import { burst } from "./confetti.js";

/** Each run picks one story at random, so waiting is different every time. Polite ("aap") with light teasing. */
const STORIES: readonly (readonly string[])[] = [
  [
    "Aapki photo mil gayi, bas ek minute. Tab tak party ki thodi baatein sun lijiye 😄",
    "Pehle balloons phulaye. 20 phulaye, 3 phat gaye 🎈💥",
    "Phir cake laya. Dukaan wale bhaiya bole: 'Itna bada cake? Kisko khilana hai?' 🎂",
    "Maine kaha: 'Poore parivar ko!' Aap bhi usme shamil hain 😊",
    "DJ ne gaana lagaya. Papa ne bola 'Band karo!' Phir khud nachne lage 💃",
    "Idhar AI aapko background se alag kar raha hai. Dhyan rakhega, aapke kapde nahi katega ✂️",
    "Main sheeshe me baal theek kar raha hu. Haan, 18 ka hone ka asar hai 😎",
    "Candle jalayi, wish maangi. Wish bataunga nahi, warna poori nahi hogi 🤫",
    "Bas, aap aur main ek frame me. Thoda sa aur sabr 🙏",
  ],
  [
    "Ek zamane me main 1 saal ka tha. Sab bolte the 'kitna cute!' 👶",
    "Phir school gaya. Pehle din roya, doosre din bhi roya, teesre din dost mil gaye 🎒",
    "12th ki chemistry ne to sach me rula diya 🧪",
    "Ab 18 ka ho gaya hu. Vote bhi de sakta hu, tension bhi le sakta hu 🗳️",
    "Aapki photo time machine me ghoom rahi hai ⏳",
    "AI bol raha hai 'bhai itni mehnat?' 😂 Maine kaha: 'Kaam karo, jashn hai!'",
    "Mere saath khade hone ki line lagi hai. Aap pehle number par hain 🎟️",
    "Ek second, collar theek kar lu 👔",
    "Time machine wapas aa rahi hai!",
  ],
  [
    "Studio me aapka swagat hai! Aaj ka ek hi customer: aap 📸",
    "Photographer (yaani main) ne light set kar di 💡",
    "AI bola: 'Pehle background ko alvida kahiye' 👋",
    "Dukaan wale uncle jaise bade logon ke saath photo banate hain na, waisi hi banegi 😄",
    "Light match ho rahi hai. Aap thoda aur chamak rahe hain ✨",
    "Aapke liye apne baju me jagah bana raha hu. Thoda adjust kar leta hu 🕺",
    "Last touch... frame laga rahe hain 🖼️",
    "Bas tayyar hone hi wali hai!",
  ],
];

const FILLERS: readonly string[] = [
  "Thoda sa sabr kijiye. Sabr ka phal meetha hota hai, cake jaisa 🍰",
  "Cake ne party me kya kaha? 'Mujhe kaat do!' 😆",
  "AI chai peene gaya tha, wapas aa gaya ☕",
  "Internet dheema hai kya? Koi baat nahi, main intezaar kar leta hu ⏳",
  "Balloons phode kya? Neeche score dekhiye 😏",
  "Tip: golden balloon phodiye, 5 points milenge 🌟",
  "Main yahin hu, kahin nahi ja raha. Photo aa rahi hai 🚀",
  "Itni der me to main do baar muskura leta 😁",
];

const ACTIONS: readonly string[] = ["spin", "dance", "flip", "slide", "pulse", "wave"];
const EMOJIS: readonly string[] = ["🎉", "🎈", "✨", "🥳", "🎁", "🍰", "🎂", "🪅", "⭐", "💃"];
const BALLOON_COLORS: readonly string[] = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ce82ff", "#ff6fb5"];

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export interface FunDeps {
  say(text: string): void;
  hero: HTMLElement;
  mascot: HTMLImageElement;
  arena: HTMLDivElement;
  score: HTMLElement;
  confetti: HTMLCanvasElement;
}

export interface FunHandle {
  /** Stops everything and returns the balloon score. */
  stop(): number;
}

/** Keeps the visitor entertained while the photo is being made. */
export function startFun(d: FunDeps): FunHandle {
  const timers = new Set<number>();
  let running = true;
  let popped = 0;
  d.score.textContent = "🎈 0";

  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (running) fn();
    }, ms);
    timers.add(id);
  };

  // 1) A story, told line by line (random story every run, then jokes).
  const queue: string[] = [...pick(STORIES)];
  const storyStep = (): void => {
    if (queue.length === 0) queue.push(...shuffled(FILLERS));
    const line = queue.shift() ?? "";
    d.say(line);
    later(storyStep, 3800 + line.length * 45);
  };
  storyStep();

  // 2) The character does a different trick every few seconds.
  let lastAct = "";
  const actStep = (): void => {
    let a = pick(ACTIONS);
    while (a === lastAct) a = pick(ACTIONS);
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
  const emoStep = (): void => {
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
  const popperStep = (): void => {
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
  const pop = (b: HTMLElement, golden: boolean): void => {
    if (b.classList.contains("popped")) return;
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
    if (golden) d.say("GOLDEN balloon! +5 🌟 Waah, aap to pro nikle!");
    window.setTimeout(() => b.remove(), 160);
  };
  const balloonStep = (): void => {
    if (d.arena.childElementCount < 8) {
      const golden = Math.random() < 0.1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = golden ? "balloon golden" : "balloon";
      b.setAttribute("aria-label", "Balloon phodo");
      b.style.left = `${rnd(3, 86).toFixed(1)}%`;
      b.style.setProperty("--c", golden ? "#ffc800" : pick(BALLOON_COLORS));
      b.style.setProperty("--t", `${rnd(4.5, 7.5).toFixed(1)}s`);
      b.addEventListener("animationend", (e: AnimationEvent) => {
        if (e.animationName === "balloon-up") b.remove();
      });
      b.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        pop(b, golden);
      });
      d.arena.append(b);
    }
    later(balloonStep, rnd(800, 1400));
  };
  balloonStep();

  return {
    stop(): number {
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
