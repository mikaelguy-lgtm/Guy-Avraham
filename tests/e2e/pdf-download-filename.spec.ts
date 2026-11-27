import {expect, test, type Page} from "@playwright/test";

const apiOrigin = "http://localhost:3000";

async function login(page: Page, email: string, password: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("דואר אלקטרוני").fill(email);
  await page.getByLabel("סיסמה").fill(password);
  const authenticated = page.waitForRequest((request) => request.url().includes("/api/auth/me") && Boolean(request.headers().authorization));
  await page.getByRole("button", {name: "כניסה"}).click();
  return (await authenticated).headers().authorization ?? "";
}

const clientPayload = {
  numberOfBorrowers: 1, borrowerRelationship: null, borrowerRelationshipOther: null,
  household: {numberOfChildren: 0, childrenAges: []},
  borrowers: [{
    order: 1, isPrimary: true, firstName: "בדיקת", lastName: "קובץ", identityNumber: "123456787", dateOfBirth: "1985-06-15",
    phone: "0501234567", email: `filename-test-${Date.now()}@syncash.local`, city: "תל אביב", streetAddress: "רחוב סודי 1",
    housingStatus: "OWNED", housingStatusOther: null, maritalStatus: "SINGLE", children: {numberOfChildren: 0, childrenAges: []},
    employment: {employmentType: "SALARIED", employerName: "מעסיק בדיקה", jobTitle: "מנהל", employmentSeniorityYears: 4, selfEmployed: null},
    income: {monthlyNetIncome: 20_000, additionalIncomes: []}, liabilities: []
  }],
  householdLiabilities: [],
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 1", value: 2_000_000},
  loanPurpose: "SECOND_HAND_PURCHASE", loanPurposeOther: null, loanRequest: {requestedAmount: 1_000_000},
  dealDetails: "בדיקת שם קובץ PDF להורדה.", status: "ACTIVE"
};

// Root cause (confirmed by direct reproduction before this fix): the "view"
// button opened the masked PDF via window.open() on a blob: URL built from a
// named File — but window.open() does not carry a File's name over to the
// browser's own download mechanism, so saving from that view produced a raw
// blob UUID filename (e.g. "feae03c9-....pdf"), matching the reported bug
// exactly. Only an explicit <a download="..."> element reliably names the
// saved file — see src/utils/pdfBlob.ts's downloadPdfBlob().
test("the explicit 'download PDF' action always produces a human-readable SynCash filename", async ({page, request}) => {
  const authorization = await login(page, process.env.E2E_ADVISOR_EMAIL ?? "advisor@syncash.local", process.env.E2E_ADVISOR_PASSWORD!);
  const created = await request.post(`${apiOrigin}/api/clients`, {headers: {authorization}, data: clientPayload});
  expect(created.ok()).toBe(true);
  const client = await created.json() as {id: number; publicCaseNumber: string; borrowers: Array<{id: number}>};
  const borrowerId = String(client.borrowers[0].id);

  for (const documentType of ["ID_FRONT", "ID_BACK", "ID_APPENDIX", "CREDIT_DATA_REPORT"]) {
    const pdf = Buffer.from("%PDF-1.4\n%%EOF");
    const upload = await request.post(`${apiOrigin}/api/clients/${client.id}/documents`, {headers: {authorization}, multipart: {documentType, borrowerId, file: {name: `${documentType}.pdf`, mimeType: "application/pdf", buffer: pdf}}});
    expect(upload.ok()).toBe(true);
  }
  const powerOfAttorney = await request.post(`${apiOrigin}/api/clients/${client.id}/documents`, {headers: {authorization}, multipart: {documentType: "POWER_OF_ATTORNEY", file: {name: "POWER_OF_ATTORNEY.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF")}}});
  expect(powerOfAttorney.ok()).toBe(true);

  await page.goto(`/advisor/clients/${client.id}`);
  await page.getByRole("button", {name: /שליחה לחברות מימון/}).click();
  await page.getByRole("button", {name: "המשך"}).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {name: "הורדת PDF"}).click()
  ]);

  expect(download.suggestedFilename()).toBe(`SynCash_תיק_מימון_ראשוני_${client.publicCaseNumber}.pdf`);
});
