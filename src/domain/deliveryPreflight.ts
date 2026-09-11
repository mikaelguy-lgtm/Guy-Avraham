import type {DeliveryBlocker, FullCaseSnapshot} from "./lenderDelivery.js";
import {requiredDocumentLabel} from "./requiredDocuments.js";
import {REQUIRED_BORROWER_DOCUMENT_TYPES, REQUIRED_CLIENT_DOCUMENT_TYPES} from "./clientFields.js";

export function collectDeliveryBlockers(snapshot: FullCaseSnapshot): DeliveryBlocker[] {
  const blockers: DeliveryBlocker[] = [];
  const addField = (code: string, label: string, hint: string) => blockers.push({code, category: "FIELD", label, hint, action: "edit"});
  const addBusiness = (code: string, label: string, hint: string) => blockers.push({code, category: "BUSINESS", label, hint, action: "edit"});
  const requiredText = (value: string | null | undefined, code: string, label: string, section: string) => {
    if (!value?.trim()) addField(code, label, `יש להשלים את השדה במסך עריכת ${section}.`);
  };
  if (snapshot.borrowers.length !== snapshot.numberOfBorrowers || snapshot.borrowers.length === 0) addField("BORROWERS_INCOMPLETE", "פרטי הלווים אינם מלאים", "יש להשלים את פרטי כל הלווים בתיק.");
  if (["CLOSED", "ARCHIVED"].includes(snapshot.status ?? "")) addBusiness("CLIENT_STATUS_BLOCKED", "סטטוס התיק אינו מאפשר שליחה", "יש להחזיר את התיק לסטטוס פעיל לפני שליחה.");
  if (snapshot.numberOfBorrowers > 1 && !snapshot.borrowerRelationship) addField("BORROWER_RELATIONSHIP_REQUIRED", "חסר קשר בין הלווים", "יש לבחור את הקשר בין הלווים בפרטים האישיים.");
  if (snapshot.borrowerRelationship === "OTHER" && !snapshot.borrowerRelationshipOther?.trim()) addField("BORROWER_RELATIONSHIP_DESCRIPTION_REQUIRED", "חסר תיאור הקשר בין הלווים", "יש לתאר את הקשר בין הלווים בפרטים האישיים.");
  for (const borrower of snapshot.borrowers) {
    const prefix = `לווה ${borrower.order}`;
    requiredText(borrower.firstName, `BORROWER_${borrower.order}_FIRST_NAME`, `${prefix}: חסר שם פרטי`, "הפרטים האישיים");
    requiredText(borrower.lastName, `BORROWER_${borrower.order}_LAST_NAME`, `${prefix}: חסר שם משפחה`, "הפרטים האישיים");
    if (!/^\d{9}$/.test(borrower.identityNumber)) addField(`BORROWER_${borrower.order}_IDENTITY`, `${prefix}: מספר תעודת הזהות אינו תקין`, "יש להזין 9 ספרות ללא מקפים.");
    requiredText(borrower.dateOfBirth, `BORROWER_${borrower.order}_BIRTH_DATE`, `${prefix}: חסר תאריך לידה`, "הפרטים האישיים");
    requiredText(borrower.phone, `BORROWER_${borrower.order}_PHONE`, `${prefix}: חסר טלפון`, "הפרטים האישיים");
    requiredText(borrower.email, `BORROWER_${borrower.order}_EMAIL`, `${prefix}: חסר דוא״ל`, "הפרטים האישיים");
    requiredText(borrower.address, `BORROWER_${borrower.order}_ADDRESS`, `${prefix}: חסרה כתובת מגורים`, "הפרטים האישיים");
    requiredText(borrower.maritalStatus, `BORROWER_${borrower.order}_MARITAL_STATUS`, `${prefix}: חסר מצב משפחתי`, "הפרטים האישיים");
    if (borrower.childrenAges.length !== borrower.numberOfChildren) addField(`BORROWER_${borrower.order}_CHILDREN_AGES`, `${prefix}: חסרים גילאי ילדים`, "יש להזין גיל נפרד לכל ילד.");
    requiredText(borrower.employment.employmentType, `BORROWER_${borrower.order}_EMPLOYMENT_TYPE`, `${prefix}: חסר סוג תעסוקה`, "ההכנסות");
    if (borrower.employment.employmentType === "SELF_EMPLOYED") {
      const selfEmployed = borrower.employment.selfEmployed;
      if (!selfEmployed) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED`, `${prefix}: חסרים פרטי העסק העצמאי`, "יש להשלים את פרטי העסק העצמאי בהכנסות.");
      else {
        requiredText(selfEmployed.businessType ?? "", `BORROWER_${borrower.order}_SELF_EMPLOYED_BUSINESS_TYPE`, `${prefix}: חסר סוג העיסוק`, "ההכנסות");
        if (!Number.isInteger(selfEmployed.businessStartYear)) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_START_YEAR`, `${prefix}: חסרה שנת פתיחת העסק`, "יש להזין שנת פתיחת העסק.");
        if (!Number.isFinite(selfEmployed.lastAssessedIncome) || (selfEmployed.lastAssessedIncome ?? -1) < 0) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_LAST_ASSESSED_INCOME`, `${prefix}: חסרה הכנסה משומה אחרונה`, "יש להזין הכנסה משומה אחרונה.");
        if (!Number.isInteger(selfEmployed.assessmentYear)) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_ASSESSMENT_YEAR`, `${prefix}: חסרה שנת שומה`, "יש להזין שנת שומה.");
        if (!Number.isFinite(selfEmployed.accountantIncomePreviousYear) || (selfEmployed.accountantIncomePreviousYear ?? -1) < 0) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_ACCOUNTANT_PREVIOUS`, `${prefix}: חסר אישור הכנסות רו"ח לשנה הקודמת`, "יש להזין את אישור הכנסות רואה החשבון לשנה הקודמת.");
        if (!Number.isFinite(selfEmployed.accountantIncomeCurrentYear) || (selfEmployed.accountantIncomeCurrentYear ?? -1) < 0) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_ACCOUNTANT_CURRENT`, `${prefix}: חסרות הכנסות רו"ח לשנה הנוכחית`, "יש להזין את הכנסות רואה החשבון לשנה הנוכחית.");
        if (!Number.isInteger(selfEmployed.accountantMonthsCount) || (selfEmployed.accountantMonthsCount ?? 0) < 1 || (selfEmployed.accountantMonthsCount ?? 0) > 12) addField(`BORROWER_${borrower.order}_SELF_EMPLOYED_ACCOUNTANT_MONTHS`, `${prefix}: חסר מספר חודשים`, "יש להזין מספר חודשים בין 1 ל-12.");
      }
    } else {
      requiredText(borrower.employment.employerName, `BORROWER_${borrower.order}_EMPLOYER`, `${prefix}: חסר שם מעסיק או עסק`, "ההכנסות");
      requiredText(borrower.employment.jobTitle, `BORROWER_${borrower.order}_JOB_TITLE`, `${prefix}: חסר תפקיד`, "ההכנסות");
      if (!Number.isFinite(borrower.employment.employmentSeniorityYears) || borrower.employment.employmentSeniorityYears < 0) addField(`BORROWER_${borrower.order}_SENIORITY`, `${prefix}: הוותק אינו תקין`, "יש להזין ותק בשנים שאינו שלילי.");
    }
    if (!Number.isFinite(borrower.employment.monthlyNetIncome) || borrower.employment.monthlyNetIncome < 0) addField(`BORROWER_${borrower.order}_INCOME`, `${prefix}: ההכנסה החודשית אינה תקינה`, "יש להזין הכנסה חודשית שאינה שלילית.");
    (borrower.employment.additionalIncomes ?? []).forEach((income, incomeIndex) => {
      if (!income.type || !Number.isFinite(income.monthlyAmount) || income.monthlyAmount < 0) addField(`BORROWER_${borrower.order}_ADDITIONAL_INCOME_${incomeIndex + 1}`, `${prefix}: הכנסה נוספת ${incomeIndex + 1} אינה מלאה`, "יש להשלים סוג וסכום הכנסה נוספת שאינו שלילי.");
      if (income.type === "OTHER" && !income.description?.trim()) addField(`BORROWER_${borrower.order}_ADDITIONAL_INCOME_${incomeIndex + 1}_DESCRIPTION`, `${prefix}: חסר תיאור להכנסה נוספת`, "יש לתאר את ההכנסה הנוספת מסוג אחר.");
    });
  }
  const liabilities = [...snapshot.borrowers.flatMap((borrower) => borrower.liabilities), ...snapshot.householdLiabilities];
  liabilities.forEach((liability, index) => {
    const requiresBalance = liability.type !== "ALIMONY" && liability.type !== "RENT";
    const requiresInstitution = liability.type === "LOAN" || liability.type === "MORTGAGE";
    if (liability.incompleteLegacy || !liability.type || !liability.endDate || !liability.notes.trim() || (requiresBalance && (liability.currentBalance === null || liability.currentBalance < 0)) || liability.monthlyPayment < 0 || (requiresInstitution && !liability.financialInstitution?.trim())) addField(`LIABILITY_${index + 1}_INCOMPLETE`, `התחייבות ${index + 1} אינה מלאה`, "יש להשלים את כל הפרטים הרלוונטיים להתחייבות.");
  });
  requiredText(snapshot.property.propertyType, "PROPERTY_TYPE_REQUIRED", "חסר סוג נכס", "פרטי הנכס");
  if (snapshot.property.propertyType === "OTHER" && !snapshot.property.propertyTypeOtherDescription?.trim()) addField("PROPERTY_TYPE_DESCRIPTION_REQUIRED", "חסר תיאור סוג הנכס", "יש לתאר את סוג הנכס בפרטי הנכס.");
  requiredText(snapshot.property.city, "PROPERTY_CITY_REQUIRED", "חסרה עיר הנכס", "פרטי הנכס");
  if (!Number.isFinite(snapshot.property.value) || snapshot.property.value <= 0) addField("PROPERTY_VALUE_REQUIRED", "שווי הנכס אינו תקין", "יש להזין שווי נכס גדול מאפס.");
  requiredText(snapshot.loanRequest.purpose, "LOAN_PURPOSE_REQUIRED", "חסרה מטרת הלוואה", "פרטי הנכס");
  if (snapshot.loanRequest.purpose === "OTHER" && !snapshot.loanRequest.purposeOther?.trim()) addField("LOAN_PURPOSE_DESCRIPTION_REQUIRED", "חסר פירוט מטרת ההלוואה", "יש לתאר את מטרת ההלוואה בפרטי הנכס.");
  if (!Number.isFinite(snapshot.loanRequest.requestedAmount) || snapshot.loanRequest.requestedAmount <= 0) addField("REQUESTED_AMOUNT_REQUIRED", "סכום המימון אינו תקין", "יש להזין סכום מימון גדול מאפס.");
  if (!Number.isInteger(snapshot.loanRequest.requestedTermMonths) || snapshot.loanRequest.requestedTermMonths <= 0) addField("REQUESTED_TERM_REQUIRED", "תקופת ההלוואה אינה תקינה", "יש להזין תקופה תקינה בחודשים.");
  requiredText(snapshot.dealDetails, "DEAL_DETAILS_REQUIRED", "חסר פירוט עסקה", "פירוט העסקה");
  for (const borrower of snapshot.borrowers) for (const type of REQUIRED_BORROWER_DOCUMENT_TYPES) {
    if (!snapshot.documents.some((document) => document.borrowerOrder === borrower.order && document.documentType === type)) blockers.push({code: `MISSING_${type}_${borrower.order}`, category: "DOCUMENT", label: `חסר מסמך: ${requiredDocumentLabel(type, borrower.order)}`, hint: "יש להעלות את המסמך בכרטיסיית המסמכים.", action: "documents"});
  }
  for (const type of REQUIRED_CLIENT_DOCUMENT_TYPES) {
    if (!snapshot.documents.some((document) => document.borrowerId === null && document.documentType === type)) blockers.push({code: `MISSING_${type}`, category: "DOCUMENT", label: `חסר מסמך: ${requiredDocumentLabel(type)}`, hint: "יש להעלות את המסמך בכרטיסיית המסמכים.", action: "documents"});
  }
  return blockers;
}
