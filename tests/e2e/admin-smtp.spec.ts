import { expect, test } from "@playwright/test";

test("SUPER_ADMIN can save and test SMTP without silent failures", async ({page}) => {
  const email = process.env.E2E_SUPER_ADMIN_EMAIL;
  const password = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("E2E super admin credentials are required");

  const consoleErrors: string[] = [];
  const smtpResponses: Array<{status: number; body: string}> = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", async (response) => {
    if (response.url().includes("/api/admin/settings/email")) smtpResponses.push({status: response.status(), body: await response.text()});
  });

  await page.goto("/");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", {name: "לוח הבקרה"})).toBeVisible();
  await expect(page.getByRole("navigation", {name: "ניווט ניהול"})).toContainText("יועצים");
  const adminNavigation = page.getByRole("navigation", {name: "ניווט ניהול"});
  await adminNavigation.getByRole("link", {name: "הגדרות מערכת", exact: true}).click();
  await expect(adminNavigation.getByRole("link", {name: "הגדרות מערכת", exact: true})).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", {name: "דואר יוצא"}).click();
  await expect(page).toHaveURL(/\/admin\/settings\/smtp$/);
  await expect(page.getByRole("heading", {name: "הגדרות Super Admin"})).toBeVisible();
  await expect(page.getByRole("navigation", {name: "פירורי לחם"})).toContainText("לוח הבקרה");
  await expect(page.getByRole("navigation", {name: "פירורי לחם"})).toContainText("הגדרות מערכת");
  await expect(page.getByRole("navigation", {name: "פירורי לחם"})).toContainText("דואר יוצא");
  await expect(adminNavigation.getByRole("link", {name: "הגדרות מערכת", exact: true})).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByRole("heading", {name: "הגדרות Super Admin"})).toBeVisible();
  await expect(page.getByRole("button", {name: "חזרה ללוח הבקרה"})).toBeVisible();
  await expect(page.getByLabel("SMTP_HOST", {exact: true})).not.toHaveValue("");

  let delaySave = true;
  await page.route("**/api/admin/settings/email", async (route) => {
    if (delaySave && route.request().method() === "PATCH") {
      delaySave = false;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.getByLabel("SMTP_PORT", {exact: true}).fill("70000");
  await page.getByRole("button", {name: "שמירה"}).click();
  await expect(page.getByRole("alert")).toContainText("יש להזין פורט בין 1 ל-65535");

  await page.getByLabel("SMTP_HOST", {exact: true}).fill("mailpit");
  await page.getByLabel("SMTP_PORT", {exact: true}).fill("1025");
  await page.locator("select").selectOption("false");
  await page.getByLabel("SMTP_USER", {exact: true}).fill("");
  await page.getByLabel("EMAIL_FROM", {exact: true}).fill("no-reply@syncash.local");
  await page.getByLabel("EMAIL_FROM_NAME", {exact: true}).fill("SynCash Local SMTP");
  await page.getByLabel("EMAIL_REPLY_TO", {exact: true}).fill("support@syncash.local");
  await page.getByRole("button", {name: "שמירה"}).click();
  await expect(page.getByRole("button", {name: "שומר…"})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("הגדרות ה-SMTP נשמרו בהצלחה");

  const localTestPassword = "local-mailpit-test-password";
  await page.locator('input[type="password"]').fill(localTestPassword);
  await page.getByRole("button", {name: "שמירה"}).click();
  await expect(page.getByText("סיסמת SMTP מוגדרת: כן")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveValue("");

  await page.getByRole("button", {name: "בדיקת SMTP"}).click();
  const dialog = page.getByRole("dialog", {name: "בדיקת SMTP"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("כתובת יעד")).toHaveValue(email);
  let delayTest = true;
  let failNextTest = false;
  await page.route("**/api/admin/settings/email/test", async (route) => {
    if (failNextTest) {
      failNextTest = false;
      await route.fulfill({status: 502, contentType: "application/json", body: JSON.stringify({error: "SMTP_AUTH_FAILED", requestId: "smtp-e2e-request"})});
      return;
    }
    if (delayTest) {
      delayTest = false;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });
  await dialog.getByRole("button", {name: "שליחת בדיקה"}).click();
  await expect(dialog.getByRole("button", {name: "שולח…"})).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("בדיקת ה-SMTP נשלחה בהצלחה");
  expect(consoleErrors).toEqual([]);

  failNextTest = true;
  await page.getByRole("button", {name: "בדיקת SMTP"}).click();
  const failureDialog = page.getByRole("dialog", {name: "בדיקת SMTP"});
  await failureDialog.getByRole("button", {name: "שליחת בדיקה"}).click();
  await expect(page.getByRole("alert")).toContainText("האימות מול שרת ה-SMTP נכשל");
  await expect(page.getByRole("alert")).toContainText("smtp-e2e-request");
  await failureDialog.getByRole("button", {name: "ביטול"}).click();

  await page.getByRole("button", {name: "חזרה ללוח הבקרה"}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", {name: "לוח הבקרה"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "כניסה מאובטחת"})).toHaveCount(0);
  await expect(page.getByRole("link", {name: "לוח בקרה"})).toHaveAttribute("aria-current", "page");

  await page.locator("header").getByRole("button", {name: "יציאה"}).click();
  await expect(page.getByRole("heading", {name: "כניסה מאובטחת"})).toBeVisible();

  expect(consoleErrors.every((message) => message.includes("Failed to load resource"))).toBe(true);
  expect(smtpResponses.some((response) => response.status === 200)).toBe(true);
  expect(JSON.stringify(smtpResponses)).not.toContain(localTestPassword);
});
