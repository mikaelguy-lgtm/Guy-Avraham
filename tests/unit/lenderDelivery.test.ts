import {describe, expect, it} from "vitest";
import type {FullCaseSnapshot} from "../../src/domain/lenderDelivery";
import {CaseRedactionService} from "../../src/services/caseRedaction";
import {residenceCityFromAddress} from "../../src/utils/address";
import {DeliveryTokenService} from "../../src/services/deliveryTokens";
import {IsraelBusinessCalendarService, israelDateKey} from "../../src/services/israelBusinessCalendar";
import {collectDeliveryBlockers} from "../../src/domain/deliveryPreflight";

const localParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

describe("IsraelBusinessCalendarService", () => {
  it("recognizes Sunday through Thursday and excludes Friday and Saturday", () => {
    const calendar = new IsraelBusinessCalendarService();
    expect(calendar.isIsraeliBusinessDay("2026-07-26")).toBe(true);
    expect(calendar.isIsraeliBusinessDay("2026-07-30")).toBe(true);
    expect(calendar.isIsraeliBusinessDay("2026-07-31")).toBe(false);
    expect(calendar.isIsraeliBusinessDay("2026-08-01")).toBe(false);
  });

  it("honors holidays and forced working day overrides", () => {
    const calendar = new IsraelBusinessCalendarService([
      {date: "2026-07-27", type: "HOLIDAY", title: "חג בדיקה", source: "בדיקה"},
      {date: "2026-08-01", type: "FORCED_WORKING_DAY", title: "יום עבודה", source: "בדיקה"}
    ]);
    expect(calendar.isIsraeliBusinessDay("2026-07-27")).toBe(false);
    expect(calendar.isIsraeliBusinessDay("2026-08-01")).toBe(true);
  });

  it.each([
    ["2026-07-26T09:00:00+03:00", "2026-07-28"],
    ["2026-07-30T09:00:00+03:00", "2026-08-03"],
    ["2026-07-31T09:00:00+03:00", "2026-08-03"]
  ])("calculates a two-business-day deadline for %s", (sentAt, expectedDate) => {
    const deadline = new IsraelBusinessCalendarService().calculateResponseDeadline(new Date(sentAt));
    expect(israelDateKey(deadline)).toBe(expectedDate);
    expect(localParts(deadline)).toEqual(expect.objectContaining({hour: "18", minute: "00"}));
  });

  it("skips a holiday between sending and the deadline", () => {
    const deadline = new IsraelBusinessCalendarService([{date: "2026-07-27", type: "NON_WORKING_DAY", title: "שבתון", source: "בדיקה"}]).calculateResponseDeadline(new Date("2026-07-26T09:00:00+03:00"));
    expect(israelDateKey(deadline)).toBe("2026-07-29");
  });

  it("keeps 18:00 local through daylight-saving transitions and schedules a single 09:00 reminder", () => {
    const calendar = new IsraelBusinessCalendarService();
    const deadline = calendar.calculateResponseDeadline(new Date("2026-10-22T09:00:00+03:00"));
    expect(localParts(deadline).hour).toBe("18");
    const reminder = calendar.calculateReminderSchedule(new Date(), deadline);
    expect(localParts(reminder)).toEqual(expect.objectContaining({hour: "09", minute: "00"}));
    expect(israelDateKey(reminder)).toBe(israelDateKey(deadline));
  });
});

const fullSnapshot: FullCaseSnapshot = {
  publicCaseNumber: "SC-SECURE", sourceClientUpdatedAt: "2026-07-27T00:00:00.000Z", numberOfBorrowers: 2, borrowerRelationship: "MARRIED", household: {numberOfChildren: 2, childrenAges: [4, 8]},
  borrowers: [
    {order: 1, firstName: "דנה", lastName: "לוי", identityNumber: "123456789", dateOfBirth: "1985-06-15", age: 41, phone: "0501234567", email: "dana@example.com", address: "רחוב סודי 1, תל אביב", city: "תל אביב", streetAddress: "רחוב סודי 1", residenceCity: "תל אביב", housingStatus: "OWNED", housingStatusOther: null, maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8], employment: {employmentType: "SALARIED", employerName: "חברה סודית בע״מ", jobTitle: "מנהלת", employmentSeniorityYears: 6, monthlyNetIncome: 20_000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 2_500, additionalIncomeDescription: "דירה של דנה", additionalIncomes: [{type: "RENTAL_INCOME", monthlyAmount: 2_500, description: "דירה של דנה"}], selfEmployed: null}, liabilities: [{scope: "BORROWER", borrowerOrder: 1, type: "LOAN", otherTypeDescription: null, financialInstitution: "בנק לדוגמה", currentBalance: 100_000, monthlyPayment: 1_500, endDate: "2030-01-01", notes: "הלוואה של דנה 0501234567"}]},
    {order: 2, firstName: "נועם", lastName: "לוי", identityNumber: "987654321", dateOfBirth: "1987-08-20", age: 38, phone: "0507654321", email: "noam@example.com", address: "רחוב סודי 1, תל אביב", city: "תל אביב", streetAddress: "רחוב סודי 1", residenceCity: "תל אביב", housingStatus: "OWNED", housingStatusOther: null, maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8], employment: {employmentType: "SELF_EMPLOYED", employerName: "", jobTitle: "", employmentSeniorityYears: 0, monthlyNetIncome: 15_000, hasAdditionalIncome: false, additionalIncomeType: null, additionalIncomeAmount: 0, additionalIncomeDescription: null, selfEmployed: {businessType: "עסק נועם", businessStartYear: 2018, lastAssessedIncome: 180_000, assessmentYear: 2025, accountantIncomePreviousYear: 170_000, accountantIncomeCurrentYear: 190_000, accountantMonthsCount: 12}}, liabilities: []}
  ],
  householdLiabilities: [], property: {propertyType: "APARTMENT", propertyTypeOtherDescription: null, city: "תל אביב", address: "רחוב הנכס 9, תל אביב", value: 2_000_000}, loanRequest: {purpose: "SECOND_HAND_PURCHASE", purposeOther: null, requestedAmount: 1_250_000, requestedTermMonths: 240, loanToValue: 62.5}, dealDetails: "דנה לוי מבקשת מימון. dana@example.com, 123456789, רחוב הנכס 9, תל אביב, חברה סודית בע״מ", totals: {monthlyIncome: 37_500, liabilityBalance: 100_000, monthlyPayments: 1_500}, advisor: {fullName: "יועץ פרטי", businessName: "ייעוץ פרטי", phone: "0500000000", email: "advisor@example.com", website: null}, documents: [], creditIndication: null
};

describe("CaseRedactionService", () => {
  it("removes borrower, employer, contact, address and advisor PII from every masked field", () => {
    const result = new CaseRedactionService().redact(fullSnapshot);
    const serialized = JSON.stringify(result.maskedSnapshot);
    for (const prohibited of ["דנה", "נועם", "לוי", "123456789", "987654321", "0501234567", "dana@example.com", "רחוב סודי", "רחוב הנכס", "חברה סודית", "עסק נועם", "יועץ פרטי"]) expect(serialized).not.toContain(prohibited);
    expect(serialized).toContain("לווה 1");
    expect(serialized).toContain("SALARIED");
    expect(serialized).toContain("1250000");
    expect(result.redactionReport.categories).toEqual(expect.arrayContaining(["FULL_NAME", "IDENTITY_NUMBER", "EMPLOYER", "ADVISOR_DETAILS"]));
    expect(JSON.stringify(result.redactionReport)).not.toContain("123456789");
  });

  it("passes credit indication through to the masked/initial snapshot unchanged (not PII)", () => {
    const withCreditIndication: FullCaseSnapshot = {
      ...fullSnapshot,
      creditIndication: {bouncedChecks: true, bouncedChecksCount: 5, bouncedDirectDebits: true, bouncedDirectDebitsCount: 3, collectionProceedings: false, bankruptcy: false, liens: false, mortgageArrears: false}
    };
    const {maskedSnapshot} = new CaseRedactionService().redact(withCreditIndication);
    expect(maskedSnapshot.creditIndication).toEqual(withCreditIndication.creditIndication);
  });

  it("keeps credit indication null when the client has no recorded indication", () => {
    const {maskedSnapshot} = new CaseRedactionService().redact(fullSnapshot);
    expect(maskedSnapshot.creditIndication).toBeNull();
  });

  it("never exposes a full home address as the residence city", () => {
    const unsafe = structuredClone(fullSnapshot);
    unsafe.borrowers[0].address = "כתובת בדיקה זמנית";
    unsafe.borrowers[0].residenceCity = "כתובת בדיקה זמנית";
    const serialized = JSON.stringify(new CaseRedactionService().redact(unsafe).maskedSnapshot);

    expect(serialized).not.toContain("כתובת בדיקה זמנית");
    expect(residenceCityFromAddress("כתובת בדיקה זמנית")).toBe("");
    expect(residenceCityFromAddress("רחוב הרצל 1, תל אביב")).toBe("תל אביב");
    expect(residenceCityFromAddress("רחוב הרצל 1, תל אביב 61000")).toBe("");
  });

  it("never self-redacts the residence city it intentionally discloses, even though it equals the borrower's own city field", () => {
    const withCity = structuredClone(fullSnapshot);
    withCity.borrowers[0].city = "תל אביב"; withCity.borrowers[0].residenceCity = "תל אביב";
    withCity.borrowers[1].city = "תל אביב"; withCity.borrowers[1].residenceCity = "תל אביב";
    const masked = new CaseRedactionService().redact(withCity).maskedSnapshot;
    expect(masked.borrowers.every((borrower) => borrower.residenceCity === "תל אביב")).toBe(true);
  });
});

describe("delivery preflight", () => {
  const collect = collectDeliveryBlockers;

  it("returns every missing required document in one response", () => {
    const blockers = collect(fullSnapshot);
    expect(blockers.filter((item) => item.category === "DOCUMENT")).toHaveLength(9);
    expect(blockers.map((item) => item.label)).toEqual(expect.arrayContaining([expect.stringContaining("תעודת זהות — צד אחורי"), expect.stringContaining("כתב הסמכה")]));
  });

  it("returns field blockers together instead of failing on the first field", () => {
    const snapshot = structuredClone(fullSnapshot);
    snapshot.dealDetails = "";
    snapshot.borrowers[0].employment.employerName = "";
    const blockers = collect(snapshot);
    expect(blockers.map((item) => item.code)).toEqual(expect.arrayContaining(["DEAL_DETAILS_REQUIRED", "BORROWER_1_EMPLOYER"]));
  });

  it("does not block delivery on a blank property address", () => {
    const snapshot = structuredClone(fullSnapshot);
    snapshot.property.address = "";
    expect(collect(snapshot).map((item) => item.code)).not.toContain("PROPERTY_ADDRESS_REQUIRED");
    snapshot.property.address = null;
    expect(collect(snapshot).map((item) => item.code)).not.toContain("PROPERTY_ADDRESS_REQUIRED");
  });

  it("allows a complete case with all required documents", () => {
    const snapshot = structuredClone(fullSnapshot);
    const documents: FullCaseSnapshot["documents"] = [];
    for (const borrower of snapshot.borrowers) for (const [index, documentType] of ["ID_FRONT", "ID_BACK", "ID_APPENDIX", "CREDIT_DATA_REPORT"].entries()) documents.push({documentId: borrower.order * 10 + index, borrowerId: borrower.order, borrowerOrder: borrower.order, documentType, customTitle: null, mimeType: "application/pdf", sizeBytes: 100, checksumSha256: "a".repeat(64), storageKey: `${borrower.order}-${documentType}`, createdAt: "2026-07-27T00:00:00.000Z"});
    for (const [index, documentType] of ["PROPERTY_RIGHTS", "POWER_OF_ATTORNEY"].entries()) documents.push({documentId: 100 + index, borrowerId: null, borrowerOrder: null, documentType, customTitle: null, mimeType: "application/pdf", sizeBytes: 100, checksumSha256: "b".repeat(64), storageKey: documentType, createdAt: "2026-07-27T00:00:00.000Z"});
    snapshot.documents = documents;
    expect(collect(snapshot)).toEqual([]);
  });
});

describe("DeliveryTokenService", () => {
  const service = new DeliveryTokenService(Buffer.alloc(32, 7));
  it("derives unique personal tokens and stores/verifies only hashes", () => {
    const first = service.deriveToken("review", "invitation-a", service.createNonce());
    const second = service.deriveToken("review", "invitation-b", service.createNonce());
    expect(first).not.toBe(second);
    expect(service.verifyHash(first, service.hash(first))).toBe(true);
    expect(service.verifyHash("wrong", service.hash(first))).toBe(false);
    expect(service.hash(first)).not.toContain(first);
  });

  it("derives six-digit OTP values and rejects changed preview confirmations", () => {
    expect(service.deriveOtp("INTEREST_DECISION", "submission:contact", "nonce")).toMatch(/^\d{6}$/);
    const signed = service.signPreview(JSON.stringify({clientId: 1, companies: [2]}));
    expect(service.verifyPreview(signed)).toContain("clientId");
    expect(service.verifyPreview(`${signed}changed`)).toBeNull();
  });
});
