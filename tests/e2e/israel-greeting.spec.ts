import {expect, test, type Page} from "@playwright/test";

test.use({timezoneId: "America/Los_Angeles"});

async function loginAsAdvisor(page: Page): Promise<void> {
  const email = process.env.E2E_ADVISOR_EMAIL;
  const password = process.env.E2E_ADVISOR_PASSWORD;
  if (!email || !password) throw new Error("E2E advisor credentials are required");
  await page.goto("/login");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  await page.getByRole("button", {name: "כניסה"}).click();
  await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
}

test("Israel greeting refreshes on SPA load, visibility and time boundary", async ({page}) => {
  await page.clock.install({time: new Date("2026-08-01T18:54:00.000Z")});
  await loginAsAdvisor(page);
  const greeting = page.locator(".advisor-hero .eyebrow");
  await expect(greeting).toHaveText(/^ערב טוב, .+/u);

  await page.clock.setSystemTime(new Date("2026-08-01T19:59:30.000Z"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(greeting).toHaveText(/^ערב טוב, .+/u);

  await page.clock.fastForward(31_000);
  await expect(greeting).toHaveText(/^לילה טוב, .+/u);

  await page.clock.setSystemTime(new Date("2026-08-01T18:54:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(greeting).toHaveText(/^ערב טוב, .+/u);
  await page.reload();
  await expect(page.locator(".advisor-hero .eyebrow")).toHaveText(/^ערב טוב, .+/u);
});
