import { expect, test, type Page } from "@playwright/test";

async function login(page: Page): Promise<string> {
  const email = process.env.E2E_ADVISOR_EMAIL;
  const password = process.env.E2E_ADVISOR_PASSWORD;
  if (!email || !password) throw new Error("E2E advisor credentials are required");
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
  borrowers: [{order: 1, isPrimary: true, firstName: "ניווט", lastName: "עריכה", identityNumber: "333333337", dateOfBirth: "1985-05-15", phone: "0503333333", email: "client-edit@syncash.local", address: "רחוב ניווט 1", maritalStatus: "SINGLE", children: {numberOfChildren: 0, childrenAges: []}, employment: {employmentType: "SALARIED", employerName: "חברת ניווט", jobTitle: "מנהלת", employmentSeniorityYears: 5}, income: {monthlyNetIncome: 18_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null}, liabilities: []}],
  householdLiabilities: [], loanPurpose: "SECOND_HAND_PURCHASE",
  property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב נכס 2", value: 2_000_000},
  loanRequest: {requestedAmount: 1_000_000}, dealDetails: "פירוט עסקה לבדיקת ניווט", status: "ACTIVE"
};

test("focused and full client editing use accessible full-page routes", async ({page, request}) => {
  test.setTimeout(240_000);
  const authorization = await login(page);
  const created = await request.post("http://localhost:3000/api/clients", {headers: {authorization}, data: clientPayload});
  expect(created.ok()).toBe(true);
  const client = await created.json() as {id: number};
  try {
    await page.goto(`/advisor/clients/${client.id}`);
    await expect(page.getByRole("button", {name: "בקשות חשיפה", exact: true})).toHaveCount(0);
    await expect(page.getByRole("button", {name: "פעילות", exact: true})).toHaveCount(0);

    await page.getByRole("button", {name: "פרטים אישיים", exact: true}).click();
    await expect(page).toHaveURL(new RegExp(`/advisor/clients/${client.id}\\?tab=personal`));
    await page.reload();
    await expect(page.getByRole("button", {name: "פרטים אישיים", exact: true})).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", {name: "עריכת פרטים אישיים"}).click();
    await expect(page).toHaveURL(`/advisor/clients/${client.id}/edit/personal`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/לקוחות.*ניווט עריכה.*עריכת פרטים אישיים/)).toBeVisible();
    await page.getByLabel("טלפון - לווה 1", {exact: true}).fill("0504444444");
    await page.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page).toHaveURL(new RegExp(`tab=personal`));
    await expect(page.getByRole("status")).toContainText("נשמרו בהצלחה");
    await page.reload();
    await expect(page.getByText("0504444444", {exact: true})).toBeVisible();

    await page.getByRole("button", {name: "הכנסות", exact: true}).click();
    await page.getByRole("button", {name: "עריכת הכנסות"}).click();
    await page.getByLabel("הכנסה חודשית נטו - לווה 1", {exact: true}).fill("19000");
    await page.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page).toHaveURL(new RegExp(`tab=income`));
    await expect(page.getByText("19,000", {exact: false}).first()).toBeVisible();

    await page.getByRole("button", {name: "התחייבויות", exact: true}).click();
    await page.getByRole("button", {name: "עריכת התחייבויות"}).click();
    await page.getByRole("button", {name: "הוספת התחייבות"}).click();
    await page.getByLabel("סוג התחייבות 1").selectOption("LOAN");
    await page.getByLabel("יתרה נוכחית").fill("50000");
    await page.getByLabel("החזר חודשי").fill("1000");
    await page.getByLabel("תאריך סיום התחייבות").fill("2035-12-31");
    await page.getByLabel("הערות").fill("הלוואה לבדיקת עריכה");
    await page.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page).toHaveURL(new RegExp(`tab=liabilities`));
    await expect(page.getByText("50,000", {exact: false}).first()).toBeVisible();

    await page.getByRole("button", {name: "נכס", exact: true}).click();
    await page.getByRole("button", {name: "עריכת פרטי הנכס"}).click();
    await page.getByLabel("שווי הנכס").fill("2100000");
    await page.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page).toHaveURL(new RegExp(`tab=property`));
    await expect(page.getByText("2,100,000", {exact: false}).first()).toBeVisible();

    await page.getByRole("button", {name: "פירוט עסקה", exact: true}).click();
    await page.getByRole("button", {name: "עריכת פירוט עסקה"}).click();
    await page.getByLabel("פירוט עסקה").fill("פירוט עסקה מעודכן במסלול ממוקד");
    await page.getByRole("button", {name: "שמירת שינויים"}).click();
    await expect(page).toHaveURL(new RegExp(`tab=deal-details`));
    await expect(page.getByText("פירוט עסקה מעודכן במסלול ממוקד")).toBeVisible();

    await page.getByRole("button", {name: "עריכה", exact: true}).click();
    await expect(page).toHaveURL(`/advisor/clients/${client.id}/edit`);
    await expect(page.getByRole("heading", {name: "עריכת תיק מימון"})).toBeVisible();
    await expect(page.locator(".wizard-progress")).toHaveAttribute("aria-label", "שלב 1 מתוך 3");
    await page.getByLabel("טלפון - לווה 1", {exact: true}).fill("0505555555");
    await page.getByRole("button", {name: "ביטול וחזרה לתיק"}).click();
    const confirmation = page.getByRole("dialog", {name: "השינויים לא נשמרו"});
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", {name: "המשך עריכה"}).click();
    await expect(page.getByRole("heading", {name: "עריכת תיק מימון"})).toBeVisible();
    await page.getByRole("button", {name: "ביטול וחזרה לתיק"}).click();
    await confirmation.getByRole("button", {name: "יציאה ללא שמירה"}).click();

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({width, height: 900});
      await page.goto(`/advisor/clients/${client.id}/edit`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(page.getByRole("button", {name: "הבא"})).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  } finally {
    await request.delete(`http://localhost:3000/api/clients/${client.id}`, {headers: {authorization}});
  }
});
