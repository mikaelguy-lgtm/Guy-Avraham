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

test("SUPER ADMIN: dashboard loads with real KPIs, then drills into a case via the Cases screen", async ({page}) => {
  await loginAsSuperAdmin(page);

  await expect(page.getByRole("heading", {name: "לוח הבקרה"})).toBeVisible();
  await expect(page.getByRole("region", {name: "KPI ראשיים"})).toBeVisible();
  await expect(page.getByText("יועצים סה״כ")).toBeVisible();
  await expect(page.getByText("תיקים סה״כ")).toBeVisible();

  await page.getByRole("link", {name: "תיקים"}).first().click();
  await expect(page).toHaveURL(/\/admin\/cases$/);
  await expect(page.getByRole("heading", {name: "תיקים", exact: true})).toBeVisible();

  const firstRow = page.locator("table.data-table tbody tr").first();
  await expect(firstRow).toBeVisible();
  const caseNumber = await firstRow.locator("td").first().textContent();
  await firstRow.click();

  await expect(page).toHaveURL(/\/admin\/cases\/\d+$/);
  if (caseNumber) await expect(page.getByText(caseNumber.trim()).first()).toBeVisible();
  await expect(page.getByRole("heading", {name: "מסמכים"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "שליחות לחברות מימון"})).toBeVisible();
});
