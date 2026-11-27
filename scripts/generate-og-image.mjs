// מייצר את תמונת ה-Open Graph (1200x630) של האתר הציבורי מתוך הלוגו והכותרת, ברינדור Chromium אמיתי.
// הרצה: node scripts/generate-og-image.mjs  (פלט: marketing/src/static/og-image.png)
import {readFile, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const svg = await readFile(join(root, "public", "favicon.svg"), "utf8");
const fontDir = join(root, "marketing", "src", "fonts");
const font = (name) => `url(data:font/woff2;base64,${readFileSyncBase64(name)}) format('woff2')`;
const cache = new Map();
function readFileSyncBase64(name) { return cache.get(name); }
for (const name of ["FrankRuhlLibre-700-hebrew.woff2", "FrankRuhlLibre-700-latin.woff2", "Heebo-400-hebrew.woff2"]) cache.set(name, (await readFile(join(fontDir, name))).toString("base64"));

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'FRL';font-weight:700;src:${font("FrankRuhlLibre-700-hebrew.woff2")};unicode-range:U+0590-05FF}
@font-face{font-family:'FRL';font-weight:700;src:${font("FrankRuhlLibre-700-latin.woff2")}}
@font-face{font-family:'HB';font-weight:400;src:${font("Heebo-400-hebrew.woff2")};unicode-range:U+0590-05FF}
body{margin:0;width:1200px;height:630px;background:#061128;color:#f3f4f8;font-family:'HB',Arial,sans-serif;position:relative;overflow:hidden}
.glow{position:absolute;inset:0;background:radial-gradient(55% 50% at 88% 12%,rgba(212,175,55,.18),transparent 60%)}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 88px;gap:22px}
.brand{display:flex;align-items:center;gap:22px;color:#e2e8f0;font-size:34px;letter-spacing:.08em;font-family:'FRL',serif}
h1{font-family:'FRL',serif;font-size:76px;line-height:1.15;margin:0;max-width:20ch;color:#fff}
p{font-size:30px;color:#b7c0d3;margin:0;max-width:34ch;line-height:1.5}
.tag{display:inline-block;margin-top:10px;font-size:26px;color:#d4af37;font-weight:700}
</style></head><body><div class="glow"></div><div class="wrap">
<div class="brand">${svg.replace('width="200" height="200"', 'width="96" height="96"')}<span>SYNCASH</span></div>
<h1>תיק אחד. הגשה אחת. יותר אפשרויות מימון.</h1>
<p>מערכת ליועצי משכנתאות: הגשה מרוכזת לחברות המימון הפעילות במערכת, בלי להחליף את היועץ.</p>
<span class="tag">חינם ליועצי משכנתאות</span>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
  await page.setContent(html);
  // eslint-disable-next-line no-undef -- רץ בתוך הדפדפן
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({type: "png", clip: {x: 0, y: 0, width: 1200, height: 630}});
  await writeFile(join(root, "marketing", "src", "static", "og-image.png"), png);
  console.log("og-image.png written", png.length, "bytes");
} finally {
  await browser.close();
}
