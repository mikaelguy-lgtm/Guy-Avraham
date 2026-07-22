import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string): Promise<string> {
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticatedRequest = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticatedRequest).headers().authorization ?? "";
}

async function latestInvitation(request: APIRequestContext, publicCaseNumber: string): Promise<string> {
  let invitation = "";
  await expect.poll(async () => {
    const response = await request.get("http://localhost:8025/api/v1/messages");
    if (!response.ok()) return "";
    const listing = await response.json() as {messages?: Array<{ID?: string; id?: string; Subject?: string}>};
    const message = listing.messages?.find((item) => item.Subject?.includes(publicCaseNumber));
    const id = message?.ID ?? message?.id;
    if (!id) return "";
    const detail = await request.get(`http://localhost:8025/api/v1/message/${id}`);
    const content = await detail.text();
    invitation = content.match(/http:\/\/localhost:5173\/lender\/invite\/[A-Za-z0-9_-]+/)?.[0] ?? "";
    return invitation;
  }, {timeout: 20_000}).not.toBe("");
  return invitation;
}

test("advisor-to-lender financing workflow", async ({browser, page, request}) => {
  const advisorEmail = process.env.E2E_ADVISOR_EMAIL;
  const advisorPassword = process.env.E2E_ADVISOR_PASSWORD;
  const lenderEmail = process.env.E2E_LENDER_EMAIL;
  const lenderPassword = process.env.E2E_LENDER_PASSWORD;
  const otherLenderEmail = process.env.E2E_OTHER_LENDER_EMAIL;
  const otherLenderPassword = process.env.E2E_OTHER_LENDER_PASSWORD;
  if (!advisorEmail || !advisorPassword || !lenderEmail || !lenderPassword || !otherLenderEmail || !otherLenderPassword) throw new Error("All E2E credentials are required");

  let clientId = 0;
  let lenderContext: BrowserContext | null = null;
  let otherContext: BrowserContext | null = null;
  let advisorAuthorization = "";
  try {
    await page.goto("/");
    advisorAuthorization = await login(page, advisorEmail, advisorPassword);
    await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
    await page.getByRole("link", {name: "תיק חדש"}).click();

    await page.getByLabel("שם פרטי").fill("E2E");
    await page.getByLabel("שם משפחה").fill("Client");
    await page.getByLabel("מספר תעודת זהות").fill("999999999");
    await page.getByLabel("תאריך לידה").fill("1985-06-15");
    await page.getByLabel("טלפון").fill("0500000000");
    await page.getByLabel("דוא״ל").fill("e2e@example.com");
    await page.getByLabel("כתובת מגורים").fill("רחוב בדיקה 1, תל אביב");
    await page.getByLabel("מצב משפחתי").selectOption("MARRIED");
    await page.getByLabel("מספר ילדים").fill("3");
    await expect(page.getByLabel(/^גיל ילד/)).toHaveCount(3);
    await page.getByLabel("גיל ילד 1").fill("3");
    await page.getByLabel("גיל ילד 2").fill("7");
    await page.getByLabel("גיל ילד 3").fill("10");
    await page.getByLabel("מספר לווים בתיק").fill("2");
    await page.getByRole("button", {name: "הבא"}).click();
    await page.getByLabel("סוג תעסוקה").selectOption("SALARIED");
    await page.getByLabel("שם המעסיק או העסק").fill("E2E Employer");
    await page.getByLabel("תפקיד").fill("מנהלת בדיקות");
    await page.getByLabel("ותק בשנים").fill("5");
    await page.getByLabel("הכנסה חודשית נטו").fill("30000");
    await page.getByLabel("האם קיימת הכנסה נוספת").selectOption("yes");
    await page.getByLabel("סוג הכנסה נוספת").selectOption("RENTAL_INCOME");
    await page.getByLabel("סכום הכנסה נוספת חודשי").fill("2500");
    await page.getByLabel("התחייבויות חודשיות").fill("1500");
    await page.getByLabel("יתרת משכנתה קיימת").fill("400000");
    await page.getByLabel("החזר משכנתה חודשי").fill("4000");
    await page.getByRole("button", {name: "הבא"}).click();
    await page.getByLabel("סוג העסקה").selectOption("SECOND_HAND_PURCHASE");
    await page.getByLabel("סוג הנכס").selectOption("APARTMENT");
    await page.getByLabel("עיר").fill("תל אביב");
    await page.getByLabel("אזור").selectOption("CENTER");
    await page.getByLabel("כתובת הנכס").fill("רחוב הנכס 2, תל אביב");
    await page.getByLabel("שווי הנכס").fill("2000000");
    await page.getByLabel("סכום המימון המבוקש").fill("1000000");
    await page.getByLabel("תקופת ההלוואה בחודשים").fill("240");
    await page.getByLabel("הערות מקצועיות").fill("תיק E2E מלא");
    await page.getByRole("button", {name: "יצירת תיק"}).click();
    await expect(page.getByRole("heading", {name: "E2E Client"})).toBeVisible();
    clientId = Number(new URL(page.url()).pathname.split("/").at(-1));
    const publicCaseNumber = (await page.getByText(/^תיק SC-/).first().textContent())?.replace("תיק ", "") ?? "";
    expect(publicCaseNumber).toMatch(/^SC-/);

    await page.getByRole("button", {name: "עריכה"}).click();
    const editor = page.getByRole("dialog");
    await editor.getByLabel("שם פרטי").fill("E2E Updated");
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByRole("button", {name: "הבא"}).click();
    await editor.getByLabel("הערות מקצועיות").fill("נתון נשמר לאחר רענון");
    await editor.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");
    await page.reload();
    await expect(page.getByRole("heading", {name: "E2E Updated Client"})).toBeVisible();
    await page.getByRole("button", {name: "נכס", exact: true}).click();
    await expect(page.getByText("נתון נשמר לאחר רענון")).toBeVisible();

    await page.getByRole("button", {name: "מסמכים", exact: true}).click();
    const pdf = Buffer.from("%PDF-1.7\nE2E document");
    const expectedChecksum = createHash("sha256").update(pdf).digest("hex");
    await page.getByLabel("בחירת מסמך").setInputFiles({name: "e2e.pdf", mimeType: "application/pdf", buffer: pdf});
    await page.getByRole("button", {name: "העלאה"}).click();
    await expect(page.getByText("e2e.pdf")).toBeVisible();

    await page.reload();
    await page.getByRole("button", {name: "מסמכים", exact: true}).click();
    await page.getByRole("button", {name: "צפייה"}).click();
    const previewDialog = page.getByRole("dialog", {name: "e2e.pdf"});
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
    await previewDialog.getByRole("button", {name: "סגירת תצוגת מסמך"}).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {name: "הורדה"}).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(createHash("sha256").update(Buffer.concat(chunks)).digest("hex")).toBe(expectedChecksum);

    await page.getByRole("button", {name: "חברות מימון", exact: true}).click();
    await page.locator('.lender-card input[type="checkbox"]').first().check();
    await page.getByRole("button", {name: "שליחת התיק לחברות שנבחרו"}).click();
    await expect(page.getByRole("status")).toContainText("התיק נשלח בהצלחה");
    const inviteUrl = await latestInvitation(request, publicCaseNumber);

    lenderContext = await browser.newContext();
    const lenderPage = await lenderContext.newPage();
    await lenderPage.goto(inviteUrl);
    await login(lenderPage, lenderEmail, lenderPassword);
    await expect(lenderPage.getByRole("heading", {name: "תיק מימון אנונימי"})).toBeVisible();
    await expect(lenderPage.locator("body")).not.toContainText("E2E Updated Client");
    await expect(lenderPage.locator("body")).not.toContainText("0500000000");
    await expect(lenderPage.locator("body")).not.toContainText("e2e@example.com");
    await lenderPage.getByRole("button", {name: "בקשת שם וטלפון"}).click();

    await page.reload();
    await page.getByRole("button", {name: "בקשות חשיפה", exact: true}).click();
    await page.getByLabel("אישור טלפון").check();
    await page.getByRole("button", {name: "אישור השדות שנבחרו"}).click();
    await lenderPage.getByRole("button", {name: "רענון מידע מאושר"}).click();
    await expect(lenderPage.getByText("0500000000")).toBeVisible();
    await expect(lenderPage.locator("body")).not.toContainText("E2E Updated Client");

    await lenderPage.getByRole("button", {name: "הגשת הצעה"}).click();
    await page.reload();
    await page.getByRole("button", {name: "הצעות", exact: true}).click();
    await expect(page.locator(".offers-grid").getByText("1,000,000").first()).toBeVisible();

    otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(inviteUrl);
    await login(otherPage, otherLenderEmail, otherLenderPassword);
    await expect(otherPage.locator("body")).not.toContainText("תיק מימון אנונימי");
  } finally {
    await lenderContext?.close();
    await otherContext?.close();
    if (clientId) {
      if (advisorAuthorization) {
        const cleanup = await request.delete(`http://localhost:3000/api/clients/${clientId}`, {headers: {authorization: advisorAuthorization}});
        expect(cleanup.ok()).toBe(true);
      }
    }
  }
});
