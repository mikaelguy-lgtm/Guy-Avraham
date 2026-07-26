import {randomUUID} from "node:crypto";
import {expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page} from "@playwright/test";

const apiOrigin = "http://localhost:3000";
const mailpitOrigin = "http://localhost:8025";

async function login(page: Page, email: string, password: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticated = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticated).headers().authorization ?? "";
}

async function loginInNewContext(browser: Browser, email: string, password: string): Promise<{context: BrowserContext; page: Page; authorization: string}> {
  const context = await browser.newContext(); const page = await context.newPage(); const authorization = await login(page, email, password);
  return {context, page, authorization};
}

interface MailpitMessage {ID: string; Subject: string; To: Array<{Address: string}>}
interface MailpitDetail extends MailpitMessage {HTML: string; Text: string; Attachments: unknown[]}

async function findMessage(request: APIRequestContext, recipient: string, subjectPart: string): Promise<MailpitDetail | null> {
  const listingResponse = await request.get(`${mailpitOrigin}/api/v1/messages`);
  if (!listingResponse.ok()) return null;
  const listing = await listingResponse.json() as {messages?: MailpitMessage[]};
  const message = listing.messages?.find((item) => item.Subject.includes(subjectPart) && item.To.some((target) => target.Address.toLowerCase() === recipient.toLowerCase()));
  if (!message) return null;
  const detail = await request.get(`${mailpitOrigin}/api/v1/message/${message.ID}`);
  return detail.ok() ? await detail.json() as MailpitDetail : null;
}

async function waitForMail(request: APIRequestContext, recipient: string, subjectPart: string): Promise<MailpitDetail> {
  let message: MailpitDetail | null = null;
  await expect.poll(async () => {message = await findMessage(request, recipient, subjectPart); return Boolean(message);}, {timeout: 30_000}).toBe(true);
  return message!;
}

function linkFrom(message: MailpitDetail, path: "review" | "access"): string {
  const source = `${message.HTML}\n${message.Text}`.replace(/&amp;/g, "&");
  const link = source.match(new RegExp(`http://localhost:5173/external/${path}/[A-Za-z0-9_-]+`))?.[0] ?? "";
  expect(link).not.toBe("");
  return link;
}

function otpFrom(message: MailpitDetail): string {
  const code = message.Text.match(/\b\d{6}\b/)?.[0] ?? "";
  expect(code).toMatch(/^\d{6}$/);
  return code;
}

const clientPayload = {
  numberOfBorrowers: 2, borrowerRelationship: "MARRIED", borrowerRelationshipOther: null,
  household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [
    {order: 1, isPrimary: true, firstName: "בדיקת", lastName: "מסירה", identityNumber: "123456782", dateOfBirth: "1985-06-15", phone: "0501234567", email: "delivery-client@syncash.local", address: "רחוב סודי 1, תל אביב", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SALARIED", employerName: "מעסיק סודי בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6}, income: {monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: null}, liabilities: []},
    {order: 2, isPrimary: false, firstName: "לווה", lastName: "נוסף", identityNumber: "987654324", dateOfBirth: "1987-08-20", phone: "0507654321", email: "second-borrower@syncash.local", address: "רחוב סודי 1, תל אביב", maritalStatus: "MARRIED", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SELF_EMPLOYED", employerName: "עסק סודי", jobTitle: "בעלים", employmentSeniorityYears: 8}, income: {monthlyNetIncome: 15_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}, liabilities: []}
  ],
  householdLiabilities: [{type: "MORTGAGE", otherTypeDescription: null, currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "משכנתה של בדיקת מסירה בטלפון 0501234567"}],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס הסודי 2, תל אביב", value: 2_000_000},
  loanPurpose: "SECOND_HAND_PURCHASE", loanRequest: {requestedAmount: 1_000_000}, dealDetails: "בדיקת מסירה מבקשת מימון. delivery-client@syncash.local ומעסיק סודי בע״מ", status: "ACTIVE"
};

test("advisor-to-company delivery uses personal links, OTP and a seven-day full portal", async ({browser, page, request}) => {
  test.setTimeout(360_000);
  const advisorEmail = process.env.E2E_ADVISOR_EMAIL; const advisorPassword = process.env.E2E_ADVISOR_PASSWORD;
  const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL; const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!advisorEmail || !advisorPassword || !adminEmail || !adminPassword) throw new Error("E2E advisor and admin credentials are required");
  const unique = Date.now(); const companyName = `מימון אופק ${unique}`; const contactA = `delivery-a-${unique}@syncash.local`; const contactB = `delivery-b-${unique}@syncash.local`;
  let clientId = 0; const companyIds: number[] = []; let advisorAuthorization = ""; let adminAuthorization = ""; const contexts: BrowserContext[] = [];
  const consoleErrors: string[] = []; const failedResponses: string[] = [];
  page.on("console", (message) => {if (message.type() === "error") consoleErrors.push(message.text());});
  page.on("response", (response) => {if (response.url().startsWith(`${apiOrigin}/api/`) && response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);});
  try {
    await request.delete(`${mailpitOrigin}/api/v1/messages`);
    const admin = await loginInNewContext(browser, adminEmail, adminPassword); contexts.push(admin.context); adminAuthorization = admin.authorization;
    await expect(admin.page.getByRole("heading", {name: "לוח הבקרה"})).toBeVisible();
    const companyResponse = await request.post(`${apiOrigin}/api/admin/financing-companies`, {headers: {authorization: adminAuthorization}, data: {name: companyName, legalName: null, companyNumber: null, phone: null, address: null, website: null, activityAreas: ["משכנתאות", "איחוד הלוואות"], adminNotes: "הערת בדיקה מוצפנת", active: false}});
    expect(companyResponse.ok()).toBe(true); const companyId = (await companyResponse.json()).id as number; companyIds.push(companyId);
    for (const [firstName, email, isPrimary] of [["נועה", contactA, true], ["דוד", contactB, false]] as const) {
      const contact = await request.post(`${apiOrigin}/api/admin/financing-companies/${companyId}/contacts`, {headers: {authorization: adminAuthorization}, data: {firstName, lastName: "בדיקה", roleTitle: "חתם/ת", email, phone: null, isPrimary, active: true}});
      expect(contact.ok()).toBe(true);
    }
    expect((await request.patch(`${apiOrigin}/api/admin/financing-companies/${companyId}`, {headers: {authorization: adminAuthorization}, data: {active: true}})).ok()).toBe(true);

    advisorAuthorization = await login(page, advisorEmail, advisorPassword);
    await expect(page.getByRole("heading", {name: "ברוך הבא ללוח הבקרה"})).toBeVisible();
    const created = await request.post(`${apiOrigin}/api/clients`, {headers: {authorization: advisorAuthorization}, data: clientPayload});
    expect(created.ok()).toBe(true); const client = await created.json() as {id: number; publicCaseNumber: string; borrowers: Array<{id: number; borrowerOrder: number}>}; clientId = client.id;
    const pdf = Buffer.from("%PDF-1.7\nSynCash E2E immutable document");
    for (const borrower of client.borrowers) {
      for (const documentType of ["ID_FRONT", "ID_BACK", "ID_APPENDIX"]) {
        const upload = await request.post(`${apiOrigin}/api/clients/${clientId}/documents`, {headers: {authorization: advisorAuthorization}, multipart: {documentType, borrowerId: String(borrower.id), file: {name: `${documentType}.pdf`, mimeType: "application/pdf", buffer: pdf}}});
        expect(upload.ok()).toBe(true);
      }
    }
    for (const documentType of ["PROPERTY_RIGHTS", "POWER_OF_ATTORNEY"]) {
      const upload = await request.post(`${apiOrigin}/api/clients/${clientId}/documents`, {headers: {authorization: advisorAuthorization}, multipart: {documentType, file: {name: `${documentType}.pdf`, mimeType: "application/pdf", buffer: pdf}}});
      expect(upload.ok()).toBe(true);
    }

    await page.goto(`/advisor/clients/${clientId}`);
    await expect(page.getByRole("heading", {name: "בדיקת מסירה ועוד 1"})).toBeVisible();
    await page.getByRole("button", {name: /שליחה לחברות מימון/}).click();
    await page.getByLabel(`בחירת ${companyName}`).check();
    const previewResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/clients/${clientId}/delivery/preview`) && response.request().method() === "POST");
    await page.getByRole("button", {name: "המשך לתצוגה מוסווית"}).click();
    const previewResponse = await previewResponsePromise; expect(previewResponse.ok()).toBe(true);
    const previewBody = JSON.stringify(await previewResponse.json());
    for (const pii of ["בדיקת", "מסירה", "123456782", "0501234567", "delivery-client@syncash.local", "רחוב סודי", "מעסיק סודי"]) expect(previewBody).not.toContain(pii);
    await expect(page.getByRole("heading", {name: "תצוגה מקדימה מוסווית"})).toBeVisible();
    await expect(page.getByText("2", {exact: true}).first()).toBeVisible();
    await page.getByRole("button", {name: "המשך לאישור"}).click();
    await page.getByLabel("אני מאשר/ת שהמידע המוסווה נבדק ושהתיק מוכן לשליחה.").check();
    const sendResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/clients/${clientId}/delivery/send`) && response.request().method() === "POST");
    await page.getByRole("button", {name: "אישור ושליחת התיק"}).click();
    expect((await sendResponsePromise).status()).toBe(201);
    await expect(page.getByRole("heading", {name: "התיק נשלח בהצלחה"})).toBeVisible();

    const [initialA, initialB] = await Promise.all([waitForMail(request, contactA, client.publicCaseNumber), waitForMail(request, contactB, client.publicCaseNumber)]);
    expect(initialA.Attachments).toHaveLength(0); expect(initialB.Attachments).toHaveLength(0);
    const reviewA = linkFrom(initialA, "review"); const reviewB = linkFrom(initialB, "review"); expect(reviewA).not.toBe(reviewB);

    const reviewContext = await browser.newContext(); contexts.push(reviewContext); const reviewPage = await reviewContext.newPage();
    await reviewPage.goto(reviewA); await expect(reviewPage.getByRole("heading", {name: "תיק מימון מוסווה לבחינה"})).toBeVisible();
    for (const pii of ["בדיקת מסירה", "123456782", "0501234567", "delivery-client@syncash.local", "מעסיק סודי", "רחוב הנכס הסודי"]) await expect(reviewPage.locator("body")).not.toContainText(pii);
    await reviewPage.getByRole("button", {name: "מעוניינים", exact: true}).click();
    await expect(reviewPage.getByText("קוד חד־פעמי נשלח")).toBeVisible();
    const interestOtp = otpFrom(await waitForMail(request, contactA, "קוד אימות לפתיחת תיק מימון"));
    await reviewPage.getByLabel("קוד חד־פעמי").fill(interestOtp);
    await reviewPage.getByRole("button", {name: "אימות והמשך"}).click();
    await expect(reviewPage.getByText("הגישה המלאה נפתחה")).toBeVisible();

    const secondReviewContext = await browser.newContext(); contexts.push(secondReviewContext); const secondReviewPage = await secondReviewContext.newPage();
    await secondReviewPage.goto(reviewB); await expect(secondReviewPage.getByText("כבר התקבלה החלטה מטעם חברתכם")).toBeVisible();

    const accessMessageB = await waitForMail(request, contactB, "גישה מלאה לתיק מימון נפתחה"); const accessB = linkFrom(accessMessageB, "access");
    const portalContext = await browser.newContext(); contexts.push(portalContext); const portalPage = await portalContext.newPage();
    await portalPage.goto(accessB); await expect(portalPage.getByRole("heading", {name: "גישה מלאה לתיק"})).toBeVisible();
    await portalPage.getByRole("button", {name: "שליחת קוד כניסה"}).click();
    const portalOtp = otpFrom(await waitForMail(request, contactB, "קוד אימות לפתיחת תיק מלא"));
    await portalPage.getByLabel("קוד חד־פעמי").fill(portalOtp);
    await portalPage.getByRole("button", {name: "כניסה מאובטחת"}).click();
    await expect(portalPage.getByRole("heading", {name: "תיק מימון מלא"})).toBeVisible();
    await expect(portalPage.getByText("בדיקת מסירה", {exact: true})).toBeVisible();
    await expect(portalPage.getByText("0501234567", {exact: true})).toBeVisible();
    await expect(portalPage.getByText("מעסיק סודי בע״מ", {exact: true})).toBeVisible();
    await expect(portalPage.getByText("היועץ המטפל")).toBeVisible();
    await expect(portalPage.getByRole("button", {name: /הצעה/})).toHaveCount(0);
    const fullPdf = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: "PDF מלא"}).click(); expect((await fullPdf).suggestedFilename()).toContain("תיק-מימון-מלא");
    const documentDownload = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: /^הורדת /}).first().click(); expect((await documentDownload).suggestedFilename()).not.toContain("ID_FRONT");
    const zipDownload = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: "הורדת כל התיק"}).click(); expect((await zipDownload).suggestedFilename()).toMatch(/\.zip$/);

    await page.reload(); await page.getByRole("button", {name: "תגובות חברות"}).click();
    await expect(page.getByText(companyName)).toBeVisible(); await expect(page.getByText("מעוניינת", {exact: true})).toBeVisible();
    await admin.page.goto("/admin/company-submissions"); await expect(admin.page.getByRole("heading", {name: "שליחות לחברות"})).toBeVisible(); await expect(admin.page.getByText(client.publicCaseNumber)).toBeVisible();

    const raceCompanyName = `מימון פסגה ${unique}`; const raceContactA = `race-a-${unique}@syncash.local`; const raceContactB = `race-b-${unique}@syncash.local`;
    const raceCompanyResponse = await request.post(`${apiOrigin}/api/admin/financing-companies`, {headers: {authorization: adminAuthorization}, data: {name: raceCompanyName, legalName: null, companyNumber: null, phone: null, address: null, website: null, activityAreas: ["מימון נכסים"], adminNotes: null, active: false}});
    expect(raceCompanyResponse.ok()).toBe(true); const raceCompanyId = (await raceCompanyResponse.json()).id as number; companyIds.push(raceCompanyId);
    for (const [firstName, email, isPrimary] of [["רוני", raceContactA, true], ["גל", raceContactB, false]] as const) {
      expect((await request.post(`${apiOrigin}/api/admin/financing-companies/${raceCompanyId}/contacts`, {headers: {authorization: adminAuthorization}, data: {firstName, lastName: "בדיקה", roleTitle: "חתם/ת", email, phone: null, isPrimary, active: true}})).ok()).toBe(true);
    }
    expect((await request.patch(`${apiOrigin}/api/admin/financing-companies/${raceCompanyId}`, {headers: {authorization: adminAuthorization}, data: {active: true}})).ok()).toBe(true);
    const racePreviewResponse = await request.post(`${apiOrigin}/api/clients/${clientId}/delivery/preview`, {headers: {authorization: advisorAuthorization}, data: {companyIds: [raceCompanyId]}}); expect(racePreviewResponse.ok()).toBe(true);
    const racePreview = await racePreviewResponse.json() as {previewConfirmation: string};
    const raceSend = await request.post(`${apiOrigin}/api/clients/${clientId}/delivery/send`, {headers: {authorization: advisorAuthorization}, data: {companyIds: [raceCompanyId], idempotencyKey: randomUUID(), previewConfirmation: racePreview.previewConfirmation}}); expect(raceSend.status()).toBe(201);
    const [raceInitialA, raceInitialB] = await Promise.all([waitForMail(request, raceContactA, client.publicCaseNumber), waitForMail(request, raceContactB, client.publicCaseNumber)]);
    const raceReviewA = linkFrom(raceInitialA, "review"); const raceReviewB = linkFrom(raceInitialB, "review");
    const raceContextA = await browser.newContext(); contexts.push(raceContextA); const racePageA = await raceContextA.newPage(); await racePageA.goto(raceReviewA);
    await racePageA.getByRole("button", {name: "מעוניינים", exact: true}).click(); await expect(racePageA.getByText("קוד חד־פעמי נשלח")).toBeVisible();
    const pendingOtp = otpFrom(await waitForMail(request, raceContactA, "קוד אימות לפתיחת תיק מימון"));
    const raceContextB = await browser.newContext(); contexts.push(raceContextB); const racePageB = await raceContextB.newPage(); await racePageB.goto(raceReviewB);
    racePageB.once("dialog", (dialog) => void dialog.accept()); await racePageB.getByRole("button", {name: "לא מעוניינים", exact: true}).click();
    await expect(racePageB.getByText("התגובה נשמרה")).toBeVisible();
    await racePageA.getByLabel("קוד חד־פעמי").fill(pendingOtp); await racePageA.getByRole("button", {name: "אימות והמשך"}).click();
    await expect(racePageA.getByRole("alert")).toContainText("כבר התקבלה החלטה");
    await racePageA.reload(); await expect(racePageA.getByText("כבר התקבלה החלטה מטעם חברתכם")).toBeVisible();
    await Promise.all([waitForMail(request, raceContactA, "תודה על תגובתכם"), waitForMail(request, raceContactB, "תודה על תגובתכם"), waitForMail(request, advisorEmail, `חברת ${raceCompanyName} אינה מעוניינת`)]);
    expect(await findMessage(request, raceContactA, "גישה מלאה לתיק מימון נפתחה")).toBeNull();
    expect(consoleErrors).toEqual([]); expect(failedResponses).toEqual([]);
  } finally {
    for (const context of contexts.reverse()) await context.close().catch(() => undefined);
    if (clientId && advisorAuthorization) await request.delete(`${apiOrigin}/api/clients/${clientId}`, {headers: {authorization: advisorAuthorization}}).catch(() => undefined);
    for (const companyId of companyIds.reverse()) if (adminAuthorization) await request.delete(`${apiOrigin}/api/admin/financing-companies/${companyId}`, {headers: {authorization: adminAuthorization}}).catch(() => undefined);
  }
});
