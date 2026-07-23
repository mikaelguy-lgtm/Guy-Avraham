import { expect, test, type Page } from "@playwright/test";

async function login(page: Page): Promise<string> {
  const email = process.env.E2E_ADVISOR_EMAIL;
  const password = process.env.E2E_ADVISOR_PASSWORD;
  if (!email || !password) throw new Error("E2E advisor credentials are required");
  await page.goto("/");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticatedRequest = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticatedRequest).headers().authorization ?? "";
}

async function fillPersonal(page: Page, borrower: number, values: {firstName: string; lastName: string; identity: string; birthDate: string; phone: string; email: string}) {
  await page.getByLabel(`שם פרטי - לווה ${borrower}`, {exact: true}).fill(values.firstName);
  await page.getByLabel(`שם משפחה - לווה ${borrower}`, {exact: true}).fill(values.lastName);
  await page.getByLabel(`מספר תעודת זהות - לווה ${borrower}`, {exact: true}).fill(values.identity);
  await page.getByLabel(`תאריך לידה - לווה ${borrower}`, {exact: true}).fill(values.birthDate);
  await page.getByLabel(`טלפון - לווה ${borrower}`, {exact: true}).fill(values.phone);
  await page.getByLabel(`דוא״ל - לווה ${borrower}`, {exact: true}).fill(values.email);
  await page.getByLabel(`כתובת מגורים - לווה ${borrower}`, {exact: true}).fill("רחוב לווים 10, תל אביב");
  await page.getByLabel(`מצב משפחתי - לווה ${borrower}`, {exact: true}).selectOption("MARRIED");
}

async function fillFinancial(page: Page, borrower: number, income: string) {
  await page.getByLabel(`סוג תעסוקה - לווה ${borrower}`, {exact: true}).selectOption(borrower === 1 ? "SALARIED" : "SELF_EMPLOYED");
  await page.getByLabel(`שם המעסיק או העסק - לווה ${borrower}`, {exact: true}).fill(borrower === 1 ? "חברת לווים" : "עסק לווים");
  await page.getByLabel(`תפקיד - לווה ${borrower}`, {exact: true}).fill(borrower === 1 ? "מנהלת" : "בעלים");
  await page.getByLabel(`ותק בשנים - לווה ${borrower}`, {exact: true}).fill("5");
  await page.getByLabel(`הכנסה חודשית נטו - לווה ${borrower}`, {exact: true}).fill(income);
  await page.getByLabel(`האם קיימת הכנסה נוספת - לווה ${borrower}`, {exact: true}).selectOption("no");
  await page.getByLabel(`התחייבויות חודשיות שאינן משכנתה - לווה ${borrower}`, {exact: true}).fill("1000");
  await page.getByLabel(`יתרת משכנתה קיימת - לווה ${borrower}`, {exact: true}).fill(borrower === 1 ? "300000" : "0");
  await page.getByLabel(`החזר משכנתה חודשי - לווה ${borrower}`, {exact: true}).fill(borrower === 1 ? "3000" : "0");
}

test("creates, reorders and edits a two-borrower household", async ({page, request}) => {
  let clientId = 0;
  const authorization = await login(page);
  try {
    await page.getByRole("link", {name: "תיק חדש"}).click();
    await page.getByLabel("מספר לווים בתיק").fill("2");
    await page.getByLabel("מה הקשר בין הלווים?").selectOption("MARRIED");
    await page.getByLabel("מספר ילדים - household").fill("1");
    await page.getByLabel("גיל ילד 1 - household").fill("7");
    await expect(page.getByText("נתוני הילדים משותפים לשני הלווים ומוזנים תחת הלווה הראשי.")).toBeVisible();
    await fillPersonal(page, 1, {firstName: "רוני", lastName: "כהן", identity: "111111118", birthDate: "1984-04-10", phone: "0501111111", email: "roni.multi@syncash.local"});
    await fillPersonal(page, 2, {firstName: "נועה", lastName: "כהן", identity: "222222226", birthDate: "1986-08-20", phone: "0502222222", email: "noa.multi@syncash.local"});
    await expect(page.getByText(/גיל:/)).toHaveCount(2);
    await page.getByRole("button", {name: "העבר לווה 2 למעלה"}).click();
    await expect(page.getByLabel("שם פרטי - לווה 1", {exact: true})).toHaveValue("נועה");
    await page.getByRole("button", {name: "העבר לווה 1 למטה"}).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("מה הקשר בין הלווים?").selectOption("PARTNERS");
    await expect(page.getByText(/שינוי הקשר עשוי לשנות/)).toBeVisible();
    await expect(page.getByLabel(/מספר ילדים - borrowers/)).toHaveCount(2);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("מה הקשר בין הלווים?").selectOption("MARRIED");
    await page.getByRole("button", {name: "הבא"}).click();

    await fillFinancial(page, 1, "22000");
    await fillFinancial(page, 2, "18000");
    await page.getByRole("button", {name: "הבא"}).click();
    await page.getByLabel("סוג העסקה").selectOption("SECOND_HAND_PURCHASE");
    await page.getByLabel("סוג הנכס").selectOption("APARTMENT");
    await page.getByLabel("עיר").fill("תל אביב");
    await page.getByLabel("אזור").selectOption("CENTER");
    await page.getByLabel("כתובת הנכס").fill("רחוב הנכס 20, תל אביב");
    await page.getByLabel("שווי הנכס").fill("2000000");
    await page.getByLabel("סכום המימון המבוקש").fill("1000000");
    await page.getByLabel("תקופת ההלוואה בחודשים").fill("240");
    await page.getByLabel("הערות מקצועיות").fill("בדיקת תיק רב לווים");
    const creationResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/clients") && response.request().method() === "POST");
    await page.getByRole("button", {name: "יצירת תיק"}).click();
    const creationResponse = await creationResponsePromise;
    if (!creationResponse.ok()) throw new Error(`Client creation failed: ${JSON.stringify(await creationResponse.json())}`);
    await expect(page.getByRole("heading", {name: /רוני כהן ועוד 1/})).toBeVisible();
    clientId = Number(new URL(page.url()).pathname.split("/").at(-1));
    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByRole("heading", {name: "נועה כהן"})).toBeVisible();
    await expect(page.getByText("7", {exact: true})).toBeVisible();

    await page.getByRole("button", {name: "עריכה"}).click();
    const editor = page.getByRole("dialog");
    await editor.getByLabel("טלפון - לווה 2", {exact: true}).fill("0503333333");
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByLabel("הכנסה חודשית נטו - לווה 2", {exact: true}).fill("19000");
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");
    await page.reload();
    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page.getByText("0503333333")).toBeVisible();
    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await expect(page.getByText("19,000", {exact: false}).first()).toBeVisible();
  } finally {
    if (clientId && authorization) await request.delete(`http://localhost:3000/api/clients/${clientId}`, {headers: {authorization}});
  }
});
