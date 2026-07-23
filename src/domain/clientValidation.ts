import { z } from "zod";
import {
  ADDITIONAL_INCOME_TYPES,
  BORROWER_RELATIONSHIPS,
  DEAL_TYPES,
  EMPLOYMENT_TYPES,
  MARITAL_STATUSES,
  MAX_BORROWERS,
  PROPERTY_REGIONS,
  PROPERTY_TYPES
} from "./clientFields.js";
import { validateAdultBirthDate } from "../utils/age.js";

const requiredText = (message: string, maximum: number) => z.string({error: message}).trim().min(1, message).max(maximum, "הערך ארוך מדי");
const requiredNumber = (message: string, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({error: message}).finite(message).nonnegative("יש להזין מספר שאינו שלילי").max(maximum, "הסכום חורג מהטווח המותר")
);
const requiredInteger = (message: string, minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({error: message}).int("יש להזין מספר שלם").min(minimum, message).max(maximum, "המספר חורג מהטווח המותר")
);
const childrenSchema = z.object({
  numberOfChildren: requiredInteger("יש להזין את מספר הילדים", 0, 20),
  childrenAges: z.array(z.coerce.number().int("יש להזין גיל שלם").min(0, "גיל ילד אינו יכול להיות שלילי").max(120, "יש להזין גיל ילד תקין"), {error: "יש להזין גיל עבור כל ילד"})
}).strict().superRefine((input, context) => {
  if (input.childrenAges.length !== input.numberOfChildren) {
    context.addIssue({code: "custom", path: ["childrenAges"], message: "יש להזין גיל עבור כל ילד"});
  }
});

const borrowerSchema = z.object({
  order: requiredInteger("יש להזין סדר לווה תקין", 1, MAX_BORROWERS),
  isPrimary: z.boolean({error: "יש לציין לווה ראשי"}),
  firstName: requiredText("יש להזין שם פרטי", 100),
  lastName: requiredText("יש להזין שם משפחה", 100),
  identityNumber: z.string({error: "יש להזין מספר תעודת זהות"}).trim().regex(/^\d{9}$/, "יש להזין 9 ספרות ללא מקפים"),
  dateOfBirth: z.string({error: "יש להזין תאריך לידה"}).date("יש להזין תאריך לידה תקין"),
  phone: requiredText("יש להזין מספר טלפון", 30).min(7, "יש להזין מספר טלפון תקין"),
  email: z.string({error: "יש להזין כתובת דוא״ל"}).trim().email("יש להזין כתובת דוא״ל תקינה").max(320),
  address: requiredText("יש להזין כתובת מגורים", 300),
  maritalStatus: z.enum(MARITAL_STATUSES, {error: "יש לבחור מצב משפחתי"}),
  children: childrenSchema,
  employment: z.object({
    employmentType: z.enum(EMPLOYMENT_TYPES, {error: "יש לבחור סוג תעסוקה"}),
    employerName: requiredText("יש להזין שם מעסיק או עסק", 200),
    jobTitle: requiredText("יש להזין תפקיד", 150),
    employmentSeniorityYears: requiredInteger("יש להזין ותק בשנים", 0, 70)
  }).strict(),
  income: z.object({
    monthlyNetIncome: requiredNumber("יש להזין הכנסה חודשית נטו", 10_000_000),
    hasAdditionalIncome: z.boolean({error: "יש לבחור האם קיימת הכנסה נוספת"}),
    additionalIncomeType: z.enum(ADDITIONAL_INCOME_TYPES, {error: "יש לבחור סוג הכנסה נוספת"}).nullable(),
    additionalIncomeAmount: requiredNumber("יש להזין סכום הכנסה נוספת", 10_000_000),
    additionalIncomeDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable()
  }).strict(),
  liabilities: z.object({
    monthlyLiabilities: requiredNumber("יש להזין התחייבויות חודשיות", 10_000_000),
    existingMortgageBalance: requiredNumber("יש להזין יתרת משכנתה קיימת", 100_000_000),
    existingMortgageMonthlyPayment: requiredNumber("יש להזין החזר משכנתה חודשי", 10_000_000)
  }).strict()
}).strict().superRefine((input, context) => {
  const birthDateError = validateAdultBirthDate(input.dateOfBirth);
  if (birthDateError) context.addIssue({code: "custom", path: ["dateOfBirth"], message: birthDateError});
  if (!input.income.hasAdditionalIncome && (input.income.additionalIncomeType !== null || input.income.additionalIncomeAmount !== 0 || input.income.additionalIncomeDescription !== null)) {
    context.addIssue({code: "custom", path: ["income", "hasAdditionalIncome"], message: "כאשר אין הכנסה נוספת יש להשאיר את הפרטים הנוספים ריקים"});
  }
  if (input.income.hasAdditionalIncome && !input.income.additionalIncomeType) {
    context.addIssue({code: "custom", path: ["income", "additionalIncomeType"], message: "יש לבחור סוג הכנסה נוספת"});
  }
  if (input.income.hasAdditionalIncome && input.income.additionalIncomeAmount <= 0) {
    context.addIssue({code: "custom", path: ["income", "additionalIncomeAmount"], message: "יש להזין סכום הכנסה נוספת גדול מאפס"});
  }
  if (input.income.additionalIncomeType === "OTHER" && !input.income.additionalIncomeDescription?.trim()) {
    context.addIssue({code: "custom", path: ["income", "additionalIncomeDescription"], message: "יש לתאר את ההכנסה הנוספת"});
  }
});

export const clientInputSchema = z.object({
  numberOfBorrowers: requiredInteger("יש להזין את מספר הלווים", 1, MAX_BORROWERS),
  borrowerRelationship: z.enum(BORROWER_RELATIONSHIPS, {error: "יש לבחור את הקשר בין הלווים"}).nullable(),
  borrowerRelationshipOther: z.string().trim().max(300, "התיאור ארוך מדי").nullable(),
  household: childrenSchema,
  borrowers: z.array(borrowerSchema).min(1, "יש להזין לפחות לווה אחד").max(MAX_BORROWERS, `ניתן להזין עד ${MAX_BORROWERS} לווים`),
  property: z.object({
    propertyType: z.enum(PROPERTY_TYPES, {error: "יש לבחור סוג נכס"}),
    propertyTypeOtherDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable(),
    city: requiredText("יש להזין את עיר הנכס", 100),
    region: z.enum(PROPERTY_REGIONS, {error: "יש לבחור אזור"}),
    address: requiredText("יש להזין כתובת נכס", 300),
    value: requiredNumber("יש להזין שווי נכס", 100_000_000).pipe(z.number().positive("שווי הנכס חייב להיות גדול מאפס"))
  }).strict(),
  loanRequest: z.object({
    dealType: z.enum(DEAL_TYPES, {error: "יש לבחור סוג עסקה"}),
    requestedAmount: requiredNumber("יש להזין סכום מימון מבוקש", 100_000_000).pipe(z.number().positive("סכום המימון חייב להיות גדול מאפס")),
    requestedTermMonths: requiredInteger("יש להזין תקופת הלוואה בחודשים", 1, 600)
  }).strict(),
  notes: requiredText("יש להזין הערות מקצועיות", 2000),
  status: z.literal("ACTIVE").optional().default("ACTIVE")
}).strict().superRefine((input, context) => {
  if (input.borrowers.length !== input.numberOfBorrowers) {
    context.addIssue({code: "custom", path: ["borrowers"], message: "מספר הלווים אינו תואם לפרטים שהוזנו"});
  }
  if (input.numberOfBorrowers === 1 && input.borrowerRelationship !== null) {
    context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "אין לבחור קשר בתיק עם לווה יחיד"});
  }
  if (input.numberOfBorrowers > 1 && !input.borrowerRelationship) {
    context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "יש לבחור את הקשר בין הלווים"});
  }
  if (input.borrowerRelationship === "OTHER" && !input.borrowerRelationshipOther?.trim()) {
    context.addIssue({code: "custom", path: ["borrowerRelationshipOther"], message: "יש לתאר את הקשר בין הלווים"});
  }
  const sharedHousehold = input.borrowerRelationship === "MARRIED" || input.borrowerRelationship === "COMMON_LAW";
  if (sharedHousehold) {
    input.borrowers.forEach((borrower, index) => {
      if (borrower.children.numberOfChildren !== 0 || borrower.children.childrenAges.length !== 0) {
        context.addIssue({code: "custom", path: ["borrowers", index, "children"], message: "בתיק זוגי פרטי הילדים נשמרים פעם אחת ברמת משק הבית"});
      }
    });
  } else if (input.household.numberOfChildren !== 0 || input.household.childrenAges.length !== 0) {
    context.addIssue({code: "custom", path: ["household"], message: "פרטי משק בית משותף מותרים רק לבני זוג"});
  }
  const identities = new Set<string>();
  input.borrowers.forEach((borrower, index) => {
    if (borrower.order !== index + 1) context.addIssue({code: "custom", path: ["borrowers", index, "order"], message: "סדר הלווים אינו תקין"});
    if (borrower.isPrimary !== (index === 0)) context.addIssue({code: "custom", path: ["borrowers", index, "isPrimary"], message: index === 0 ? "הלווה הראשון חייב להיות הלווה הראשי" : "רק הלווה הראשון יכול להיות הלווה הראשי"});
    const normalized = borrower.identityNumber.replace(/\D/g, "");
    if (identities.has(normalized)) {
      context.addIssue({code: "custom", path: ["borrowers", index, "identityNumber"], message: "מספר תעודת הזהות כבר קיים בתיק"});
    }
    identities.add(normalized);
  });
  if (input.property.propertyType === "OTHER" && !input.property.propertyTypeOtherDescription?.trim()) {
    context.addIssue({code: "custom", path: ["property", "propertyTypeOtherDescription"], message: "יש לתאר את סוג הנכס"});
  }
});

export type ClientInput = z.infer<typeof clientInputSchema>;
export type BorrowerInput = ClientInput["borrowers"][number];
