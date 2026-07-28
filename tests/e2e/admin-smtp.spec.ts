import { expect, test } from "@playwright/test";

test("SUPER_ADMIN manages a versioned SMTP configuration without silent failures", async ({page}) => {
  const email = process.env.E2E_SUPER_ADMIN_EMAIL;
  const password = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("E2E super admin credentials are required");

  const consoleErrors: string[] = [];
  const smtpResponses: Array<{status: number; body: string}> = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", async (response) => {
    if (!response.url().includes("/api/admin/settings/email")) return;
    const body = await response.text().catch(() => "");
    smtpResponses.push({status: response.status(), body});
  });

  await page.goto("/");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("navigation", {name: "ניווט ניהול"}).getByRole("link", {name: "הגדרות מערכת", exact: true}).click();
  await page.getByRole("link", {name: "דואר יוצא"}).click();
  await expect(page).toHaveURL(/\/admin\/settings\/smtp$/);
  await page.reload();
  await expect(page.getByRole("heading", {name: "הגדרות דואר יוצא"})).toBeVisible();

  await page.getByLabel("ספק דוא״ל").selectOption("CUSTOM");
  await page.getByLabel("פורט").fill("70000");
  await page.getByRole("button", {name: "שמירה כטיוטה"}).click();
  await expect(page.getByRole("alert")).toContainText("יש להזין פורט בין 1 ל־65535");

  await page.getByLabel("שרת SMTP").fill("mailpit");
  await page.getByLabel("פורט").fill("1025");
  await page.getByLabel("אבטחת חיבור").selectOption("NONE");
  await page.getByLabel("שם משתמש SMTP").fill("");
  await page.getByLabel("כתובת שולח").fill("no-reply@syncash.local");
  await page.getByLabel("שם השולח").fill("SynCash Local SMTP");
  await page.getByLabel("כתובת למענה").fill("support@syncash.local");
  await page.getByLabel("כתובת יעד לבדיקת SMTP").fill(email);
  const localTestPassword = `local-mailpit-${Date.now()}`;
  await page.getByLabel("סיסמת SMTP").fill(localTestPassword);
  await page.getByRole("button", {name: "שמירה כטיוטה"}).click();
  await expect(page.getByRole("button", {name: "שומר טיוטה…"})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("נשמרה כטיוטה");
  await expect(page.getByLabel("סיסמת SMTP")).toHaveValue("");
  await expect(page.getByText("סיסמת SMTP מוגדרת בטיוטה:")).toContainText("כן");

  await page.getByRole("button", {name: "בדיקת SMTP ושליחת מייל"}).click();
  await expect(page.getByRole("button", {name: "בודק ושולח…"})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("הודעת הבדיקה נשלחה בהצלחה");
  await expect(page.getByRole("button", {name: "הפעלת ההגדרה"})).toBeEnabled();
  await page.getByRole("button", {name: "הפעלת ההגדרה"}).click();
  await expect(page.getByRole("status")).toContainText("הופעלה בהצלחה");
  await expect(page.getByText("ספק פעיל").locator("..")).toContainText("SMTP מותאם אישית");

  await page.getByLabel("שם השולח").fill("SynCash Local SMTP Updated");
  await page.getByRole("button", {name: "שמירה כטיוטה"}).click();
  await expect(page.getByRole("status")).toContainText("נשמרה כטיוטה");
  await expect(page.getByText("סיסמת SMTP מוגדרת בטיוטה:")).toContainText("כן");

  await page.route("**/api/admin/settings/email/*/test", async (route) => {
    await route.fulfill({status: 502, contentType: "application/json", body: JSON.stringify({error: "SMTP_AUTH_FAILED", message: "שם המשתמש או סיסמת ה-SMTP שגויים.", requestId: "smtp-e2e-request"})});
  });
  await page.getByRole("button", {name: "בדיקת SMTP ושליחת מייל"}).click();
  await expect(page.getByRole("alert")).toContainText("שם המשתמש או סיסמת ה-SMTP שגויים");
  await expect(page.getByRole("alert")).toContainText("smtp-e2e-request");

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.getByRole("heading", {name: "הגדרות דואר יוצא"})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByRole("link", {name: "לוח הבקרה"}).first().click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", {name: "כניסה מאובטחת"})).toHaveCount(0);
  await page.locator("header").getByRole("button", {name: "יציאה"}).click();
  await expect(page.getByRole("heading", {name: "כניסה מאובטחת"})).toBeVisible();

  expect(consoleErrors.every((message) => message.includes("Failed to load resource"))).toBe(true);
  expect(smtpResponses.some((response) => response.status === 200)).toBe(true);
  expect(JSON.stringify(smtpResponses)).not.toContain(localTestPassword);
});
