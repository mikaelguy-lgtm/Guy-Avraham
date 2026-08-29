import { z } from "zod";
import {
  ADDITIONAL_INCOME_TYPES,
  BORROWER_RELATIONSHIPS,
  DEAL_TYPES,
  EMPLOYMENT_TYPES,
  LIABILITY_TYPES,
  MARITAL_STATUSES,
  MAX_BORROWERS,
  PROPERTY_TYPES,
  SELECTABLE_EMPLOYMENT_TYPES,
  SELECTABLE_MARITAL_STATUSES,
  currentIsraelYear
} from "./clientFields.js";
import { validateAdultBirthDate } from "../utils/age.js";

const requiredText = (message: string, maximum: number) => z.string({error: message}).trim().min(1, message).max(maximum, "הערך ארוך מדי");
const requiredNumber = (message: string, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value) ? Number.NaN : value,
  z.coerce.number({error: message}).finite(message).nonnegative("יש להזין מספר שאינו שלילי").max(maximum, "הסכום חורג מהטווח המותר")
);
const requiredInteger = (message: string, minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : typeof value === "string" && !/^\d+$/.test(value) ? Number.NaN : value,
  z.coerce.number({error: message}).int("יש להזין מספר שלם").min(minimum, message).max(maximum, "המספר חורג מהטווח המותר")
);

const canonicalizeMarriedBorrowers = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (input.borrowerRelationship !== "MARRIED" || !Array.isArray(input.borrowers)) return value;
  const primary = input.borrowers[0];
  const primaryRecord = primary && typeof primary === "object" ? (primary as Record<string, unknown>) : undefined;
  const primaryCity = primaryRecord?.city;
  const primaryStreetAddress = primaryRecord?.streetAddress;
  return {
    ...input,
    borrowers: input.borrowers.map((borrower, index) => borrower && typeof borrower === "object" ? {
      ...(borrower as Record<string, unknown>),
      maritalStatus: "MARRIED",
      city: index === 0 ? (borrower as Record<string, unknown>).city : primaryCity,
      streetAddress: index === 0 ? (borrower as Record<string, unknown>).streetAddress : primaryStreetAddress
    } : borrower)
  };
};

const childrenSchema = z.object({
  numberOfChildren: requiredInteger("יש להזין את מספר הילדים", 0, 20),
  childrenAges: z.array(requiredInteger("יש להזין גיל ילד תקין", 0, 120), {error: "יש להזין גיל עבור כל ילד"})
}).strict().superRefine((input, context) => {
  if (input.childrenAges.length !== input.numberOfChildren) context.addIssue({code: "custom", path: ["childrenAges"], message: "יש להזין גיל עבור כל ילד"});
});

const optionalNumber = (message: string, maximum: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value) ? Number.NaN : value,
  z.coerce.number({error: message}).finite(message).nonnegative("יש להזין מספר שאינו שלילי").max(maximum, "הסכום חורג מהטווח המותר").nullable()
);

export const liabilityInputSchema = z.object({
  type: z.enum(LIABILITY_TYPES, {error: "יש לבחור סוג התחייבות"}),
  otherTypeDescription: z.string().trim().max(300, "שם הגוף ארוך מדי").nullable(),
  financialInstitution: z.string().trim().max(300, "שם הגוף הפיננסי ארוך מדי").nullable(),
  currentBalance: optionalNumber("יש להזין יתרה נוכחית", 100_000_000),
  monthlyPayment: requiredNumber("יש להזין החזר חודשי", 10_000_000),
  endDate: z.string({error: "יש להזין תאריך סיום התחייבות"}).date("יש להזין תאריך סיום תקין"),
  notes: requiredText("יש להזין הערות להתחייבות", 1000)
}).strict().superRefine((input, context) => {
  if (input.type === "OTHER_FINANCIAL_ENTITY" && !input.otherTypeDescription?.trim()) {
    context.addIssue({code: "custom", path: ["otherTypeDescription"], message: "יש להזין את שם הגוף או סוג ההתחייבות"});
  }
  const requiresBalance = input.type !== "ALIMONY" && input.type !== "RENT";
  const requiresInstitution = input.type === "LOAN" || input.type === "MORTGAGE";
  if (requiresBalance && input.currentBalance === null) context.addIssue({code: "custom", path: ["currentBalance"], message: "יש להזין יתרה נוכחית"});
  if (!requiresBalance && input.currentBalance !== null) context.addIssue({code: "custom", path: ["currentBalance"], message: "אין להזין יתרה נוכחית עבור הוצאה חודשית"});
  if (requiresInstitution && !input.financialInstitution?.trim()) context.addIssue({code: "custom", path: ["financialInstitution"], message: "יש להזין את הגוף הפיננסי"});
  if (!requiresInstitution && input.financialInstitution !== null) context.addIssue({code: "custom", path: ["financialInstitution"], message: "הגוף הפיננסי אינו רלוונטי לסוג התחייבות זה"});
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(`${input.endDate}T00:00:00`);
  if (!Number.isNaN(endDate.getTime()) && endDate < today) {
    context.addIssue({code: "custom", path: ["endDate"], message: "תאריך סיום ההתחייבות אינו יכול להיות בעבר"});
  }
});

const additionalIncomeSchema = z.object({
  type: z.enum(ADDITIONAL_INCOME_TYPES, {error: "יש לבחור סוג הכנסה נוספת"}),
  monthlyAmount: requiredNumber("יש להזין סכום הכנסה נוספת", 10_000_000),
  description: z.string().trim().max(500, "התיאור ארוך מדי").nullable()
}).strict().superRefine((input, context) => {
  if (input.type === "OTHER" && !input.description?.trim()) context.addIssue({code: "custom", path: ["description"], message: "יש לתאר את ההכנסה הנוספת"});
});

const normalizeIncome = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (Array.isArray(input.additionalIncomes)) return input;
  const hasAdditionalIncome = input.hasAdditionalIncome === true;
  return {
    ...input,
    additionalIncomes: hasAdditionalIncome && input.additionalIncomeType ? [{
      type: input.additionalIncomeType,
      monthlyAmount: input.additionalIncomeAmount,
      description: input.additionalIncomeDescription ?? null
    }] : []
  };
};

const incomeSchema = z.preprocess(normalizeIncome, z.object({
  monthlyNetIncome: requiredNumber("יש להזין הכנסה חודשית נטו", 10_000_000),
  additionalIncomes: z.array(additionalIncomeSchema).max(100, "מספר ההכנסות הנוספות חורג מהמותר"),
  hasAdditionalIncome: z.boolean().optional(),
  additionalIncomeType: z.enum(ADDITIONAL_INCOME_TYPES).nullable().optional(),
  additionalIncomeAmount: requiredNumber("יש להזין סכום הכנסה נוספת", 10_000_000).optional(),
  additionalIncomeDescription: z.string().trim().max(500).nullable().optional()
}).strict()).transform((input) => ({monthlyNetIncome: input.monthlyNetIncome, additionalIncomes: input.additionalIncomes}));

const selfEmployedSchema = z.object({
  businessType: requiredText("יש להזין סוג עיסוק", 200),
  businessStartYear: requiredInteger("יש להזין שנת פתיחת העסק", 1900, currentIsraelYear()),
  lastAssessedIncome: requiredNumber("יש להזין הכנסה משומה אחרונה", 100_000_000),
  assessmentYear: requiredInteger("יש להזין שנת שומה", 1900, currentIsraelYear()),
  accountantIncomePreviousYear: requiredNumber("יש להזין את אישור ההכנסות של רואה החשבון", 100_000_000),
  accountantIncomeCurrentYear: requiredNumber("יש להזין את הכנסות רואה החשבון לשנה הנוכחית", 100_000_000),
  accountantMonthsCount: requiredInteger("יש להזין למספר חודשים ההכנסה מתייחסת", 1, 12)
}).strict();

const employmentSchema = z.object({
  employmentType: z.enum(EMPLOYMENT_TYPES, {error: "יש לבחור סוג תעסוקה"}),
  employerName: z.string().trim().max(200, "הערך ארוך מדי"),
  jobTitle: z.string().trim().max(150, "הערך ארוך מדי"),
  employmentSeniorityYears: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? 0 : value,
    z.coerce.number().int("יש להזין מספר שלם").min(0, "יש להזין ותק בשנים").max(70, "המספר חורג מהטווח המותר")
  ),
  selfEmployed: selfEmployedSchema.nullable().optional()
}).strict().superRefine((input, context) => {
  const isSelfEmployed = input.employmentType === "SELF_EMPLOYED";
  if (isSelfEmployed && !input.selfEmployed) context.addIssue({code: "custom", path: ["selfEmployed"], message: "יש להזין את פרטי העסק העצמאי"});
  if (!isSelfEmployed && input.selfEmployed) context.addIssue({code: "custom", path: ["selfEmployed"], message: "פרטי עסק עצמאי אינם רלוונטיים לסוג תעסוקה זה"});
  if (!isSelfEmployed) {
    if (!input.employerName.trim()) context.addIssue({code: "custom", path: ["employerName"], message: "יש להזין שם מעסיק או עסק"});
    if (!input.jobTitle.trim()) context.addIssue({code: "custom", path: ["jobTitle"], message: "יש להזין תפקיד"});
  }
}).transform((input) => ({...input, employerName: input.employmentType === "SELF_EMPLOYED" ? "" : input.employerName, jobTitle: input.employmentType === "SELF_EMPLOYED" ? "" : input.jobTitle, employmentSeniorityYears: input.employmentType === "SELF_EMPLOYED" ? 0 : input.employmentSeniorityYears, selfEmployed: input.employmentType === "SELF_EMPLOYED" ? input.selfEmployed ?? null : null}));

const borrowerSchema = z.object({
  id: z.number().int().positive().optional(),
  order: requiredInteger("יש להזין סדר לווה תקין", 1, MAX_BORROWERS),
  isPrimary: z.boolean({error: "יש לציין לווה ראשי"}),
  firstName: requiredText("יש להזין שם פרטי", 100),
  lastName: requiredText("יש להזין שם משפחה", 100),
  identityNumber: z.string({error: "יש להזין מספר תעודת זהות"}).trim().regex(/^\d{9}$/, "יש להזין 9 ספרות ללא מקפים"),
  dateOfBirth: z.string({error: "יש להזין תאריך לידה"}).date("יש להזין תאריך לידה תקין"),
  phone: requiredText("יש להזין מספר טלפון", 30).min(7, "יש להזין מספר טלפון תקין"),
  email: z.string({error: "יש להזין כתובת דוא״ל"}).trim().email("יש להזין כתובת דוא״ל תקינה").max(320),
  city: requiredText("יש להזין עיר מגורים", 100),
  streetAddress: requiredText("יש להזין רחוב ומספר בית", 300),
  maritalStatus: z.enum(MARITAL_STATUSES, {error: "יש לבחור מצב משפחתי"}),
  children: childrenSchema,
  employment: employmentSchema,
  income: incomeSchema,
  liabilities: z.array(liabilityInputSchema).max(100, "מספר ההתחייבויות חורג מהמותר")
}).strict().superRefine((input, context) => {
  const birthDateError = validateAdultBirthDate(input.dateOfBirth);
  if (birthDateError) context.addIssue({code: "custom", path: ["dateOfBirth"], message: birthDateError});
});

const clientInputObjectSchema = z.object({
  numberOfBorrowers: requiredInteger("יש להזין את מספר הלווים", 1, MAX_BORROWERS),
  borrowerRelationship: z.enum(BORROWER_RELATIONSHIPS, {error: "יש לבחור את הקשר בין הלווים"}).nullable(),
  borrowerRelationshipOther: z.string().trim().max(300, "התיאור ארוך מדי").nullable(),
  household: childrenSchema,
  borrowers: z.array(borrowerSchema).min(1, "יש להזין לפחות לווה אחד").max(MAX_BORROWERS, `ניתן להזין עד ${MAX_BORROWERS} לווים`),
  householdLiabilities: z.array(liabilityInputSchema).max(100, "מספר ההתחייבויות חורג מהמותר"),
  property: z.object({
    propertyType: z.enum(PROPERTY_TYPES, {error: "יש לבחור סוג נכס"}),
    propertyTypeOtherDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable(),
    city: requiredText("יש להזין את עיר הנכס", 100),
    address: requiredText("יש להזין כתובת נכס", 300),
    value: requiredNumber("יש להזין שווי נכס", 100_000_000)
  }).strict(),
  loanPurpose: z.enum(DEAL_TYPES, {error: "יש לבחור מטרת הלוואה"}),
  loanRequest: z.object({
    requestedAmount: requiredNumber("יש להזין סכום מימון מבוקש", 100_000_000)
  }).strict(),
  dealDetails: requiredText("יש להזין פירוט עסקה", 5000),
  status: z.literal("ACTIVE").optional().default("ACTIVE")
}).strict().superRefine((input, context) => {
  if (input.borrowers.length !== input.numberOfBorrowers) context.addIssue({code: "custom", path: ["borrowers"], message: "מספר הלווים אינו תואם לפרטים שהוזנו"});
  if (input.numberOfBorrowers === 1 && input.borrowerRelationship !== null) context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "אין לבחור קשר בתיק עם לווה יחיד"});
  if (input.numberOfBorrowers > 1 && !input.borrowerRelationship) context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "יש לבחור את הקשר בין הלווים"});
  if (input.borrowerRelationship === "OTHER" && !input.borrowerRelationshipOther?.trim()) context.addIssue({code: "custom", path: ["borrowerRelationshipOther"], message: "יש לתאר את הקשר בין הלווים"});
  const sharedChildren = input.borrowerRelationship === "MARRIED" || input.borrowerRelationship === "COMMON_LAW";
  if (sharedChildren) input.borrowers.forEach((borrower, index) => {
    if (borrower.children.numberOfChildren !== 0 || borrower.children.childrenAges.length !== 0) context.addIssue({code: "custom", path: ["borrowers", index, "children"], message: "נתוני הילדים המשותפים נשמרים פעם אחת ברמת משק הבית"});
  });
  else if (input.household.numberOfChildren !== 0 || input.household.childrenAges.length !== 0) context.addIssue({code: "custom", path: ["household"], message: "נתוני משק בית משותף מותרים רק לזוג"});
  const identities = new Set<string>();
  input.borrowers.forEach((borrower, index) => {
    if (identities.has(borrower.identityNumber)) context.addIssue({code: "custom", path: ["borrowers", index, "identityNumber"], message: "מספר תעודת הזהות כבר קיים בתיק"});
    identities.add(borrower.identityNumber);
  });
  if (input.borrowers.filter((borrower) => borrower.isPrimary).length !== 1 || !input.borrowers[0]?.isPrimary) context.addIssue({code: "custom", path: ["borrowers"], message: "יש להגדיר לווה ראשי אחד בלבד"});
  if (input.borrowerRelationship === "MARRIED") {
    input.borrowers.forEach((borrower, index) => {
      if (borrower.liabilities.length) context.addIssue({code: "custom", path: ["borrowers", index, "liabilities"], message: "בתיק נשוי ההתחייבויות נשמרות פעם אחת ברמת משק הבית"});
    });
  } else if (input.householdLiabilities.length) context.addIssue({code: "custom", path: ["householdLiabilities"], message: "התחייבויות משותפות מותרות רק בתיק נשוי"});
});

export const clientInputSchema = z.preprocess(canonicalizeMarriedBorrowers, clientInputObjectSchema);

export const newClientInputSchema = clientInputSchema.superRefine((input, context) => {
  input.borrowers.forEach((borrower, index) => {
    if (!SELECTABLE_MARITAL_STATUSES.includes(borrower.maritalStatus as never)) context.addIssue({code: "custom", path: ["borrowers", index, "maritalStatus"], message: "מצב משפחתי זה זמין לתיקים היסטוריים בלבד"});
    if (!SELECTABLE_EMPLOYMENT_TYPES.includes(borrower.employment.employmentType as never)) context.addIssue({code: "custom", path: ["borrowers", index, "employment", "employmentType"], message: "סוג תעסוקה זה זמין לתיקים היסטוריים בלבד"});
  });
});

export type ClientInput = z.infer<typeof clientInputSchema>;

const personalBorrowerSchema = z.object({
  id: z.number().int().positive(),
  order: requiredInteger("יש להזין סדר לווה תקין", 1, MAX_BORROWERS),
  isPrimary: z.boolean({error: "יש לציין לווה ראשי"}),
  firstName: requiredText("יש להזין שם פרטי", 100),
  lastName: requiredText("יש להזין שם משפחה", 100),
  identityNumber: z.string({error: "יש להזין מספר תעודת זהות"}).trim().regex(/^\d{9}$/, "יש להזין 9 ספרות ללא מקפים"),
  dateOfBirth: z.string({error: "יש להזין תאריך לידה"}).date("יש להזין תאריך לידה תקין"),
  phone: requiredText("יש להזין מספר טלפון", 30).min(7, "יש להזין מספר טלפון תקין"),
  email: z.string({error: "יש להזין כתובת דוא״ל"}).trim().email("יש להזין כתובת דוא״ל תקינה").max(320),
  city: requiredText("יש להזין עיר מגורים", 100),
  streetAddress: requiredText("יש להזין רחוב ומספר בית", 300),
  maritalStatus: z.enum(MARITAL_STATUSES, {error: "יש לבחור מצב משפחתי"}),
  children: childrenSchema
}).strict().superRefine((input, context) => {
  const birthDateError = validateAdultBirthDate(input.dateOfBirth);
  if (birthDateError) context.addIssue({code: "custom", path: ["dateOfBirth"], message: birthDateError});
});

const clientPersonalInputObjectSchema = z.object({
  numberOfBorrowers: requiredInteger("יש להזין את מספר הלווים", 1, MAX_BORROWERS),
  borrowerRelationship: z.enum(BORROWER_RELATIONSHIPS, {error: "יש לבחור את הקשר בין הלווים"}).nullable(),
  borrowerRelationshipOther: z.string().trim().max(300, "התיאור ארוך מדי").nullable(),
  household: childrenSchema,
  borrowers: z.array(personalBorrowerSchema).min(1).max(MAX_BORROWERS)
}).strict().superRefine((input, context) => {
  if (input.borrowers.length !== input.numberOfBorrowers) context.addIssue({code: "custom", path: ["borrowers"], message: "מספר הלווים אינו תואם לפרטים שהוזנו"});
  if (input.numberOfBorrowers === 1 && input.borrowerRelationship !== null) context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "אין לבחור קשר בתיק עם לווה יחיד"});
  if (input.numberOfBorrowers > 1 && !input.borrowerRelationship) context.addIssue({code: "custom", path: ["borrowerRelationship"], message: "יש לבחור את הקשר בין הלווים"});
  if (input.borrowerRelationship === "OTHER" && !input.borrowerRelationshipOther?.trim()) context.addIssue({code: "custom", path: ["borrowerRelationshipOther"], message: "יש לתאר את הקשר בין הלווים"});
  const sharedChildren = input.borrowerRelationship === "MARRIED" || input.borrowerRelationship === "COMMON_LAW";
  input.borrowers.forEach((borrower, index) => {
    if (sharedChildren && (borrower.children.numberOfChildren !== 0 || borrower.children.childrenAges.length !== 0)) context.addIssue({code: "custom", path: ["borrowers", index, "children"], message: "נתוני הילדים המשותפים נשמרים ברמת משק הבית"});
  });
  if (!sharedChildren && (input.household.numberOfChildren !== 0 || input.household.childrenAges.length !== 0)) context.addIssue({code: "custom", path: ["household"], message: "נתוני משק בית משותף מותרים רק לזוג"});
  const identities = new Set<string>();
  input.borrowers.forEach((borrower, index) => {
    if (identities.has(borrower.identityNumber)) context.addIssue({code: "custom", path: ["borrowers", index, "identityNumber"], message: "מספר תעודת הזהות כבר קיים בתיק"});
    identities.add(borrower.identityNumber);
  });
  if (input.borrowers.filter((borrower) => borrower.isPrimary).length !== 1 || !input.borrowers[0]?.isPrimary) context.addIssue({code: "custom", path: ["borrowers"], message: "יש להגדיר לווה ראשי אחד בלבד"});
});

export const clientPersonalInputSchema = z.preprocess(canonicalizeMarriedBorrowers, clientPersonalInputObjectSchema);

const incomeBorrowerSchema = z.object({
  id: z.number().int().positive(),
  employment: employmentSchema,
  income: incomeSchema
}).strict();

export const clientIncomeInputSchema = z.object({borrowers: z.array(incomeBorrowerSchema).min(1).max(MAX_BORROWERS)}).strict();

export const clientLiabilitiesInputSchema = z.object({
  borrowerRelationship: z.enum(BORROWER_RELATIONSHIPS).nullable(),
  borrowers: z.array(z.object({id: z.number().int().positive(), liabilities: z.array(liabilityInputSchema).max(100)}).strict()).min(1).max(MAX_BORROWERS),
  householdLiabilities: z.array(liabilityInputSchema).max(100)
}).strict().superRefine((input, context) => {
  if (input.borrowerRelationship === "MARRIED") {
    input.borrowers.forEach((borrower, index) => { if (borrower.liabilities.length) context.addIssue({code: "custom", path: ["borrowers", index, "liabilities"], message: "בתיק נשוי ההתחייבויות נשמרות ברמת משק הבית"}); });
  } else if (input.householdLiabilities.length) context.addIssue({code: "custom", path: ["householdLiabilities"], message: "התחייבויות משותפות מותרות רק בתיק נשוי"});
});

export const clientPropertyInputSchema = z.object({
  loanPurpose: z.enum(DEAL_TYPES, {error: "יש לבחור מטרת הלוואה"}),
  property: z.object({
    propertyType: z.enum(PROPERTY_TYPES, {error: "יש לבחור סוג נכס"}),
    propertyTypeOtherDescription: z.string().trim().max(500, "התיאור ארוך מדי").nullable(),
    city: requiredText("יש להזין את עיר הנכס", 100),
    address: requiredText("יש להזין כתובת נכס", 300),
    value: requiredNumber("יש להזין שווי נכס", 100_000_000)
  }).strict(),
  loanRequest: z.object({requestedAmount: requiredNumber("יש להזין סכום מימון מבוקש", 100_000_000)}).strict()
}).strict().superRefine((input, context) => {
  if (input.property.propertyType === "OTHER" && !input.property.propertyTypeOtherDescription?.trim()) context.addIssue({code: "custom", path: ["property", "propertyTypeOtherDescription"], message: "יש לתאר את סוג הנכס"});
});

export const clientDealDetailsInputSchema = z.object({dealDetails: requiredText("יש להזין פירוט עסקה", 5000)}).strict();

const yesNoField = (message: string) => z.boolean({error: message}).nullable();

export const creditIndicationInputSchema = z.object({
  bouncedChecks: yesNoField("יש לציין האם היו החזרי צ׳קים"),
  bouncedChecksCount: requiredInteger("יש להזין מספר צ׳קים", 1, 1000).nullable(),
  bouncedDirectDebits: yesNoField("יש לציין האם היו החזרי הוראות קבע"),
  bouncedDirectDebitsCount: requiredInteger("יש להזין מספר הוראות קבע", 1, 1000).nullable(),
  collectionProceedings: yesNoField("יש לציין האם הייתה הוצאה לפועל"),
  bankruptcy: yesNoField("יש לציין האם הייתה פשיטת רגל"),
  liens: yesNoField("יש לציין האם היו עיקולים"),
  mortgageArrears: yesNoField("יש לציין האם היו פיגורים במשכנתא")
}).strict().superRefine((input, context) => {
  if (input.bouncedChecks && input.bouncedChecksCount === null) context.addIssue({code: "custom", path: ["bouncedChecksCount"], message: "יש להזין כמה צ׳קים"});
  if (!input.bouncedChecks && input.bouncedChecksCount !== null) context.addIssue({code: "custom", path: ["bouncedChecksCount"], message: "אין להזין כמות כאשר אין החזרי צ׳קים"});
  if (input.bouncedDirectDebits && input.bouncedDirectDebitsCount === null) context.addIssue({code: "custom", path: ["bouncedDirectDebitsCount"], message: "יש להזין כמה הוראות קבע"});
  if (!input.bouncedDirectDebits && input.bouncedDirectDebitsCount !== null) context.addIssue({code: "custom", path: ["bouncedDirectDebitsCount"], message: "אין להזין כמות כאשר אין החזרי הוראות קבע"});
});

export type CreditIndicationInput = z.infer<typeof creditIndicationInputSchema>;

export type ClientPersonalInput = z.infer<typeof clientPersonalInputSchema>;
export type ClientIncomeInput = z.infer<typeof clientIncomeInputSchema>;
export type ClientLiabilitiesInput = z.infer<typeof clientLiabilitiesInputSchema>;
export type ClientPropertyInput = z.infer<typeof clientPropertyInputSchema>;
export type ClientDealDetailsInput = z.infer<typeof clientDealDetailsInputSchema>;
