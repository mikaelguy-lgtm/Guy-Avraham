import {randomUUID} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page} from "@playwright/test";
import {GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import JSZip from "jszip";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";

const apiOrigin = "http://localhost:3000";
const mailpitOrigin = "http://localhost:8025";
const pdfProofDirectory = `${process.cwd()}/output/pdf-hebrew-verification`;
const borrowerLayoutProofDirectory = `${process.cwd()}/output/external-borrower-layout`;

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

async function countMessages(request: APIRequestContext, recipient: string, subjectPart: string): Promise<number> {
  const listingResponse = await request.get(`${mailpitOrigin}/api/v1/messages`);
  if (!listingResponse.ok()) return 0;
  const listing = await listingResponse.json() as {messages?: MailpitMessage[]};
  return listing.messages?.filter((item) => item.Subject.includes(subjectPart) && item.To.some((target) => target.Address.toLowerCase() === recipient.toLowerCase())).length ?? 0;
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

async function extractPdf(pdf: Buffer): Promise<{pageCount: number; pageTexts: string[]; text: string}> {
  const document = await getDocument({data: new Uint8Array(pdf)}).promise;
  const pageTexts: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => "str" in item ? item.str : "").join(" ").split("\u0000").join("").replace(/\s+/gu, " ").trim());
  }
  return {pageCount: document.numPages, pageTexts, text: pageTexts.join(" ")};
}

async function downloadedBuffer(download: {path(): Promise<string | null>}): Promise<Buffer> {
  const filePath = await download.path();
  if (!filePath) throw new Error("PLAYWRIGHT_DOWNLOAD_PATH_MISSING");
  return readFile(filePath);
}

function expectHealthyHebrewPdf(extracted: {pageCount: number; pageTexts: string[]; text: string}, kind: "masked" | "full"): void {
  expect(extracted.pageCount).toBeGreaterThan(1);
  expect(extracted.pageCount).toBeLessThanOrEqual(kind === "masked" ? 4 : 5);
  expect(extracted.pageTexts.every((pageText) => pageText.replace(/SYNCASH|מידע סודי|הופק|עמוד|מתוך|\s/g, "").length > 10)).toBe(true);
  for (const heading of kind === "masked"
    ? ["תיק מימון מוסווה לבחינה", "תקציר העסקה", "הכנסות", "התחייבויות", "נכס ובקשת מימון", "פירוט העסקה", "כל מסמכי החובה קיימים בתיק"]
    : ["תיק מימון מלא", "תקציר העסקה", "פרטים אישיים", "הכנסות", "התחייבויות", "נכס ובקשת מימון", "פירוט העסקה", "כל מסמכי החובה קיימים בתיק"]
  ) expect(extracted.text).toContain(heading);
  expect(extracted.text).not.toMatch(/[�□■]/u);
  expect(extracted.text).not.toMatch(/SECOND_HAND_PURCHASE|SALARIED|SELF_EMPLOYED|APARTMENT|MORTGAGE/u);
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

test("advisor-to-company delivery uses one OTP and a persistent seven-day portal grant", async ({browser, page, request}) => {
  test.setTimeout(360_000);
  const advisorEmail = process.env.E2E_ADVISOR_EMAIL; const advisorPassword = process.env.E2E_ADVISOR_PASSWORD;
  const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL; const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!advisorEmail || !advisorPassword || !adminEmail || !adminPassword) throw new Error("E2E advisor and admin credentials are required");
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_KEY || !process.env.S3_BUCKET) throw new Error("E2E MinIO credentials are required");
  const testStartedAt = Date.now();
  const s3 = new S3Client({endpoint: "http://localhost:9000", region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true, credentials: {accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_KEY}});
  const unique = Date.now(); const companyName = `מימון אופק ${unique}`; const contactA = `delivery-a-${unique}@syncash.local`; const contactB = `delivery-b-${unique}@syncash.local`;
  let clientId = 0; const companyIds: number[] = []; let advisorAuthorization = ""; let adminAuthorization = ""; let previewPdf = Buffer.alloc(0); const contexts: BrowserContext[] = [];
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
    const preview = await previewResponse.json() as {maskedPdfBase64: string; pdfRendererVersion: number; pdfFontFingerprint: string; pdfGeneratedAt: string; pdfContentHash: string};
    const previewBody = JSON.stringify(preview);
    for (const pii of ["בדיקת", "מסירה", "123456782", "0501234567", "delivery-client@syncash.local", "רחוב סודי", "מעסיק סודי"]) expect(previewBody).not.toContain(pii);
    expect(preview.pdfRendererVersion).toBe(3); expect(preview.pdfFontFingerprint).toMatch(/^[a-f0-9]{64}$/); expect(preview.pdfContentHash).toMatch(/^[a-f0-9]{64}$/);
    previewPdf = Buffer.from(preview.maskedPdfBase64, "base64");
    await mkdir(pdfProofDirectory, {recursive: true}); await writeFile(`${pdfProofDirectory}/masked-from-docker-endpoint.pdf`, previewPdf);
    expect(previewPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(previewPdf.toString("latin1")).toContain("NotoSansHebrew");
    const previewExtracted = await extractPdf(previewPdf); expectHealthyHebrewPdf(previewExtracted, "masked");
    for (const pii of ["בדיקת", "מסירה", "123456782", "0501234567", "delivery-client@syncash.local", "מעסיק סודי"]) expect(previewExtracted.text).not.toContain(pii);
    await expect(page.getByRole("heading", {name: "תצוגה מקדימה מוסווית"})).toBeVisible();
    await expect(page.getByText("2", {exact: true}).first()).toBeVisible();
    const previewPopupPromise = page.waitForEvent("popup");
    await page.getByRole("button", {name: "צפייה ב־PDF המוסווה"}).click();
    const previewPopup = await previewPopupPromise;
    await expect.poll(() => previewPopup.url()).toMatch(/^(?:blob:|:)$/);
    expect(previewPopup.isClosed()).toBe(false);
    await previewPopup.close();
    await page.getByRole("button", {name: "המשך לאישור"}).click();
    await page.getByLabel("אני מאשר/ת שהמידע המוסווה נבדק ושהתיק מוכן לשליחה.").check();
    const sendResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/clients/${clientId}/delivery/send`) && response.request().method() === "POST");
    await page.getByRole("button", {name: "אישור ושליחת התיק"}).click();
    expect((await sendResponsePromise).status()).toBe(201);
    const listedObjects = await s3.send(new ListObjectsV2Command({Bucket: process.env.S3_BUCKET, Prefix: "case-versions/"}));
    const maskedObject = listedObjects.Contents?.filter((item) => item.Key?.endsWith("/masked.pdf") && (item.LastModified?.getTime() ?? 0) >= testStartedAt - 5_000).sort((left, right) => (right.LastModified?.getTime() ?? 0) - (left.LastModified?.getTime() ?? 0))[0];
    expect(maskedObject?.Key).toBeTruthy();
    await s3.send(new PutObjectCommand({Bucket: process.env.S3_BUCKET, Key: maskedObject!.Key, Body: Buffer.from("%PDF-1.7\nbroken stale renderer"), ContentType: "application/pdf", Metadata: {"renderer-version": "2", "font-fingerprint": "stale", "content-hash": "stale"}}));
    await expect(page.getByRole("heading", {name: "התיק הועבר לתור השליחה"})).toBeVisible();
    await page.getByRole("dialog", {name: "שליחה לחברות מימון"}).getByRole("button", {name: "סגירה"}).click();
    await expect(page.locator(".advisor-topbar .notification-badge")).toBeVisible();
    await page.locator(".advisor-topbar").getByRole("button", {name: /התראות/}).click();
    await expect(page.locator(".notification-popover").getByText(`תיק ${client.publicCaseNumber} נשלח`, {exact: false})).toBeVisible();
    await page.locator(".notification-popover").getByRole("button", {name: "סמן הכל כנקרא"}).click();
    await expect(page.locator(".advisor-topbar .notification-badge")).toHaveCount(0);
    await page.locator(".notification-popover").getByRole("link", {name: "לכל ההתראות"}).click();
    await expect(page).toHaveURL(/\/advisor\/notifications$/);
    await expect(page.getByText(`תיק ${client.publicCaseNumber} נשלח`, {exact: false})).toBeVisible();
    await expect(page.locator(".notification-card").filter({hasText: client.publicCaseNumber})).toHaveClass(/read/);

    const [initialA, initialB] = await Promise.all([waitForMail(request, contactA, client.publicCaseNumber), waitForMail(request, contactB, client.publicCaseNumber)]);
    expect(initialA.Attachments).toHaveLength(0); expect(initialB.Attachments).toHaveLength(0);
    const reviewA = linkFrom(initialA, "review"); const reviewB = linkFrom(initialB, "review"); expect(reviewA).not.toBe(reviewB);

    const reviewContext = await browser.newContext(); contexts.push(reviewContext); const reviewPage = await reviewContext.newPage();
    await reviewPage.goto(reviewA); await expect(reviewPage.getByRole("heading", {name: "תיק מימון מוסווה לבחינה"})).toBeVisible();
    await expect(reviewPage.getByTestId("external-borrowers-masked")).toBeVisible();
    await expect(reviewPage.locator(".external-borrower-card")).toHaveCount(2);
    await expect(reviewPage.locator(".external-household-liabilities")).toHaveCount(1);
    await reviewPage.setViewportSize({width: 1440, height: 1000}); await mkdir(borrowerLayoutProofDirectory, {recursive: true}); await reviewPage.screenshot({path: `${borrowerLayoutProofDirectory}/live-full-flow-masked-1440.png`, fullPage: true});
    for (const pii of ["בדיקת מסירה", "123456782", "0501234567", "delivery-client@syncash.local", "מעסיק סודי", "רחוב הנכס הסודי"]) await expect(reviewPage.locator("body")).not.toContainText(pii);
    const reviewToken = new URL(reviewA).pathname.split("/").at(-1) ?? "";
    const persistedMaskedResponse = await request.get(`${apiOrigin}/api/external/review/${reviewToken}/masked-pdf?download=1`);
    expect(persistedMaskedResponse.ok()).toBe(true); expect(persistedMaskedResponse.headers()["cache-control"]).toContain("no-store");
    const persistedMaskedPdf = Buffer.from(await persistedMaskedResponse.body());
    expect(persistedMaskedPdf).toEqual(previewPdf);
    expectHealthyHebrewPdf(await extractPdf(persistedMaskedPdf), "masked");
    const regeneratedObject = await s3.send(new GetObjectCommand({Bucket: process.env.S3_BUCKET, Key: maskedObject!.Key}));
    expect(regeneratedObject.Metadata?.["renderer-version"]).toBe("3"); expect(regeneratedObject.Metadata?.["font-fingerprint"]).toMatch(/^[a-f0-9]{64}$/); expect(regeneratedObject.Metadata?.["content-hash"]).toMatch(/^[a-f0-9]{64}$/);
    const maskedDownloadPromise = reviewPage.waitForEvent("download"); await reviewPage.getByRole("button", {name: "הורדת PDF"}).click();
    const maskedDownload = await maskedDownloadPromise; expect(await downloadedBuffer(maskedDownload)).toEqual(previewPdf);
    await reviewPage.getByRole("button", {name: "מעוניינים", exact: true}).click();
    await expect(reviewPage.getByText("המייל נשלח לשרת הדואר", {exact: false})).toBeVisible();
    await expect(reviewPage.getByText("ספאם, דואר זבל וקידומי מכירות", {exact: false})).toBeVisible();
    const interestOtp = otpFrom(await waitForMail(request, contactA, "קוד אימות לפתיחת תיק מימון"));
    const invalidOtp = interestOtp === "000000" ? "111111" : "000000";
    await reviewPage.getByLabel("קוד חד־פעמי").fill(invalidOtp);
    await reviewPage.getByRole("button", {name: "אימות ומעבר לתיק המלא"}).click();
    await expect(reviewPage.getByRole("alert")).toContainText("קוד האימות שגוי");
    await expect(reviewPage.getByRole("heading", {name: "תיק מימון מלא"})).toHaveCount(0);
    await reviewPage.getByLabel("קוד חד־פעמי").fill(interestOtp);
    await reviewPage.getByRole("button", {name: "אימות ומעבר לתיק המלא"}).click();
    await expect(reviewPage).toHaveURL(/\/external\/portal$/);
    await expect(reviewPage.getByRole("heading", {name: "תיק מימון מלא"})).toBeVisible();
    await expect.poll(() => countMessages(request, contactA, "קוד אימות לפתיחת תיק מימון")).toBe(1);
    expect(await findMessage(request, contactA, "גישה מלאה לתיק מימון נפתחה")).toBeNull();
    expect(await findMessage(request, contactB, "גישה מלאה לתיק מימון נפתחה")).toBeNull();
    const replayReview = await reviewContext.request.get(`${apiOrigin}/api/external/review/${reviewToken}`); const replayBody = await replayReview.json() as {csrfToken: string};
    const replayOtp = await reviewContext.request.post(`${apiOrigin}/api/external/review/${reviewToken}/interested/verify`, {headers: {"x-csrf-token": replayBody.csrfToken}, data: {code: interestOtp}}); expect(replayOtp.status()).toBe(409);
    const flowStateResponse = await request.get(`${apiOrigin}/api/test/lender-flow?clientId=${clientId}&companyId=${companyId}`, {headers: {authorization: adminAuthorization}}); expect(flowStateResponse.ok()).toBe(true);
    expect(await flowStateResponse.json()).toEqual(expect.objectContaining({interested_events: 1, grant_events: 1, open_events: 1, otp_failed_events: 1, otp_emails: 1, full_access_emails: 0, lender_follow_up_emails: 0}));

    const secondReviewContext = await browser.newContext(); contexts.push(secondReviewContext); const secondReviewPage = await secondReviewContext.newPage();
    await secondReviewPage.goto(reviewB); await expect(secondReviewPage.getByText("כבר התקבלה החלטה מטעם חברתכם")).toBeVisible();

    const portalPage = reviewPage;
    await expect(portalPage.getByRole("heading", {name: "תיק מימון מלא"})).toBeVisible();
    await expect(portalPage.getByTestId("external-borrowers-full")).toBeVisible();
    await expect(portalPage.locator(".external-borrower-card")).toHaveCount(2);
    await expect(portalPage.locator(".external-household-liabilities")).toHaveCount(1);
    await expect(portalPage.locator(".external-borrower-header p").filter({hasText: "בדיקת מסירה"}).first()).toBeVisible();
    await expect(portalPage.getByText("0501234567", {exact: true})).toBeVisible();
    await expect(portalPage.getByText("מעסיק סודי בע״מ", {exact: true})).toBeVisible();
    await expect(portalPage.getByText("היועץ המטפל")).toBeVisible();
    await portalPage.setViewportSize({width: 1440, height: 1000}); await portalPage.screenshot({path: `${borrowerLayoutProofDirectory}/live-full-flow-full-1440.png`, fullPage: true});
    await portalPage.getByLabel("סכום ההצעה *").fill("900000");
    await portalPage.getByLabel("ריבית שנתית באחוזים *").fill("4.75");
    await portalPage.getByLabel("תקופה בחודשים *").fill("240");
    await portalPage.getByLabel("החזר חודשי משוער").fill("5800");
    await portalPage.getByLabel("תנאים והערות").fill("בכפוף לאישור ועדת אשראי");
    const offerResponse = portalPage.waitForResponse((response) => response.url().endsWith("/api/external/portal/offers") && response.request().method() === "POST");
    await portalPage.getByRole("button", {name: "הגשת הצעה"}).click();
    const submittedOfferResponse = await offerResponse; expect(submittedOfferResponse.status()).toBe(201);
    await expect(portalPage.getByText("ההצעה הוגשה בהצלחה ליועץ.")).toBeVisible();
    const duplicateOffer = await reviewContext.request.post(`${apiOrigin}/api/external/portal/offers`, {headers: {"x-csrf-token": replayBody.csrfToken}, data: submittedOfferResponse.request().postDataJSON()}); expect(duplicateOffer.status()).toBe(201); expect(await duplicateOffer.json()).toEqual(expect.objectContaining({idempotent: true}));
    const offerFlowState = await request.get(`${apiOrigin}/api/test/lender-flow?clientId=${clientId}&companyId=${companyId}`, {headers: {authorization: adminAuthorization}}); expect((await offerFlowState.json()).offers).toBe(1);
    const fullPdfPromise = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: "PDF מלא"}).click(); const fullPdfDownload = await fullPdfPromise; expect(fullPdfDownload.suggestedFilename()).toContain("תיק-מימון-מלא");
    const fullPdf = await downloadedBuffer(fullPdfDownload); await writeFile(`${pdfProofDirectory}/full-from-docker-endpoint.pdf`, fullPdf); expect(fullPdf.toString("latin1")).toContain("NotoSansHebrew"); const fullExtracted = await extractPdf(fullPdf); expectHealthyHebrewPdf(fullExtracted, "full"); expect(fullExtracted.text).toContain("בדיקת מסירה");
    const documentDownload = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: /^הורדת /}).first().click(); expect((await documentDownload).suggestedFilename()).not.toContain("ID_FRONT");
    const zipDownloadPromise = portalPage.waitForEvent("download"); await portalPage.getByRole("button", {name: "הורדת כל התיק"}).click(); const zipDownload = await zipDownloadPromise; expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);
    const zip = await JSZip.loadAsync(await downloadedBuffer(zipDownload)); const zippedPdfEntry = Object.values(zip.files).find((entry) => /תיק-מימון-מלא.*\.pdf$/u.test(entry.name)); expect(zippedPdfEntry).toBeDefined();
    const zippedPdf = await zippedPdfEntry!.async("nodebuffer"); await writeFile(`${pdfProofDirectory}/full-from-zip.pdf`, zippedPdf); expect(zippedPdf).toEqual(fullPdf); expectHealthyHebrewPdf(await extractPdf(zippedPdf), "full");
    await portalPage.reload(); await expect(portalPage.getByRole("heading", {name: "תיק מימון מלא"})).toBeVisible();
    const sameSessionPage = await reviewContext.newPage(); await sameSessionPage.goto("/external/portal"); await expect(sameSessionPage.getByRole("heading", {name: "תיק מימון מלא"})).toBeVisible(); await sameSessionPage.close();
    expect(await countMessages(request, contactA, "קוד אימות לפתיחת תיק מימון")).toBe(1);
    const foreignDocument = await reviewContext.request.get(`${apiOrigin}/api/external/portal/documents/not-a-document-from-this-case/view`); expect(foreignDocument.status()).toBe(404);

    await page.goto(`/advisor/clients/${clientId}`); await page.getByRole("button", {name: "תגובות חברות"}).click();
    await expect(page.getByText(companyName)).toBeVisible(); await expect(page.getByText("מעוניינת", {exact: true})).toBeVisible();
    await page.locator(".response-card").filter({hasText: companyName}).getByRole("button", {name: "צפייה בציר הזמן"}).click();
    await expect(page.getByText("הוגשה הצעת מימון", {exact: true})).toBeVisible();
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
    await racePageA.getByRole("button", {name: "מעוניינים", exact: true}).click(); await expect(racePageA.getByText("המייל נשלח לשרת הדואר", {exact: false})).toBeVisible();
    const pendingOtp = otpFrom(await waitForMail(request, raceContactA, "קוד אימות לפתיחת תיק מימון"));
    const raceContextB = await browser.newContext(); contexts.push(raceContextB); const racePageB = await raceContextB.newPage(); await racePageB.goto(raceReviewB);
    racePageB.once("dialog", (dialog) => void dialog.accept()); await racePageB.getByRole("button", {name: "לא מעוניינים", exact: true}).click();
    await expect(racePageB.getByText("התגובה נשמרה")).toBeVisible();
    await racePageA.getByLabel("קוד חד־פעמי").fill(pendingOtp); await racePageA.getByRole("button", {name: "אימות ומעבר לתיק המלא"}).click();
    await expect(racePageA.getByRole("alert")).toContainText("כבר התקבלה החלטה");
    await racePageA.reload(); await expect(racePageA.getByText("כבר התקבלה החלטה מטעם חברתכם")).toBeVisible();
    await Promise.all([waitForMail(request, raceContactA, "תודה על תגובתכם"), waitForMail(request, raceContactB, "תודה על תגובתכם"), waitForMail(request, advisorEmail, `חברת ${raceCompanyName} אינה מעוניינת`)]);
    expect(await findMessage(request, raceContactA, "גישה מלאה לתיק מימון נפתחה")).toBeNull();
    const expireSession = await request.post(`${apiOrigin}/api/test/lender-flow/expire-session`, {headers: {authorization: adminAuthorization}, data: {clientId, companyId}}); expect(expireSession.status()).toBe(204);
    await portalPage.reload(); await expect(portalPage.getByRole("heading", {name: "הגישה לתיק הסתיימה"})).toBeVisible();
    expect(consoleErrors).toEqual([]); expect(failedResponses).toEqual([]);
  } finally {
    for (const context of contexts.reverse()) await context.close().catch(() => undefined);
    if (clientId && advisorAuthorization) await request.delete(`${apiOrigin}/api/clients/${clientId}`, {headers: {authorization: advisorAuthorization}}).catch(() => undefined);
    for (const companyId of companyIds.reverse()) if (adminAuthorization) await request.delete(`${apiOrigin}/api/admin/financing-companies/${companyId}`, {headers: {authorization: adminAuthorization}}).catch(() => undefined);
  }
});
