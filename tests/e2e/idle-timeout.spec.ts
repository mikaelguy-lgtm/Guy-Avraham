import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// ניתוק אוטומטי אחרי 5 דקות ללא פעילות. הזמן בדפדפן מזויף (page.clock, מותקן לפני טעינת
// האפליקציה כך שגם הטיימרים של ה-IdleSessionProvider מזויפים) כדי לא לחכות דקות אמיתיות;
// השרת נבדק בנפרד ב-tests/integration/idleSessionEnforcement.test.ts.
const MINUTE = 60_000;
const WARNING_TEXT = "לא זיהינו פעילות במערכת. מטעמי אבטחה המערכת תתנתק בעוד";
const LOGOUT_TEXT = "החיבור נותק לאחר מספר דקות ללא פעילות. ניתן להתחבר מחדש.";

function credentials(role: "SUPER_ADMIN" | "ADVISOR") {
  const email = role === "SUPER_ADMIN" ? process.env.E2E_SUPER_ADMIN_EMAIL : process.env.E2E_ADVISOR_EMAIL;
  const password = role === "SUPER_ADMIN" ? process.env.E2E_SUPER_ADMIN_PASSWORD : process.env.E2E_ADVISOR_PASSWORD;
  if (!email || !password) throw new Error(`E2E credentials for ${role} are required`);
  return {email, password};
}

// השעון המזויף מותקן לפני הניווט הראשון ומתקדם בזמן אמת; runFor מקפיץ אותו קדימה.
async function login(page: Page, role: "SUPER_ADMIN" | "ADVISOR") {
  await page.clock.install({time: Date.now()});
  const {email, password} = credentials(role);
  await page.goto("/login");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await expect(page).toHaveURL(role === "SUPER_ADMIN" ? /\/admin$/ : /\/advisor$/);
  // ממתינים שהאפליקציה תסיים את הטעינה הראשונית, ואז מקפיאים את השעון: מכאן הזמן זז רק דרך runFor,
  // כך שזמן אמיתי שעובר בין פעולות הבדיקה (במיוחד בין שתי לשוניות) לא נספר כחוסר פעילות.
  await expect(page.getByRole("button", {name: "יציאה"}).first()).toBeVisible();
  await page.clock.pauseAt(Date.now());
}

const warning = (page: Page) => page.getByRole("alertdialog");

test.describe("idle timeout — client behaviour with a faked clock", () => {
  test("A/B/C/D: still active at 4:29, warns at 4:30 with a countdown, continue resets, logs out at 5:00", async ({page}) => {
    await login(page, "SUPER_ADMIN");

    await page.clock.runFor(4 * MINUTE + 29_000);
    await expect(warning(page)).toHaveCount(0);

    await page.clock.runFor(2_000);
    await expect(warning(page)).toBeVisible();
    await expect(warning(page)).toContainText(WARNING_TEXT);
    const countdown = warning(page).locator(".idle-countdown");
    const first = Number(await countdown.textContent());
    expect(first).toBeLessThanOrEqual(30);
    await page.clock.runFor(3_000);
    await expect(countdown).not.toHaveText(String(first));
    expect(Number(await countdown.textContent())).toBeLessThan(first);

    // "המשך עבודה" מאפס את הטיימר
    await warning(page).getByRole("button", {name: "המשך עבודה"}).click();
    await expect(warning(page)).toHaveCount(0);
    await page.clock.runFor(4 * MINUTE);
    await expect(warning(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin$/);

    // ללא פעילות: אזהרה ב-4:30 וניתוק ב-5:00
    await page.clock.runFor(31_000);
    await expect(warning(page)).toBeVisible();
    await page.clock.runFor(31_000);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(LOGOUT_TEXT)).toBeVisible();
  });

  test("E/F: an open SSE stream and background polling do not keep the session alive", async ({page}) => {
    await login(page, "SUPER_ADMIN");
    // ה-SSE של מרכז ההתראות כבר פתוח אחרי ההתחברות; מוסיפים גם polling מלאכותי ברקע.
    await page.evaluate(() => { window.setInterval(() => { void fetch("/api/health"); }, 10_000); });
    await page.clock.runFor(5 * MINUTE + 5_000);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(LOGOUT_TEXT)).toBeVisible();
  });

  test("real activity (mouse/keyboard/scroll) resets the timer", async ({page}) => {
    await login(page, "SUPER_ADMIN");
    await page.clock.runFor(4 * MINUTE);
    await page.mouse.click(5, 5);
    await page.clock.runFor(3 * MINUTE);
    await expect(warning(page)).toHaveCount(0);
    await page.keyboard.press("Shift");
    await page.clock.runFor(4 * MINUTE);
    await expect(warning(page)).toHaveCount(0);
    await page.mouse.wheel(0, 50);
    await page.clock.runFor(4 * MINUTE + 20_000);
    await expect(warning(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("applies to ADVISOR as well", async ({page}) => {
    await login(page, "ADVISOR");
    await page.clock.runFor(4 * MINUTE + 31_000);
    await expect(warning(page)).toBeVisible();
    await page.clock.runFor(31_000);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("idle timeout — multi-tab", () => {
  let context: BrowserContext;
  test.beforeEach(async ({browser}) => { context = await browser.newContext(); });
  test.afterEach(async () => { await context.close(); });

  // השעון המזויף של Playwright הוא ברמת ה-BrowserContext: התקנה/הקפאה/runFor אחת חלות על שתי הלשוניות יחד.
  test("G: activity in one tab keeps the other tab alive; H: logout in one tab logs out the other", async () => {
    const first = await context.newPage();
    await login(first, "SUPER_ADMIN"); // מתקין ומקפיא את השעון המשותף
    const second = await context.newPage();
    await second.goto("/admin/cases");
    await expect(second).toHaveURL(/\/admin\/cases$/);
    await expect(second.getByRole("button", {name: "יציאה"}).first()).toBeVisible();

    // G: 4 דקות שקט בשתי הלשוניות, ואז פעילות רק בלשונית השנייה
    await first.clock.runFor(4 * MINUTE);
    await second.mouse.click(5, 5);
    await first.waitForTimeout(500); // מסירת ההודעה בין הלשוניות (BroadcastChannel / storage) היא אסינכרונית
    await first.clock.runFor(2 * MINUTE);
    await expect(first.getByRole("alertdialog")).toHaveCount(0);
    await expect(second.getByRole("alertdialog")).toHaveCount(0);
    await expect(first).toHaveURL(/\/admin$/);
    await expect(second).toHaveURL(/\/admin\/cases$/);

    // H: יציאה מהלשונית השנייה מנתקת גם את הראשונה
    // יציאה ידנית מציגה את מסך ההתחברות (הנתיב עצמו לא משתנה); הלשונית האחרת מנותבת ל-/login
    await second.getByRole("button", {name: "יציאה"}).first().click();
    await expect(second.getByRole("heading", {name: "כניסה מאובטחת"})).toBeVisible();
    await expect(first).toHaveURL(/\/login$/, {timeout: 15_000});
    await expect(first.getByRole("heading", {name: "כניסה מאובטחת"})).toBeVisible();
  });
});
