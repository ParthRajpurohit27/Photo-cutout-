interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  round: boolean;
}

export interface BurstOptions {
  x: number;
  y: number;
  /** Direction in radians (-PI/2 = straight up). Ignored for a full-circle burst. */
  angle?: number;
  /** Spread in radians. Default: full circle. */
  spread?: number;
  count?: number;
  speed?: number;
}

const COLORS: readonly string[] = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ffc800", "#ce82ff", "#ffffff"];

const pieces: Piece[] = [];
let raf = 0;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Confetti burst. Many bursts can overlap: they share one animation loop. */
export function burst(canvas: HTMLCanvasElement, o: BurstOptions): void {
  if (reducedMotion()) return;
  const g = canvas.getContext("2d");
  if (!g) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = o.count ?? 60;
  const speed = o.speed ?? 10;
  const spread = o.spread ?? Math.PI * 2;
  const angle = o.angle ?? 0;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.45 + Math.random() * 0.75);
    pieces.push({
      x: o.x,
      y: o.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#58cc02",
      round: Math.random() < 0.3,
    });
  }
  if (raf === 0) raf = requestAnimationFrame(() => loop(canvas, g));
}

function loop(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D): void {
  const H = window.innerHeight;
  g.clearRect(0, 0, window.innerWidth, H);
  let w = 0;
  for (const p of pieces) {
    p.vy += 0.3;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.y > H + 30) continue;
    pieces[w++] = p;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.color;
    if (p.round) {
      g.beginPath();
      g.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    g.restore();
  }
  pieces.length = w;
  if (w > 0) {
    raf = requestAnimationFrame(() => loop(canvas, g));
  } else {
    raf = 0;
    g.clearRect(0, 0, window.innerWidth, H);
  }
}
