import { z } from "zod";
import {
  ADDITIONAL_INCOME_TYPES,
  DEAL_TYPES,
  EMPLOYMENT_TYPES,
  MARITAL_STATUSES,
  PROPERTY_REGIONS,
  PROPERTY_TYPES
} from "./clientFields.js";

const requiredText = (message: string, maximum: number) => z.string({error: message}).trim().min(1, message).max(maximum, "הערך ארוך מדי");
const requiredNumber = (message: string, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({error: message}).finite(message).nonnegative("יש להזין מספר שאינו שלילי").max(maximum, "הסכום חורג מהטווח המותר")
);
const requiredInteger = (message: string, minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number({error: message}).int("יש להזין מספר שלם").min(minimum, message).max(maximum, "המספר חורג מהטווח המותר")
);

export const clientInputSchema = z.object({
  firstName: requiredText("יש להזין שם פרטי", 100),
  lastName: requiredText("יש להזין שם משפחה", 100),
  identityNumber: z.string({error: "יש להזין מספר תעודת זהות"}).trim().regex(/^\d{9}$/, "יש להזין 9 ספרות ללא מקפים"),
  birthDate: z.string({error: "יש להזין תאריך לידה"}).date("יש להזין תאריך לידה תקין"),
  phone: requiredText("יש להזין מספר טלפון", 30).min(7, "יש להזין מספר טלפון תקין"),
  email: z.string({error: "יש להזין כתובת דוא״ל"}).trim().email("יש להזין כתובת דוא״ל תקינה").max(320),
  address: requiredText("יש להזין כתובת מגורים", 300),
  maritalStatus: z.enum(MARITAL_STATUSES, {error: "יש לבחור מצב משפחתי"}),
  numberOfChildren: requiredInteger("יש להזין את מספר הילדים", 0, 20),
  childrenAges: z.array(z.coerce.number().int("יש להזין גיל שלם").min(0, "גיל ילד אינו יכול להיות שלילי").max(120, "יש להזין גיל ילד תקין"), {error: "יש להזין גיל עבור כל ילד"}),
  borrowerCount: requiredInteger("יש להזין את מספר הלווים", 1, 5),
  employmentType: z.enum(EMPLOYMENT_TYPES, {error: "יש לבחור סוג תעסוקה"}),
  employerName: requiredText("יש להזין שם מעסיק או עסק", 200),
  jobTitle: requiredText("יש להזין תפקיד", 150),
  employmentSeniorityYears: requiredInteger("יש להזין ותק בשנים", 0, 70),
  monthlyNetIncome: requiredNumber("יש להזין הכנסה חודשית נטו", 10_000_000),
  hasAdditionalIncome: z.boolean({error: "יש לבחור האם קיימת הכנסה נוספת"}),
  additionalIncomeType: z.enum(ADDITIONAL_INCOME_TYPES, {error: "יש לבחור סוג הכנסה נוספת"}).nullable(),
  additionalIncomeAmount: requiredNumber("יש להזין סכום הכנסה נוספת", 10_000_000),
  additionalIncomeDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable(),
  monthlyLiabilities: requiredNumber("יש להזין התחייבויות חודשיות", 10_000_000),
  existingMortgageBalance: requiredNumber("יש להזין יתרת משכנתה קיימת", 100_000_000),
  existingMortgageMonthlyPayment: requiredNumber("יש להזין החזר משכנתה חודשי", 10_000_000),
  dealType: z.enum(DEAL_TYPES, {error: "יש לבחור סוג עסקה"}),
  propertyType: z.enum(PROPERTY_TYPES, {error: "יש לבחור סוג נכס"}),
  propertyTypeOtherDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable(),
  propertyCity: requiredText("יש להזין את עיר הנכס", 100),
  propertyRegion: z.enum(PROPERTY_REGIONS, {error: "יש לבחור אזור"}),
  propertyAddress: requiredText("יש להזין כתובת נכס", 300),
  propertyValue: requiredNumber("יש להזין שווי נכס", 100_000_000).pipe(z.number().positive("שווי הנכס חייב להיות גדול מאפס")),
  requestedAmount: requiredNumber("יש להזין סכום מימון מבוקש", 100_000_000).pipe(z.number().positive("סכום המימון חייב להיות גדול מאפס")),
  requestedTermMonths: requiredInteger("יש להזין תקופת הלוואה בחודשים", 1, 600),
  notes: requiredText("יש להזין הערות מקצועיות", 2000),
  status: z.literal("ACTIVE").optional().default("ACTIVE")
}).strict().superRefine((input, context) => {
  if (input.childrenAges.length !== input.numberOfChildren) {
    context.addIssue({code: "custom", path: ["childrenAges"], message: "יש להזין גיל עבור כל ילד"});
  }
  if (!input.hasAdditionalIncome && (input.additionalIncomeType !== null || input.additionalIncomeAmount !== 0 || input.additionalIncomeDescription !== null)) {
    context.addIssue({code: "custom", path: ["hasAdditionalIncome"], message: "כאשר אין הכנסה נוספת יש להשאיר את הפרטים הנוספים ריקים"});
  }
  if (input.hasAdditionalIncome && !input.additionalIncomeType) {
    context.addIssue({code: "custom", path: ["additionalIncomeType"], message: "יש לבחור סוג הכנסה נוספת"});
  }
  if (input.hasAdditionalIncome && input.additionalIncomeAmount <= 0) {
    context.addIssue({code: "custom", path: ["additionalIncomeAmount"], message: "יש להזין סכום הכנסה נוספת גדול מאפס"});
  }
  if (input.additionalIncomeType === "OTHER" && !input.additionalIncomeDescription?.trim()) {
    context.addIssue({code: "custom", path: ["additionalIncomeDescription"], message: "יש לתאר את ההכנסה הנוספת"});
  }
  if (input.propertyType === "OTHER" && !input.propertyTypeOtherDescription?.trim()) {
    context.addIssue({code: "custom", path: ["propertyTypeOtherDescription"], message: "יש לתאר את סוג הנכס"});
  }
});

export type ClientInput = z.infer<typeof clientInputSchema>;
