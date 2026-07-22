import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string | undefined, password: string | undefined) {
  if (!email || !password) throw new Error("E2E role credentials are required");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
}

test("ADVISOR cannot open SMTP settings", async ({page}) => {
  await page.goto("/admin/settings/smtp");
  await login(page, process.env.E2E_ADVISOR_EMAIL, process.env.E2E_ADVISOR_PASSWORD);

  await expect(page).toHaveURL(/\/advisor$/);
  await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "הגדרות Super Admin"})).toHaveCount(0);
  await expect(page.getByRole("navigation", {name: "ניווט ניהול"})).toHaveCount(0);
});

test("LENDER cannot open the admin dashboard", async ({page}) => {
  await page.goto("/admin");
  await login(page, process.env.E2E_LENDER_EMAIL, process.env.E2E_LENDER_PASSWORD);

  await expect(page).toHaveURL(/\/lender$/);
  await expect(page.getByRole("heading", {name: "פרופיל"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "לוח הבקרה"})).toHaveCount(0);
  await expect(page.getByRole("navigation", {name: "ניווט ניהול"})).toHaveCount(0);
});
