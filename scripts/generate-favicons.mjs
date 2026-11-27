// יוצר את סט ה-favicon של SynCash מתוך סמל הלוגו הקיים (SynCashLogo.tsx),
// באמצעות רינדור אמיתי ב-Chromium (Playwright) ולא באמצעות ספריית SVG.
// פלט: public/ (האפליקציה) + marketing/src/static/ (האתר הציבורי).
// הרצה: node scripts/generate-favicons.mjs
import {mkdir, writeFile, copyFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {chromium} from "@playwright/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appPublic = join(root, "public");
const marketingStatic = join(root, "marketing", "src", "static");

// אותם נתיבים וגרדיאנטים בדיוק כמו ב-src/components/SynCashLogo.tsx
const symbol = `
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF099"/><stop offset="30%" stop-color="#D4AF37"/>
      <stop offset="70%" stop-color="#AA7C11"/><stop offset="100%" stop-color="#F3E5AB"/>
    </linearGradient>
    <linearGradient id="s" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#E2E8F0"/>
      <stop offset="70%" stop-color="#94A3B8"/><stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
  </defs>
  <path d="M170,45 C150,25 100,25 70,45 C40,65 42,105 75,120 C85,125 105,125 125,120 C110,123 90,121 82,115 C62,100 58,75 80,62 C95,52 135,52 150,65 L170,45 Z" fill="url(#g)"/>
  <path d="M70,155 C90,175 140,175 170,155 C200,135 198,95 165,80 C155,75 135,75 115,80 C130,77 150,79 158,85 C178,100 182,125 160,138 C145,148 105,148 90,135 L70,155 Z" fill="url(#s)"/>
  <rect x="100" y="110" width="12" height="18" rx="2" fill="url(#g)"/>
  <rect x="118" y="95" width="12" height="33" rx="2" fill="url(#g)"/>
  <rect x="136" y="75" width="12" height="53" rx="2" fill="url(#g)"/>`;

// רקע כהה מעוגל (צבע הרקע של המותג) כדי שהסמל הכסוף/זהוב יישאר קריא גם על לשונית דפדפן בהירה.
// הסמל ממורכז וממלא ~82% מהריבוע (אזור בטוח ל-maskable icons).
function iconSvg(size, radiusRatio) {
  const r = Math.round(size * radiusRatio);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="${(r / size) * 200}" fill="#061128"/>
  <g transform="translate(20 20) scale(0.8)">${symbol}</g>
</svg>`;
}

const targets = [
  {file: "favicon-16x16.png", size: 16, radius: 0.2},
  {file: "favicon-32x32.png", size: 32, radius: 0.2},
  {file: "favicon-48x48.png", size: 48, radius: 0.2},
  {file: "apple-touch-icon.png", size: 180, radius: 0},
  {file: "icon-192.png", size: 192, radius: 0.18},
  {file: "icon-512.png", size: 512, radius: 0.18}
];

await mkdir(appPublic, {recursive: true});
await mkdir(marketingStatic, {recursive: true});
await writeFile(join(appPublic, "favicon.svg"), iconSvg(200, 0.2));

const browser = await chromium.launch();
try {
  for (const target of targets) {
    const page = await browser.newPage({viewport: {width: target.size, height: target.size}, deviceScaleFactor: 1});
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${iconSvg(target.size, target.radius)}</body></html>`);
    const png = await page.screenshot({omitBackground: true, type: "png", clip: {x: 0, y: 0, width: target.size, height: target.size}});
    await writeFile(join(appPublic, target.file), png);
    await page.close();
    console.log("wrote", target.file, target.size);
  }
} finally {
  await browser.close();
}

for (const name of ["favicon.svg", ...targets.map((t) => t.file)]) await copyFile(join(appPublic, name), join(marketingStatic, name));
console.log("favicon PNG/SVG set generated for app + marketing");
