export interface AdPalette {
  bg: string;
  ink: string;
  accent: string;
  card: string;
  muted: string;
}

export interface AdPlan {
  seed: number;
  format: 'poster' | 'split' | 'cards' | 'band';
  width: number;
  height: number;
  palette: AdPalette;
  headline: string;
  brand: string;
  features: string[];
}

const HEADLINE = 'Your store, Your clients, Your hub';
const BRAND = 'My Stores Hubs';
const SITE = 'www.mystoreshubs.com';

const FEATURES = [
  'Free hub. No .com website needed.',
  'Search every store from one box.',
  'Each product has its own page, in rupees.',
  'English, Hindi, Spanish, French, and Chinese.',
  'Switch the whole site White or Black.',
  'Hub, clients, and employees from one workbook.',
  'UPI, cash on delivery, or the counter.',
  'Store name and order count on the mall.',
];

const PALETTES: AdPalette[] = [
  { bg: '#0b1f3a', ink: '#f8fafc', accent: '#38bdf8', card: '#132a4a', muted: '#cbd5e1' },
  { bg: '#f7f4ef', ink: '#1c1917', accent: '#1d4ed8', card: '#ffffff', muted: '#57534e' },
  { bg: '#052e2b', ink: '#ecfdf5', accent: '#34d399', card: '#0f3d38', muted: '#a7f3d0' },
  { bg: '#111827', ink: '#f9fafb', accent: '#f59e0b', card: '#1f2937', muted: '#d1d5db' },
];

const FORMATS = ['poster', 'split', 'cards', 'band'] as const;

const SIZES: Record<AdPlan['format'], { width: number; height: number }> = {
  poster: { width: 1080, height: 1350 },
  split: { width: 1080, height: 1080 },
  cards: { width: 1080, height: 1350 },
  band: { width: 1600, height: 900 },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

export function planAd(seed: number): AdPlan {
  const rand = mulberry32(seed);
  const format = FORMATS[Math.floor(rand() * FORMATS.length)];
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];
  return {
    seed: seed >>> 0,
    format,
    ...SIZES[format],
    palette,
    headline: HEADLINE,
    brand: BRAND,
    features: shuffle(FEATURES, rand).slice(0, 4),
  };
}

export function nextAdSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] || (Date.now() >>> 0);
}

let sealImage: Promise<HTMLImageElement | null> | null = null;

function loadSeal(): Promise<HTMLImageElement | null> {
  if (!sealImage) {
    sealImage = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'assets/mystoreshubs-seal.png';
    });
  }
  return sealImage;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  seal: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  ring: string
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  if (seal) {
    ctx.drawImage(seal, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = '#0b1f3a';
    ctx.font = `700 ${Math.round(size * 0.12)}px Syne, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('My Stores Hubs', cx, cy);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 6, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 8;
  ctx.stroke();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign
): number {
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function paintPoster(ctx: CanvasRenderingContext2D, plan: AdPlan, seal: HTMLImageElement | null): void {
  const { width, palette } = plan;
  drawSeal(ctx, seal, width / 2, 250, 300, palette.accent);
  ctx.fillStyle = palette.ink;
  ctx.font = '700 62px Syne, "Segoe UI", sans-serif';
  const lines = wrap(ctx, plan.headline, width - 160);
  let y = drawLines(ctx, lines, width / 2, 460, 74, 'center');
  ctx.fillStyle = palette.accent;
  ctx.font = '700 32px "IBM Plex Sans", "Segoe UI", sans-serif';
  y = drawLines(ctx, [plan.brand], width / 2, y + 16, 40, 'center');
  paintFeatureStack(ctx, plan, 80, y + 48, width - 160);
}

function paintFeatureStack(
  ctx: CanvasRenderingContext2D,
  plan: AdPlan,
  x: number,
  y: number,
  width: number
): void {
  plan.features.forEach((feature, index) => {
    const top = y + index * 118;
    fillRound(ctx, x, top, width, 100, 22, plan.palette.card);
    ctx.fillStyle = plan.palette.accent;
    ctx.beginPath();
    ctx.arc(x + 42, top + 50, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = plan.palette.ink;
    ctx.font = '600 30px "IBM Plex Sans", "Segoe UI", sans-serif';
    const lines = wrap(ctx, feature, width - 110);
    drawLines(ctx, lines.slice(0, 2), x + 72, top + (lines.length > 1 ? 22 : 34), 36, 'left');
  });
}

function paintSplit(ctx: CanvasRenderingContext2D, plan: AdPlan, seal: HTMLImageElement | null): void {
  ctx.fillStyle = plan.palette.card;
  ctx.fillRect(0, 0, 440, plan.height);
  drawSeal(ctx, seal, 220, 390, 280, plan.palette.accent);
  ctx.fillStyle = plan.palette.ink;
  ctx.font = '700 34px Syne, "Segoe UI", sans-serif';
  drawLines(ctx, wrap(ctx, plan.brand, 340), 220, 580, 42, 'center');
  ctx.font = '700 48px Syne, "Segoe UI", sans-serif';
  const lines = wrap(ctx, plan.headline, 520);
  const y = drawLines(ctx, lines, 500, 120, 58, 'left');
  paintFeatureStack(ctx, plan, 500, y + 36, 500);
}

function paintCards(ctx: CanvasRenderingContext2D, plan: AdPlan, seal: HTMLImageElement | null): void {
  drawSeal(ctx, seal, plan.width / 2, 210, 240, plan.palette.accent);
  ctx.fillStyle = plan.palette.ink;
  ctx.font = '700 54px Syne, "Segoe UI", sans-serif';
  const lines = wrap(ctx, plan.headline, plan.width - 160);
  let y = drawLines(ctx, lines, plan.width / 2, 380, 64, 'center');
  ctx.fillStyle = plan.palette.accent;
  ctx.font = '700 28px "IBM Plex Sans", "Segoe UI", sans-serif';
  y = drawLines(ctx, [plan.brand], plan.width / 2, y + 8, 36, 'center');
  const cardW = 440;
  const cardH = 220;
  const gap = 28;
  const left = (plan.width - cardW * 2 - gap) / 2;
  const top = y + 48;
  plan.features.forEach((feature, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = left + col * (cardW + gap);
    const cy = top + row * (cardH + gap);
    fillRound(ctx, x, cy, cardW, cardH, 28, plan.palette.card);
    ctx.fillStyle = plan.palette.accent;
    ctx.beginPath();
    ctx.arc(x + 36, cy + 56, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = plan.palette.ink;
    ctx.font = '600 32px "IBM Plex Sans", "Segoe UI", sans-serif';
    const wrapped = wrap(ctx, feature, cardW - 88);
    drawLines(ctx, wrapped.slice(0, 3), x + 58, cy + 40, 40, 'left');
  });
}

function paintBand(ctx: CanvasRenderingContext2D, plan: AdPlan, seal: HTMLImageElement | null): void {
  drawSeal(ctx, seal, 300, plan.height / 2 - 30, 360, plan.palette.accent);
  ctx.fillStyle = plan.palette.ink;
  ctx.font = '700 58px Syne, "Segoe UI", sans-serif';
  const lines = wrap(ctx, plan.headline, 900);
  let y = drawLines(ctx, lines, 560, 90, 68, 'left');
  ctx.fillStyle = plan.palette.accent;
  ctx.font = '700 30px "IBM Plex Sans", "Segoe UI", sans-serif';
  y = drawLines(ctx, [plan.brand], 560, y + 8, 38, 'left');
  const cardW = 470;
  plan.features.forEach((feature, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 560 + col * (cardW + 24);
    const cy = y + 36 + row * 130;
    fillRound(ctx, x, cy, cardW, 112, 20, plan.palette.card);
    ctx.fillStyle = plan.palette.ink;
    ctx.font = '600 26px "IBM Plex Sans", "Segoe UI", sans-serif';
    const wrapped = wrap(ctx, feature, cardW - 48);
    drawLines(ctx, wrapped.slice(0, 2), x + 24, cy + (wrapped.length > 1 ? 24 : 40), 32, 'left');
  });
}

function paintAd(plan: AdPlan, seal: HTMLImageElement | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the ad');
  ctx.fillStyle = plan.palette.bg;
  ctx.fillRect(0, 0, plan.width, plan.height);
  const rand = mulberry32(plan.seed ^ 0x9e3779b9);
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.fillStyle = plan.palette.accent;
    ctx.arc(
      rand() * plan.width,
      rand() * plan.height,
      80 + rand() * 180,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
  if (plan.format === 'poster') paintPoster(ctx, plan, seal);
  else if (plan.format === 'split') paintSplit(ctx, plan, seal);
  else if (plan.format === 'cards') paintCards(ctx, plan, seal);
  else paintBand(ctx, plan, seal);
  ctx.fillStyle = plan.palette.muted;
  ctx.font = '500 24px "IBM Plex Sans", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(SITE, plan.width / 2, plan.height - 28);
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the ad'))), 'image/png');
  });
}

export async function downloadAdPoster(): Promise<AdPlan> {
  const plan = planAd(nextAdSeed());
  const seal = await loadSeal();
  const blob = await canvasBlob(paintAd(plan, seal));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `MyStoresHubs-${plan.format}-${plan.seed.toString(36)}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return plan;
}
