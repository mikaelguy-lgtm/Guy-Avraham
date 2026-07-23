import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const screenshotDirectory = "output/playwright";
const prohibitedTechnicalText = /\b(firstName|lastName|identityNumber|propertyValue|requestedAmount|employmentType|monthlyLiabilities|requestedTermMonths|PURCHASE|REFINANCE|CONSOLIDATION|SALARIED|SELF_EMPLOYED|APARTMENT|HOUSE|CENTER|NORTH|SOUTH|JERUSALEM)\b/;

async function login(page: Page): Promise<string> {
  const email = process.env.E2E_ADVISOR_EMAIL;
  const password = process.env.E2E_ADVISOR_PASSWORD;
  if (!email || !password) throw new Error("E2E advisor credentials are required");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticatedRequest = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticatedRequest).headers().authorization ?? "";
}

async function capture(page: Page, fileName: string, fullPage = true) {
  await page.screenshot({path: `${screenshotDirectory}/${fileName}`, fullPage, animations: "disabled"});
}

async function assertHebrewUi(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(prohibitedTechnicalText);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
}

test("advisor visual journey is Hebrew, RTL and responsive", async ({page, request}) => {
  await mkdir(screenshotDirectory, {recursive: true});
  let clientId = 0;
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto("/");
  await capture(page, "advisor-login.png");
  let advisorAuthorization = "";

  try {
    advisorAuthorization = await login(page);
    await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
    await assertHebrewUi(page);
    await capture(page, "advisor-dashboard.png");

    await page.getByRole("link", {name: "תיק חדש"}).click();
    await expect(page.getByText("פרטים אישיים", {exact: true}).first()).toBeVisible();
    await assertHebrewUi(page);
    await capture(page, "advisor-wizard-step-1.png");
    await page.getByRole("button", {name: "הבא"}).click();
    await expect(page.getByText("יש להשלים את כל השדות המסומנים לפני המעבר לשלב הבא.")).toBeVisible();
    await expect(page.getByText("יש להזין שם פרטי")).toBeVisible();
    await page.getByLabel("שם פרטי").fill("נועה");
    await page.getByLabel("שם משפחה").fill("כהן");
    await page.getByLabel("מספר תעודת זהות").fill("123456782");
    await page.getByLabel("תאריך לידה").fill("1988-02-10");
    await page.getByLabel("טלפון").fill("0501234567");
    await page.getByLabel("דוא״ל").fill("visual-check@syncash.local");
    await page.getByLabel("כתובת מגורים").fill("רחוב החזון 4, רמת גן");
    await page.getByLabel("מצב משפחתי").selectOption("MARRIED");
    await page.getByLabel("מספר ילדים").fill("3");
    await expect(page.getByLabel(/^גיל ילד/)).toHaveCount(3);
    await page.getByLabel("גיל ילד 1").fill("2");
    await page.getByLabel("גיל ילד 2").fill("6");
    await page.getByLabel("גיל ילד 3").fill("9");
    await page.getByLabel("מספר לווים בתיק").fill("1");
    await page.getByRole("button", {name: "הבא"}).click();
    await capture(page, "advisor-wizard-step-2.png");
    await page.getByLabel("סוג תעסוקה").selectOption("SALARIED");
    await page.getByLabel("שם המעסיק או העסק").fill("חברת בדיקה מקומית");
    await page.getByLabel("תפקיד").fill("מנהלת לקוחות");
    await page.getByLabel("ותק בשנים").fill("7");
    await page.getByLabel("הכנסה חודשית נטו").fill("24000");
    await page.getByLabel("האם קיימת הכנסה נוספת").selectOption("yes");
    await page.getByLabel("סוג הכנסה נוספת").selectOption("REGULAR_BONUSES");
    await page.getByLabel("סכום הכנסה נוספת חודשי").fill("2000");
    await page.getByLabel("התחייבויות חודשיות").fill("1200");
    await page.getByLabel("יתרת משכנתה קיימת").fill("350000");
    await page.getByLabel("החזר משכנתה חודשי").fill("3800");
    await page.getByRole("button", {name: "הבא"}).click();
    await capture(page, "advisor-wizard-step-3.png");
    await page.getByLabel("סוג העסקה").selectOption("MORTGAGE_REFINANCE");
    await page.getByLabel("סוג הנכס").selectOption("APARTMENT");
    await page.getByLabel("עיר").fill("רמת גן");
    await page.getByLabel("אזור").selectOption("CENTER");
    await page.getByLabel("כתובת הנכס").fill("רחוב הנכס 10, רמת גן");
    await page.getByLabel("שווי הנכס").fill("2500000");
    await page.getByLabel("סכום המימון המבוקש").fill("1200000");
    await page.getByLabel("תקופת ההלוואה בחודשים").fill("300");
    await page.getByLabel("הערות מקצועיות").fill("לקוחה בעלת הכנסה יציבה");
    await page.getByRole("button", {name: "יצירת תיק"}).click();
    await expect(page.getByRole("heading", {name: "נועה כהן"})).toBeVisible();
    await expect(page).toHaveURL(/\/advisor\/clients\/\d+$/);
    clientId = Number(new URL(page.url()).pathname.split("/").at(-1));
    expect(clientId).toBeGreaterThan(0);
    await assertHebrewUi(page);
    await capture(page, "advisor-client-details.png");

    await page.getByRole("button", {name: "מסמכים", exact: true}).click();
    await capture(page, "advisor-documents.png");
    await page.getByRole("button", {name: "חברות מימון", exact: true}).click();
    await capture(page, "advisor-financing-arena.png");

    for (const viewport of [{width: 390, height: 844, file: "advisor-mobile-390.png"}, {width: 430, height: 900}, {width: 768, height: 1024, file: "advisor-tablet-768.png"}, {width: 1024, height: 900}, {width: 1440, height: 1000, file: "advisor-desktop-1440.png"}, {width: 1920, height: 1080}]) {
      await page.setViewportSize({width: viewport.width, height: viewport.height});
      await page.goto("/advisor");
      await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
      const dimensions = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth}));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
      if (viewport.file) await capture(page, viewport.file, viewport.width >= 768);
    }
  } finally {
    if (clientId) {
      if (advisorAuthorization) {
        const cleanup = await request.delete(`http://localhost:3000/api/clients/${clientId}`, {headers: {authorization: advisorAuthorization}});
        expect(cleanup.ok()).toBe(true);
      }
    }
  }
});
