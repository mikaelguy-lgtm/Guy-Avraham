// QA אוטומטי לאתר הציבורי: צילומי מסך בכל הרזולוציות הנדרשות, בדיקת SEO בסיסית,
// וביקורת runtime: cookies / localStorage / sessionStorage / IndexedDB / בקשות לצד שלישי / שגיאות console.
// הרצה: node scripts/qa-marketing-site.mjs <baseUrl> <outDir>
/* global console, process */
import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {chromium} from "@playwright/test";

const base = (process.argv[2] ?? "http://127.0.0.1:4180").replace(/\/$/, "");
const out = process.argv[3] ?? "qa-output";
await mkdir(out, {recursive: true});

const pages = ["/", "/how-it-works/", "/for-mortgage-advisors/", "/non-bank-financing/", "/mortgage-reform-2026/", "/faq/", "/about/", "/accessibility/", "/legal/terms/", "/legal/privacy/", "/legal/dpa/", "/legal/privacy-requests/", "/does-not-exist/"];
const viewports = [{name: "1440x900", width: 1440, height: 900}, {name: "1366x768", width: 1366, height: 768}, {name: "390x844", width: 390, height: 844, mobile: true}, {name: "360x740", width: 360, height: 740, mobile: true}];
const origin = new URL(base).origin;

const browser = await chromium.launch();
const report = {pages: {}, thirdParty: [], consoleErrors: [], storage: {}, cookies: []};
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({viewport: {width: viewport.width, height: viewport.height}, isMobile: viewport.mobile === true, hasTouch: viewport.mobile === true, locale: "he-IL"});
    const page = await context.newPage();
    page.on("request", (request) => { if (!request.url().startsWith(origin)) report.thirdParty.push(`${viewport.name} ${request.url()}`); });
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name} ${page.url()} ${message.text()}`); });
    page.on("pageerror", (error) => report.consoleErrors.push(`${viewport.name} ${page.url()} ${error.message}`));
    for (const path of pages) {
      const response = await page.goto(`${base}${path}`, {waitUntil: "networkidle"});
      const name = path === "/" ? "home" : path.replace(/^\/|\/$/g, "").replace(/\//g, "-");
      await page.screenshot({path: join(out, `${name}-${viewport.name}.jpeg`), fullPage: true, type: "jpeg", quality: 70});
      if (viewport.name === "1440x900") {
        const info = await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
          robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
          h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
          jsonLdTypes: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { try { const data = JSON.parse(s.textContent); return (Array.isArray(data) ? data : [data]).map((item) => item["@type"]); } catch { return ["INVALID_JSON"]; } }),
          favicon: !!document.querySelector('link[rel="icon"][href="/favicon.svg"]'),
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          skipLink: !!document.querySelector(".skip-link"),
          whatsappVisible: [...document.querySelectorAll("[data-whatsapp]")].some((n) => !n.hidden),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          imagesWithoutAlt: [...document.querySelectorAll("img")].filter((img) => !img.hasAttribute("alt")).length
        }));
        report.pages[path] = {status: response?.status(), ...info};
      }
      if (viewport.mobile) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (overflow) report.consoleErrors.push(`${viewport.name} ${path}: HORIZONTAL OVERFLOW`);
      }
    }
    if (viewport.name === "1440x900") {
      await page.goto(`${base}/`, {waitUntil: "networkidle"});
      report.storage = await page.evaluate(async () => ({
        localStorage: Object.keys(localStorage), sessionStorage: Object.keys(sessionStorage),
        indexedDB: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).map((db) => db.name) : "unsupported"
      }));
      report.cookies = await context.cookies();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
