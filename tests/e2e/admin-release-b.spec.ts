import { expect, test, type Page } from "@playwright/test";

async function loginAsSuperAdmin(page: Page) {
  const email = process.env.E2E_SUPER_ADMIN_EMAIL;
  const password = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("E2E_SUPER_ADMIN_EMAIL/PASSWORD are required");
  await page.goto("/login");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("SUPER ADMIN: notification bell renders, case edit reuses the advisor form and produces an audit entry", async ({page}) => {
  await loginAsSuperAdmin(page);

  // The bell is part of the admin header for SUPER_ADMIN specifically.
  await expect(page.getByRole("button", {name: /התראות/})).toBeVisible();

  await page.goto("/admin/cases");
  const firstRow = page.locator("table.data-table tbody tr").first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  await expect(page).toHaveURL(/\/admin\/cases\/\d+$/);
  const caseUrl = page.url();
  const caseId = caseUrl.match(/\/admin\/cases\/(\d+)$/)?.[1];

  await expect(page.getByRole("link", {name: "עריכת תיק"})).toHaveAttribute("href", `/admin/cases/${caseId}/edit`);

  // Exercises the single-section edit route directly (the same component
  // and validation the advisor uses at /advisor/clients/:id/edit/property,
  // per the approved reuse design), rather than the full 3-step wizard.
  await page.goto(`/admin/cases/${caseId}/edit/property`);
  const cityField = page.getByLabel("עיר");
  await expect(cityField).toBeVisible();
  const uniqueCity = `עיר-בדיקה-${Date.now()}`;
  await cityField.fill(uniqueCity);
  await page.getByRole("button", {name: "שמירת שינויים"}).click();

  await expect(page).toHaveURL(new RegExp(`/admin/cases/${caseId}$`));
  await expect(page.getByText("השינויים נשמרו בהצלחה.")).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", {name: "יומן פעילות"})).toBeVisible();
  await expect(page.locator("table.data-table tbody").getByText("CLIENT_PROPERTY_UPDATED").first()).toBeVisible();
});

test("SUPER ADMIN: notification settings and system health screens load with real data", async ({page}) => {
  await loginAsSuperAdmin(page);

  await page.goto("/admin/settings/notifications");
  await expect(page.getByRole("heading", {name: /התראות מנהל/})).toBeVisible();
  await expect(page.getByText("מייל על יועץ חדש")).toBeVisible();
  await expect(page.getByText("מייל על תיק חדש")).toBeVisible();
  await expect(page.getByText("מייל על חברת מימון מעוניינת")).toBeVisible();

  await page.goto("/admin/system-health");
  await expect(page.getByRole("heading", {name: "בריאות מערכת"})).toBeVisible();
  await expect(page.getByText("PostgreSQL")).toBeVisible();
  await expect(page.getByText("Redis")).toBeVisible();
  await expect(page.getByText("MinIO")).toBeVisible();
});
