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

// The 5-minute idle timeout (server- and client-enforced) means a test can no
// longer jump the clock an hour with no input: that correctly logs the user
// out and a later mouse move must NOT revive the session. The timeline below
// therefore stays inside 5 minutes while still crossing the 22:59 → 23:00
// Asia/Jerusalem boundary (UTC+3 in August), from a Los Angeles browser.
test("Israel greeting refreshes on SPA load, visibility and time boundary", async ({page}) => {
  await page.clock.install({time: new Date("2026-08-01T19:57:30.000Z")}); // 22:57:30 Israel
  await loginAsAdvisor(page);
  const greeting = page.locator(".advisor-hero .eyebrow");
  await expect(greeting).toHaveText(/^ערב טוב, .+/u);

  await page.clock.fastForward(120_000); // 22:59:30 Israel
  await page.mouse.move(250, 250);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(greeting).toHaveText(/^ערב טוב, .+/u);

  await page.clock.fastForward(31_000); // 23:00:01 Israel
  await page.mouse.move(260, 250);
  await expect(greeting).toHaveText(/^לילה טוב, .+/u);

  await page.reload();
  await expect(page.locator(".advisor-hero .eyebrow")).toHaveText(/^לילה טוב, .+/u);
});
