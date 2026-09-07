import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, 'auth-compare');
mkdirSync(out, { recursive: true });

const BASE = process.env.APP_URL || 'http://localhost:4200';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const route of ['login', 'register']) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, `${route}.png`) });
  const box = await page.evaluate(() => {
    const panel = document.querySelector('.auth-visual');
    const orb = document.querySelector('.orb');
    const h1 = document.querySelector('.auth-visual h1');
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const p = r(panel);
    const o = r(orb);
    const t = r(h1);
    return {
      panelHeight: p && Math.round(p.height),
      orbTopInPanel: o && p ? Math.round(o.top - p.top) : null,
      titleTopInPanel: t && p ? Math.round(t.top - p.top) : null,
      gapOrbToTitle: o && t ? Math.round(t.top - o.bottom) : null,
    };
  });
  console.log(route, JSON.stringify(box));
}

await browser.close();
