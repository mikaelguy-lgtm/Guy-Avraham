import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const dealTypes = [
  ["PURCHASE_FROM_CONTRACTOR", "רכישה מקבלן"],
  ["BUYER_PRICE_PROGRAM", "מחיר למשתכן"],
  ["SECOND_HAND_PURCHASE", "רכישה יד שנייה"],
  ["RENOVATION", "שיפוצים"],
  ["DEBT_CONSOLIDATION", "איחוד הלוואות"],
  ["BUSINESS_PURPOSE", "מטרה עסקית"],
  ["ANY_PURPOSE", "לכל מטרה"],
  ["SELF_CONSTRUCTION", "בנייה עצמית"],
  ["FAMILY_TRANSACTION", "עסקה בתוך המשפחה"],
  ["KIBBUTZ_PURCHASE_OR_CONSTRUCTION", "רכישה או בנייה בקיבוץ"],
  ["RECEIVER_PURCHASE", "רכישה מכונס נכסים"],
  ["REVERSE_MORTGAGE", "משכנתה הפוכה"],
  ["TAMA", "תמ״א"],
  ["MORTGAGE_REFINANCE", "מחזור משכנתה"]
] as const;

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

test("final client module delivery verifies all required fields and deal types", async ({page, request}) => {
  test.setTimeout(180_000);
  await mkdir("output/playwright", {recursive: true});
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  let clientId = 0;
  let authorization = "";
  let publicCaseNumber = "";

  try {
    await page.goto("/");
    authorization = await login(page);
    await page.getByRole("link", {name: "תיק חדש"}).click();

    await page.getByRole("button", {name: "הבא"}).click();
    await expect(page.getByText("יש להשלים את כל השדות המסומנים לפני המעבר לשלב הבא.")).toBeVisible();
    await expect(page.getByText("יש להזין שם פרטי")).toBeVisible();

    await page.getByLabel("שם פרטי").fill("בדיקת");
    await page.getByLabel("שם משפחה").fill("מסירה");
    await page.getByLabel("מספר תעודת זהות").fill("987654321");
    await page.getByLabel("תאריך לידה").fill("1987-04-12");
    await page.getByLabel("טלפון").fill("0509876543");
    await page.getByLabel("דוא״ל").fill("final-delivery@syncash.local");
    await page.getByLabel("כתובת מגורים").fill("רחוב הבדיקה 12, רמת גן");
    await page.getByLabel("מצב משפחתי").selectOption("MARRIED");
    await page.getByLabel("מספר ילדים").fill("2");
    await expect(page.getByLabel(/^גיל ילד/)).toHaveCount(2);
    await page.getByLabel("גיל ילד 1").fill("5");
    await page.getByLabel("גיל ילד 2").fill("9");
    await page.getByLabel("מספר לווים בתיק").fill("2");
    await page.getByRole("button", {name: "הבא"}).click();

    await expect(page.getByText("הכנסה ברוטו")).toHaveCount(0);
    await page.getByLabel("סוג תעסוקה").selectOption("SALARIED");
    await page.getByLabel("שם המעסיק או העסק").fill("חברת מסירה מקומית");
    await page.getByLabel("תפקיד").fill("מנהלת תפעול");
    await page.getByLabel("ותק בשנים").fill("8");
    await page.getByLabel("הכנסה חודשית נטו").fill("20000");
    await page.getByLabel("האם קיימת הכנסה נוספת").selectOption("yes");
    await page.getByLabel("סוג הכנסה נוספת").selectOption("RENTAL_INCOME");
    await page.getByLabel("סכום הכנסה נוספת חודשי").fill("3000");
    await page.getByLabel("התחייבויות חודשיות").fill("1500");
    await page.getByLabel("יתרת משכנתה קיימת").fill("450000");
    await page.getByLabel("החזר משכנתה חודשי").fill("3500");
    await page.getByRole("button", {name: "הבא"}).click();

    await page.getByLabel("סוג העסקה").selectOption("PURCHASE_FROM_CONTRACTOR");
    await page.getByLabel("סוג הנכס").selectOption("APARTMENT");
    await page.getByLabel("עיר").fill("רמת גן");
    await page.getByLabel("אזור").selectOption("CENTER");
    await page.getByLabel("כתובת הנכס").fill("רחוב הנכס 30, רמת גן");
    await page.getByLabel("שווי הנכס").fill("2000000");
    await page.getByLabel("סכום המימון המבוקש").fill("1200000");
    await page.getByLabel("תקופת ההלוואה בחודשים").fill("240");
    await page.getByLabel("הערות מקצועיות").fill("בדיקת מסירה מלאה של מודול הלקוחות");
    await page.getByRole("button", {name: "יצירת תיק"}).click();

    await expect(page.getByRole("heading", {name: "בדיקת מסירה"})).toBeVisible();
    clientId = Number(new URL(page.url()).pathname.split("/").at(-1));
    publicCaseNumber = (await page.getByText(/^תיק SC-/).first().textContent())?.replace("תיק ", "") ?? "";
    expect(publicCaseNumber).toMatch(/^SC-/);
    await expect(page.getByText("23,000", {exact: false})).toBeVisible();
    await expect(page.getByText("5,000", {exact: false})).toBeVisible();
    await expect(page.getByText("21.74%")).toBeVisible();
    await expect(page.getByText("60%", {exact: true}).first()).toBeVisible();

    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByText("נשוי/אה")).toBeVisible();
    await expect(page.getByText("5, 9")).toBeVisible();
    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await expect(page.getByText("שכר דירה")).toBeVisible();
    await expect(page.getByText("הכנסה ברוטו")).toHaveCount(0);
    await page.getByRole("button", {name: "התחייבויות", exact: true}).click();
    await expect(page.getByText("יתרת משכנתה קיימת")).toBeVisible();
    await page.getByRole("button", {name: "נכס", exact: true}).click();
    await expect(page.getByText("רחוב הנכס 30, רמת גן")).toBeVisible();

    await page.getByRole("button", {name: "עריכה"}).click();
    let editor = page.getByRole("dialog");
    await editor.getByLabel("מצב משפחתי").selectOption("COMMON_LAW");
    await editor.getByLabel("גיל ילד 1").fill("6");
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByLabel("סוג הכנסה נוספת").selectOption("INVESTMENT_INCOME");
    await editor.getByLabel("סכום הכנסה נוספת חודשי").fill("4000");
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");

    for (const [value, label] of dealTypes) {
      await page.getByRole("button", {name: "עריכה"}).click();
      editor = page.getByRole("dialog");
      await editor.getByRole("button", {name: "הבא"}).click();
      await editor.getByRole("button", {name: "הבא"}).click();
      await editor.getByLabel("סוג העסקה").selectOption(value);
      await editor.getByRole("button", {name: "שמירת שינויים"}).click();
      await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");
      await page.reload();
      await page.getByRole("button", {name: "נכס", exact: true}).click();
      await expect(page.getByText(label, {exact: true})).toBeVisible();
      await expect(page.locator("body")).not.toContainText(value);
      await page.getByRole("button", {name: "עריכה"}).click();
      editor = page.getByRole("dialog");
      await editor.getByRole("button", {name: "הבא"}).click();
      await editor.getByRole("button", {name: "הבא"}).click();
      await expect(editor.getByLabel("סוג העסקה")).toHaveValue(value);
      await editor.getByRole("button", {name: "סגירת חלון עריכה"}).click();
    }

    await page.reload();
    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByText("ידועים בציבור")).toBeVisible();
    await expect(page.getByText("6, 9")).toBeVisible();
    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await expect(page.getByText("הכנסה מהשקעות")).toBeVisible();
    await expect(page.getByText("24,000", {exact: false})).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
    await page.screenshot({path: "output/playwright/final-client-delivery.png", fullPage: true, animations: "disabled"});
    await writeFile("output/playwright/final-delivery-result.json", JSON.stringify({clientName: "בדיקת מסירה", publicCaseNumber, verifiedDealTypes: dealTypes.map(([value]) => value)}, null, 2));
  } finally {
    if (clientId && authorization) {
      const cleanup = await request.delete(`http://localhost:3000/api/clients/${clientId}`, {headers: {authorization}});
      expect(cleanup.ok()).toBe(true);
    }
  }
});
