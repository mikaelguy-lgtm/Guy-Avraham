import {expect, test} from "@playwright/test";

const directRoutes = [
  "/",
  "/login",
  "/register/advisor",
  "/verify-email",
  "/advisor",
  "/admin",
  "/lender/invite/test-token"
];

test("direct application routes survive a browser refresh without a blank root", async ({page}) => {
  for (const route of directRoutes) {
    await page.goto(route);
    await page.reload();
    await expect(page.locator("#root > *")).not.toHaveCount(0);
    await expect(page.getByTestId("startup-configuration-error")).toHaveCount(0);
  }
});
