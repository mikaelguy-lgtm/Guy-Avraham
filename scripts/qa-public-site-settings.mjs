// QA ידני-אוטומטי להגדרות האתר הציבורי: התחברות כ-SUPER_ADMIN, צילום המסך, הזנת מספר WhatsApp,
// אימות שהאתר הציבורי מציג את הכפתור מיד (ללא פריסה), והחזרה למספר הזמני. גם מאמת favicon באפליקציה.
// הרצה: node scripts/qa-public-site-settings.mjs <appUrl> <siteUrl> <outDir>
/* global console, process */
import "dotenv/config";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {chromium} from "@playwright/test";

const app = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const site = (process.argv[3] ?? "http://127.0.0.1:4180").replace(/\/$/, "");
const out = process.argv[4] ?? "qa-output";
await mkdir(out, {recursive: true});
const email = process.env.E2E_SUPER_ADMIN_EMAIL;
const password = process.env.E2E_SUPER_ADMIN_PASSWORD;
if (!email || !password) throw new Error("E2E_SUPER_ADMIN_EMAIL/PASSWORD required");

const browser = await chromium.launch();
const results = {};
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, locale: "he-IL"});
  const page = await context.newPage();
  await page.goto(`${app}/login`);
  results.appFavicon = await page.evaluate(() => [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((l) => `${l.rel}:${l.getAttribute("href")}`));
  const icon = await page.request.get(`${app}/favicon.svg`);
  results.appFaviconStatus = icon.status();
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await page.waitForURL(/\/admin$/);
  await page.screenshot({path: join(out, "app-admin-home.jpeg"), type: "jpeg", quality: 70});

  await page.goto(`${app}/admin/settings`);
  await page.getByRole("link", {name: /האתר הציבורי/}).click();
  await page.waitForURL(/\/admin\/settings\/public-site$/);
  await page.getByText("השינויים באתר הציבורי נכנסים לתוקף ללא צורך בפריסה מחדש.").waitFor();
  results.placeholderNotice = await page.getByText("מספר זמני — כפתור WhatsApp אינו פעיל באתר.").isVisible();
  await page.screenshot({path: join(out, "admin-public-site-before.jpeg"), type: "jpeg", quality: 70, fullPage: true});

  // מספר לא תקין נדחה
  await page.getByLabel("מספר WhatsApp עסקי").fill("javascript:alert(1)");
  await page.getByRole("button", {name: "שמירת פרטי WhatsApp"}).click();
  await page.getByRole("alert").first().waitFor();
  results.invalidRejected = await page.getByRole("alert").first().textContent();

  // מספר תקין: האתר הציבורי מציג את הכפתור מיד
  await page.getByLabel("מספר WhatsApp עסקי").fill("0501234567");
  await page.getByRole("button", {name: "שמירת פרטי WhatsApp"}).click();
  await page.getByText("פרטי ה-WhatsApp נשמרו.").waitFor();
  results.normalized = await page.getByLabel("מספר WhatsApp עסקי").inputValue();
  await page.screenshot({path: join(out, "admin-public-site-after.jpeg"), type: "jpeg", quality: 70, fullPage: true});

  const publicPage = await context.newPage();
  await publicPage.goto(`${site}/`, {waitUntil: "networkidle"});
  results.publicWhatsappLink = await publicPage.evaluate(() => { const a = [...document.querySelectorAll("[data-whatsapp]")].find((n) => !n.hidden); return a ? {href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel")} : null; });
  await publicPage.screenshot({path: join(out, "site-home-with-whatsapp.jpeg"), type: "jpeg", quality: 70});
  await publicPage.setViewportSize({width: 390, height: 844});
  await publicPage.reload({waitUntil: "networkidle"});
  results.mobileFloatVisible = await publicPage.locator(".whatsapp-float").isVisible();
  await publicPage.screenshot({path: join(out, "site-home-mobile-whatsapp.jpeg"), type: "jpeg", quality: 70});
  await publicPage.close();

  // חזרה למספר הזמני (סביבת פיתוח)
  await page.getByLabel("מספר WhatsApp עסקי").fill("000000000");
  await page.getByRole("button", {name: "שמירת פרטי WhatsApp"}).click();
  await page.getByText("פרטי ה-WhatsApp נשמרו.").waitFor();
  results.placeholderRestored = await page.getByText("מספר זמני — כפתור WhatsApp אינו פעיל באתר.").isVisible();

  // ה-audit לא מכיל את המספר
  await page.goto(`${app}/admin/audit`);
  // ה-SSE של מרכז ההתראות נשאר פתוח, ולכן networkidle לעולם לא מגיע — ממתינים לרשומה עצמה
  await page.locator("table.data-table tbody tr").first().waitFor({timeout: 20000});
  const auditText = await page.locator("table.data-table").innerText();
  results.auditMentionsNumber = auditText.includes("972501234567") || auditText.includes("0501234567");
  results.auditHasEvent = auditText.includes("PUBLIC_SITE_SETTINGS_UPDATED");
  await context.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
