import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string): Promise<string> {
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticatedRequest = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticatedRequest).headers().authorization ?? "";
}

async function elementSize(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {width: Math.round(box.width), height: Math.round(box.height)};
  });
}

async function latestMailpitVerificationLink(request: APIRequestContext, email: string): Promise<string> {
  let verificationLink = "";
  await expect.poll(async () => {
    const response = await request.get("http://localhost:8025/api/v1/messages");
    if (!response.ok()) return "";
    const listing = await response.json() as {messages?: Array<{ID?: string; id?: string; Subject?: string; To?: Array<{Address?: string}>}>};
    const message = listing.messages?.find((item) => item.Subject === "אימות כתובת הדוא״ל שלך – SynCash" && item.To?.some((target) => target.Address === email));
    const id = message?.ID ?? message?.id;
    if (!id) return "";
    const detail = await request.get(`http://localhost:8025/api/v1/message/${id}`);
    const normalized = (await detail.text()).replaceAll("\\u0026", "&").replaceAll("&amp;", "&");
    verificationLink = normalized.match(/http:\/\/(?:127\.0\.0\.1|localhost):9099\/[^\s"'<>\\]+/)?.[0] ?? "";
    return verificationLink;
  }, {timeout: 20_000}).not.toBe("");
  return verificationLink;
}

async function deleteEmulatorAccount(request: APIRequestContext, idToken: string): Promise<void> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? "local-api-key";
  await request.post(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`,
    {data: {idToken}},
  );
}

test("advisor registration sends a real verification email without password layout shift", async ({page, browser, request}) => {
  test.setTimeout(120_000);
  const suffix = Date.now();
  const email = `advisor-${suffix}@syncash-e2e.local`;
  const password = `Secure!${suffix}Aa`;
  const businessName = `ייעוץ משכנתאות ${suffix}`;
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let adminAuthorization = "";
  let advisorId = 0;
  let registrationToken = "";

  try {
    await page.goto("/register/advisor");
    await expect(page.getByRole("heading", {name: "הרשמה ליועצי משכנתאות"})).toBeVisible();
    const passwordInput = page.getByLabel("סיסמה", {exact: true});
    const confirmationInput = page.getByLabel("אימות סיסמה");
    const createButton = page.getByRole("button", {name: "יצירת חשבון"});
    const initialPasswordSize = await elementSize(passwordInput);
    const initialConfirmationSize = await elementSize(confirmationInput);
    expect(initialPasswordSize).toEqual(initialConfirmationSize);
    expect(initialPasswordSize.height).toBe(48);
    await expect(createButton).toBeDisabled();

    for (const requirement of ["לפחות 10 תווים", "אות גדולה באנגלית", "אות קטנה באנגלית", "מספר אחד לפחות", "תו מיוחד", "ללא רווחים", "הסיסמאות זהות"]) {
      await expect(page.getByText(requirement, {exact: true})).toBeVisible();
    }

    await page.getByLabel("שם פרטי").focus();
    await page.getByLabel("שם משפחה").focus();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByLabel("שם פרטי").fill("דנה");
    await page.getByLabel("שם משפחה").fill("לוי");
    await page.getByLabel("דוא״ל").fill(email);
    await page.getByLabel("טלפון").fill("0501234567");
    await page.getByLabel("שם החברה או המשרד").fill(businessName);

    await passwordInput.fill("short");
    await confirmationInput.focus();
    await expect(page.getByText("לפחות 10 תווים", {exact: true}).locator("..")).toHaveClass(/failed/);
    expect(await elementSize(passwordInput)).toEqual(initialPasswordSize);
    expect(await elementSize(confirmationInput)).toEqual(initialConfirmationSize);

    await passwordInput.fill("abcdefghij");
    await expect(page.getByText("אות קטנה באנגלית", {exact: true}).locator("..")).toHaveClass(/met/);
    await passwordInput.fill("Abcdefghij");
    await expect(page.getByText("אות גדולה באנגלית", {exact: true}).locator("..")).toHaveClass(/met/);
    await passwordInput.fill("Abcdefghij1");
    await expect(page.getByText("מספר אחד לפחות", {exact: true}).locator("..")).toHaveClass(/met/);
    await passwordInput.fill(password);
    await expect(page.getByText("תו מיוחד", {exact: true}).locator("..")).toHaveClass(/met/);
    await expect(page.getByText("חוזק סיסמה: חזקה", {exact: false})).toBeVisible();

    await confirmationInput.fill("Wrong!Password1");
    await page.getByRole("checkbox").focus();
    await expect(page.getByText("הסיסמאות זהות", {exact: true}).locator("..")).toHaveClass(/failed/);
    await confirmationInput.fill(password);
    await expect(page.getByText("הסיסמאות זהות", {exact: true}).locator("..")).toHaveClass(/met/);
    await page.getByRole("checkbox").check();
    await expect(createButton).toBeEnabled();

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await elementSize(passwordInput)).toEqual(await elementSize(confirmationInput));
    }

    const registrationRequest = page.waitForRequest((pendingRequest) => pendingRequest.url().endsWith("/api/auth/register-advisor"));
    const registrationResponse = page.waitForResponse((pendingResponse) => pendingResponse.url().endsWith("/api/auth/register-advisor"));
    await createButton.click();
    registrationToken = (await registrationRequest).headers().authorization?.replace(/^Bearer /, "") ?? "";
    const registrationBody = await (await registrationResponse).json() as Record<string, unknown>;
    expect(registrationBody).toEqual({success: true, verificationEmailSent: true});
    expect(JSON.stringify(registrationBody)).not.toMatch(/oobCode|verify\?|password/i);

    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.getByText("מייל האימות התקבל בהצלחה אצל ספק הדואר.")).toBeVisible();
    await expect(page.getByText(email, {exact: true})).toBeVisible();
    await expect(page.getByText("נשלח בהצלחה", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "בדקתי, כתובת הדוא״ל אומתה"}).click();
    await expect(page.getByText("כתובת הדוא״ל עדיין לא אומתה. פתח את הקישור שקיבלת במייל ונסה שוב.")).toBeVisible();

    const verificationLink = await latestMailpitVerificationLink(request, email);
    const verificationResponse = await request.get(verificationLink);
    expect(verificationResponse.ok()).toBe(true);

    await page.getByRole("button", {name: "בדקתי, כתובת הדוא״ל אומתה"}).click();
    await expect(page).toHaveURL(/\/advisor$/);
    await expect(page.getByRole("heading", {name: /ברוך הבא/})).toBeVisible();
    await page.getByRole("link", {name: "פרופיל"}).click();
    await expect(page.getByLabel("שם החברה או המשרד")).toHaveValue(businessName);
    await expect(page.getByText("מאומת", {exact: true})).toBeVisible();

    const superEmail = process.env.E2E_SUPER_ADMIN_EMAIL;
    const superPassword = process.env.E2E_SUPER_ADMIN_PASSWORD;
    if (!superEmail || !superPassword) throw new Error("E2E Super Admin credentials are required");
    adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/");
    adminAuthorization = await login(adminPage, superEmail, superPassword);
    const advisorsResponse = await request.get("http://localhost:3000/api/admin/advisors", {headers: {authorization: adminAuthorization}});
    const advisors = await advisorsResponse.json() as Array<{id: number; email: string}>;
    advisorId = advisors.find((advisor) => advisor.email === email)?.id ?? 0;
    expect(advisorId).toBeGreaterThan(0);
    const logsResponse = await request.get(`http://localhost:3000/api/test/email-logs?recipient=${encodeURIComponent(email)}`, {headers: {authorization: adminAuthorization}});
    const logs = await logsResponse.json() as Array<{template: string; status: string; messageId: string | null}>;
    expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({template: "ADVISOR_EMAIL_VERIFICATION", status: "SENT", messageId: expect.any(String)})]));
    expect(JSON.stringify(logs)).not.toMatch(/oobCode|verify\?|password/i);
  } finally {
    if (advisorId && adminAuthorization) {
      const cleanup = await request.delete(`http://localhost:3000/api/test/advisors/${advisorId}`, {headers: {authorization: adminAuthorization}});
      expect(cleanup.status()).toBe(204);
    } else if (registrationToken) {
      await deleteEmulatorAccount(request, registrationToken);
    }
    await adminContext?.close();
  }
});
