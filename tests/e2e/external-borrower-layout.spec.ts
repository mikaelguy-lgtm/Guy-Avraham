import {mkdir} from "node:fs/promises";
import {expect, test, type Page} from "@playwright/test";

const outputDirectory = `${process.cwd()}/output/external-borrower-layout`;

const firstBorrower = {
  order: 1, label: "לווה 1", firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", age: 41,
  phone: "0501234567", email: "very-long-borrower-email-address-for-responsive-verification@syncash.local", address: "רחוב סודי 1, תל אביב", residenceCity: "תל אביב", maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8],
  employment: {employmentType: "SALARIED", employerName: "חברה סודית בע״מ", jobTitle: "מנהלת כספים", employmentSeniorityYears: 6, monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: "שכר דירה חודשי"},
  liabilities: [{type: "LOAN", currentBalance: 100_000, monthlyPayment: 1_500, endDate: "2030-01-01", notes: "הלוואה אישית"}]
};

const secondBorrower = {
  ...firstBorrower, order: 2, label: "לווה 2", firstName: "נועם", identityNumber: "987654321", dateOfBirth: "1987-08-20", age: 38,
  phone: "0507654321", email: "noam@example.com", employment: {...firstBorrower.employment, employmentType: "SELF_EMPLOYED", employerName: "עסק סודי", jobTitle: "בעלים", monthlyNetIncome: 15_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}, liabilities: []
};

const baseSnapshot = {
  publicCaseNumber: "SC-LAYOUT", numberOfBorrowers: 2, borrowerRelationship: "MARRIED", household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [firstBorrower, secondBorrower], householdLiabilities: [{type: "MORTGAGE", currentBalance: 400_000, monthlyPayment: 4_000, endDate: "2040-07-31", notes: "התחייבות משותפת למשק הבית"}],
  property: {propertyType: "APARTMENT", city: "תל אביב", address: "רחוב הנכס 9", value: 2_000_000}, loanRequest: {purpose: "SECOND_HAND_PURCHASE", requestedAmount: 1_000_000, requestedTermMonths: 240, loanToValue: 50},
  totals: {monthlyIncome: 37_500, liabilityBalance: 500_000, monthlyPayments: 5_500}, dealDetails: "רכישת דירה יד שנייה\nהעסקה מותנית באישור המימון.", advisor: {fullName: "יועץ בדיקה", businessName: "SynCash", phone: "0500000000", email: "advisor@syncash.local"}
};

const scenarios = {
  single: {...baseSnapshot, numberOfBorrowers: 1, borrowerRelationship: null, household: {numberOfChildren: 0, childrenAges: []}, borrowers: [{...firstBorrower, maritalStatus: "SINGLE", numberOfChildren: 0, childrenAges: []}], householdLiabilities: []},
  "two-married-shared": baseSnapshot,
  "two-separate": {...baseSnapshot, borrowerRelationship: "PARTNERS", household: {numberOfChildren: 0, childrenAges: []}, borrowers: [firstBorrower, {...secondBorrower, liabilities: [{type: "CREDIT_CARD", currentBalance: 12_000, monthlyPayment: 600, endDate: "2028-12-31", notes: "התחייבות לווה שני"}]}], householdLiabilities: []}
} as const;

function maskedSnapshot(snapshot: typeof baseSnapshot) {
  return {
    ...snapshot,
    borrowers: snapshot.borrowers.map((borrower) => ({
      label: borrower.label, age: borrower.age, residenceCity: borrower.residenceCity, maritalStatus: borrower.maritalStatus, numberOfChildren: borrower.numberOfChildren, childrenAges: borrower.childrenAges,
      employment: {employmentType: borrower.employment.employmentType, jobTitle: borrower.employment.jobTitle, employmentSeniorityYears: borrower.employment.employmentSeniorityYears, monthlyNetIncome: borrower.employment.monthlyNetIncome, hasAdditionalIncome: borrower.employment.hasAdditionalIncome, additionalIncomeType: borrower.employment.additionalIncomeType, additionalIncomeAmount: borrower.employment.additionalIncomeAmount, additionalIncomeDescription: borrower.employment.additionalIncomeDescription},
      liabilities: borrower.liabilities
    })),
    property: {propertyType: snapshot.property.propertyType, city: snapshot.property.city, value: snapshot.property.value},
    dealDetails: "רכישת דירה יד שנייה לאחר הסוואת הפרטים המזהים.", documentStatus: "כל מסמכי החובה קיימים בתיק."
  };
}

async function mockExternalRoutes(page: Page, snapshot: typeof baseSnapshot) {
  await page.route("**/api/external/review/layout-test", (route) => route.fulfill({json: {companyName: "מימון בטוח", publicCaseNumber: snapshot.publicCaseNumber, versionNumber: 1, sentAt: new Date().toISOString(), responseDeadlineAt: "2026-08-01T15:00:00.000Z", decisionStatus: "PENDING", accessStatus: "NONE", maskedSnapshot: maskedSnapshot(snapshot), closed: false, message: null, csrfToken: "layout-csrf"}}));
  await page.route("**/api/external/portal/case", (route) => route.fulfill({json: {companyName: "מימון בטוח", versionNumber: 1, accessExpiresAt: "2026-08-05T15:00:00.000Z", snapshot, csrfToken: "layout-csrf"}}));
  await page.route("**/api/external/portal/documents", (route) => route.fulfill({json: []}));
}

async function assertResponsiveLayout(page: Page) {
  await expect(page.locator(".external-borrower-card").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator("body")).not.toContainText(/SALARIED|SELF_EMPLOYED|MARRIED|PARTNERS|MORTGAGE|CREDIT_CARD/u);
}

for (const viewport of [{name: "mobile-390", width: 390, height: 844}, {name: "tablet-768", width: 768, height: 1024}, {name: "desktop-1440", width: 1440, height: 1000}]) {
  test.describe(`external borrower layout ${viewport.name}`, () => {
    test.use({viewport: {width: viewport.width, height: viewport.height}});
    for (const [scenarioName, snapshot] of Object.entries(scenarios)) {
      test(`${scenarioName} renders masked and full layouts`, async ({page}) => {
        await mkdir(outputDirectory, {recursive: true});
        const consoleErrors: string[] = [];
        page.on("console", (message) => {if (message.type() === "error") consoleErrors.push(message.text());});
        await mockExternalRoutes(page, snapshot as typeof baseSnapshot);

        await page.goto("/external/review/layout-test");
        await expect(page.getByTestId("external-borrowers-masked")).toBeVisible();
        await expect(page.locator("body")).not.toContainText("דנה לוי");
        await expect(page.locator("body")).not.toContainText("123456789");
        await assertResponsiveLayout(page);
        await page.screenshot({path: `${outputDirectory}/${viewport.name}-${scenarioName}-masked.png`, fullPage: true});

        await page.goto("/external/portal");
        await expect(page.getByTestId("external-borrowers-full")).toBeVisible();
        await expect(page.locator("body")).toContainText("דנה לוי");
        await assertResponsiveLayout(page);
        await page.screenshot({path: `${outputDirectory}/${viewport.name}-${scenarioName}-full.png`, fullPage: true});

        expect(consoleErrors).toEqual([]);
      });
    }
  });
}
