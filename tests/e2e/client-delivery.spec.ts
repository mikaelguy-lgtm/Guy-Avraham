import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type Request, type Response } from "@playwright/test";

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
  ,["BRIDGE_FINANCING", "גישור"]
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

const apiOrigin = "http://localhost:3000";

function isApiRequest(request: Request): boolean {
  return request.url().startsWith(`${apiOrigin}/api/`);
}

function isRealtimeStream(request: Request): boolean {
  return request.url() === `${apiOrigin}/api/delivery/events`;
}

async function waitForApiIdle(activeRequests: Set<Request>): Promise<void> {
  await expect.poll(() => activeRequests.size, {timeout: 10_000, message: "API requests should finish before navigation"}).toBe(0);
}

function waitForSuccessfulResponse(page: Page, path: string, method = "GET"): Promise<Response> {
  return page.waitForResponse((response) => response.url() === `${apiOrigin}${path}` && response.request().method() === method)
    .then((response) => {
      expect(response.status(), `${method} ${path} should succeed`).toBeGreaterThanOrEqual(200);
      expect(response.status(), `${method} ${path} should succeed`).toBeLessThan(400);
      return response;
    });
}

async function navigateToClientDetails(page: Page, clientId: number, activeRequests: Set<Request>, action: () => Promise<unknown>): Promise<void> {
  await waitForApiIdle(activeRequests);
  const clientPath = `/advisor/clients/${clientId}`;
  const responses = [
    waitForSuccessfulResponse(page, `/api/clients/${clientId}`),
    waitForSuccessfulResponse(page, `/api/clients/${clientId}/submissions`),
    waitForSuccessfulResponse(page, `/api/clients/${clientId}/offers`)
  ];
  await Promise.all([page.waitForURL((url) => url.pathname === clientPath), action()]);
  await Promise.all(responses);
  await waitForApiIdle(activeRequests);
  await expect(page.getByRole("heading", {name: "בדיקת מסירה"})).toBeVisible();
}

async function navigateToClientEdit(page: Page, clientId: number, activeRequests: Set<Request>, action: () => Promise<unknown>): Promise<void> {
  await waitForApiIdle(activeRequests);
  const response = waitForSuccessfulResponse(page, `/api/clients/${clientId}`);
  await Promise.all([page.waitForURL((url) => url.pathname === `/advisor/clients/${clientId}/edit`), action()]);
  await response;
  await waitForApiIdle(activeRequests);
  await expect(page.getByRole("heading", {name: "עריכת תיק מימון"})).toBeVisible();
}

test("final client module delivery verifies all required fields and deal types", async ({page, request}) => {
  test.setTimeout(360_000);
  await mkdir("output/playwright", {recursive: true});
  const consoleErrors: string[] = [];
  const failedRequests: Array<{method: string; url: string; errorText: string; phase: string}> = [];
  const failedResponses: Array<{method: string; url: string; status: number; phase: string}> = [];
  const activeApiRequests = new Set<Request>();
  let phase = "initialization";
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => { if (isApiRequest(request) && !isRealtimeStream(request)) activeApiRequests.add(request); });
  page.on("requestfinished", (request) => activeApiRequests.delete(request));
  page.on("requestfailed", (request) => {
    activeApiRequests.delete(request);
    if (isRealtimeStream(request) && request.failure()?.errorText.includes("ERR_ABORTED")) return;
    failedRequests.push({method: request.method(), url: request.url(), errorText: request.failure()?.errorText ?? "UNKNOWN", phase});
  });
  page.on("response", (response) => {
    if (response.url().startsWith(`${apiOrigin}/api/`) && response.status() >= 400) failedResponses.push({method: response.request().method(), url: response.url(), status: response.status(), phase});
  });
  let clientId = 0;
  let authorization = "";
  let publicCaseNumber = "";

  try {
    phase = "login";
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
    await expect(page.getByLabel(/^ילד \d+ — גיל/)).toHaveCount(2);
    await page.getByLabel("ילד 1 — גיל").fill("5");
    await page.getByLabel("ילד 2 — גיל").fill("9");
    await page.getByLabel("מספר לווים בתיק").fill("1");
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
    await page.getByRole("button", {name: "הוספת התחייבות"}).click();
    await page.getByLabel("סוג התחייבות 1").selectOption("MORTGAGE");
    await page.getByLabel("יתרה נוכחית").fill("450000");
    await page.getByLabel("החזר חודשי").fill("3500");
    await page.getByLabel("תאריך סיום התחייבות").fill("2040-07-31");
    await page.getByLabel("הערות").fill("משכנתה קיימת");
    await page.getByRole("button", {name: "הבא"}).click();

    await page.getByLabel("מטרת ההלוואה").selectOption("PURCHASE_FROM_CONTRACTOR");
    await page.getByLabel("סוג הנכס").selectOption("APARTMENT");
    await page.getByLabel("עיר").fill("רמת גן");
    await page.getByLabel("כתובת הנכס").fill("רחוב הנכס 30, רמת גן");
    await page.getByLabel("שווי הנכס").fill("2000000");
    await page.getByLabel("סכום המימון המבוקש").fill("1200000");
    await page.getByLabel("פירוט עסקה").fill("בדיקת מסירה מלאה של מודול הלקוחות");
    await page.getByRole("button", {name: "יצירת תיק"}).click();

    await expect(page.getByRole("heading", {name: "בדיקת מסירה"})).toBeVisible();
    clientId = Number(new URL(page.url()).pathname.split("/").at(-1));
    publicCaseNumber = (await page.getByText(/^תיק SC-/).first().textContent())?.replace("תיק ", "") ?? "";
    expect(publicCaseNumber).toMatch(/^SC-/);
    await expect(page.getByText("23,000", {exact: false})).toBeVisible();
    await expect(page.getByText("3,500", {exact: false})).toBeVisible();
    await expect(page.getByText("יחס החזר")).toHaveCount(0);
    await expect(page.getByText("אחוז מימון")).toHaveCount(0);
    await waitForApiIdle(activeApiRequests);

    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByText("נשוי/אה")).toBeVisible();
    await expect(page.getByText("5, 9")).toBeVisible();
    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await expect(page.getByText("שכר דירה")).toBeVisible();
    await expect(page.getByText("הכנסה ברוטו")).toHaveCount(0);
    await page.getByRole("button", {name: "התחייבויות", exact: true}).click();
    await expect(page.getByText("משכנתה", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "נכס", exact: true}).click();
    await expect(page.getByText("רחוב הנכס 30, רמת גן")).toBeVisible();

    phase = "open initial edit";
    await navigateToClientEdit(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "עריכה", exact: true}).click());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("מצב משפחתי").selectOption("COMMON_LAW");
    await page.getByLabel("ילד 1 — גיל").fill("6");
    await page.getByRole("button", {name: "הבא"}).click();
    await page.getByLabel("סוג הכנסה נוספת").selectOption("INVESTMENT_INCOME");
    await page.getByLabel("סכום הכנסה נוספת חודשי").fill("4000");
    await page.getByRole("button", {name: "הבא"}).click();
    phase = "save initial edit";
    const initialSave = waitForSuccessfulResponse(page, `/api/clients/${clientId}`, "PATCH");
    await navigateToClientDetails(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "שמירת שינויים"}).click());
    await initialSave;
    await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");

    for (const [value, label] of dealTypes) {
      phase = `open edit for ${value}`;
      await navigateToClientEdit(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "עריכה", exact: true}).click());
      await page.getByRole("button", {name: "הבא"}).click();
      await page.getByRole("button", {name: "הבא"}).click();
      await page.getByLabel("מטרת ההלוואה").selectOption(value);
      phase = `save ${value}`;
      const saveResponse = waitForSuccessfulResponse(page, `/api/clients/${clientId}`, "PATCH");
      await navigateToClientDetails(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "שמירת שינויים"}).click());
      await saveResponse;
      await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");
      phase = `reload after saving ${value}`;
      await navigateToClientDetails(page, clientId, activeApiRequests, () => page.reload());
      await page.getByRole("button", {name: "פירוט עסקה", exact: true}).click();
      await expect(page.getByText(label, {exact: true})).toBeVisible();
      await expect(page.locator("body")).not.toContainText(value);
      phase = `reopen edit for ${value}`;
      await navigateToClientEdit(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "עריכה", exact: true}).click());
      await page.getByRole("button", {name: "הבא"}).click();
      await page.getByRole("button", {name: "הבא"}).click();
      await expect(page.getByLabel("מטרת ההלוואה")).toHaveValue(value);
      phase = `cancel edit for ${value}`;
      await navigateToClientDetails(page, clientId, activeApiRequests, () => page.getByRole("button", {name: "ביטול וחזרה לתיק"}).click());
    }

    phase = "final reload";
    await navigateToClientDetails(page, clientId, activeApiRequests, () => page.reload());
    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByText("ידועים בציבור")).toBeVisible();
    await expect(page.getByText("6, 9")).toBeVisible();
    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await expect(page.getByText("הכנסה מהשקעות")).toBeVisible();
    await expect(page.getByText("24,000", {exact: false}).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
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
