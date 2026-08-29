import type { UserRole } from "../types.js";

const labels: Record<string, string> = {
  SUPER_ADMIN: "מנהל־על",
  ADMIN: "מנהל מערכת",
  ADVISOR: "יועץ משכנתאות",
  LENDER_ADMIN: "מנהל חברת מימון",
  LENDER_UNDERWRITER: "חתם",
  DRAFT: "טיוטה",
  ACTIVE: "פעיל",
  SUBMITTED: "נשלח לחברות מימון",
  CLOSED: "נסגר",
  ARCHIVED: "בארכיון",
  PURCHASE: "רכישת נכס",
  REFINANCE: "מחזור משכנתה",
  CONSOLIDATION: "איחוד הלוואות",
  PURCHASE_FROM_CONTRACTOR: "רכישה מקבלן",
  BUYER_PRICE_PROGRAM: "מחיר למשתכן",
  SECOND_HAND_PURCHASE: "רכישה יד שנייה",
  RENOVATION: "שיפוצים",
  DEBT_CONSOLIDATION: "איחוד הלוואות",
  BUSINESS_PURPOSE: "מטרה עסקית",
  ANY_PURPOSE: "לכל מטרה",
  SELF_CONSTRUCTION: "בנייה עצמית",
  FAMILY_TRANSACTION: "עסקה בתוך המשפחה",
  KIBBUTZ_PURCHASE_OR_CONSTRUCTION: "רכישה או בנייה בקיבוץ",
  RECEIVER_PURCHASE: "רכישה מכונס נכסים",
  REVERSE_MORTGAGE: "משכנתה הפוכה",
  TAMA: "תמ״א",
  MORTGAGE_REFINANCE: "מחזור משכנתה",
  BRIDGE_FINANCING: "גישור",
  LOAN: "הלוואה",
  MORTGAGE: "משכנתה",
  RENT: "שכירות",
  OTHER_FINANCIAL_ENTITY: "גוף פיננסי אחר",
  SALARIED: "שכיר",
  SELF_EMPLOYED: "עצמאי",
  CONTROLLING_SHAREHOLDER: "שכיר בעל שליטה",
  RETIRED: "פנסיונר",
  GOVERNMENT_EMPLOYEE: "עובד מדינה",
  SECURITY_FORCES: "עובד מערכת הביטחון",
  TORAH_INSTITUTION: "מוסד תורני",
  ALLOWANCE: "קצבה",
  UNEMPLOYED: "ללא תעסוקה",
  APARTMENT: "דירה",
  HOUSE: "בית פרטי",
  SEMI_DETACHED: "דו־משפחתי",
  GARDEN_APARTMENT: "דירת גן",
  PENTHOUSE: "פנטהאוז",
  LAND: "קרקע",
  COMMERCIAL: "נכס מסחרי",
  FARM: "משק חקלאי",
  ESTATE: "נחלה",
  KIBBUTZ: "קיבוץ",
  CENTER: "מרכז",
  NORTH: "צפון",
  SOUTH: "דרום",
  JERUSALEM: "ירושלים",
  SINGLE: "רווק/ה",
  MARRIED: "נשוי/אה",
  DIVORCED: "גרוש/ה",
  WIDOWED: "אלמן/ה",
  COMMON_LAW: "ידועים בציבור",
  SEPARATED: "פרוד/ה",
  SECOND_BUSINESS: "הכנסה מעסק נוסף",
  SMALL_SELF_EMPLOYMENT: "הכנסה מעצמאות קטנה",
  RENTAL_INCOME: "שכר דירה",
  ALIMONY: "מזונות",
  PENSION: "פנסיה",
  REGULAR_OVERTIME: "שעות נוספות קבועות",
  REGULAR_BONUSES: "בונוסים קבועים",
  FOREIGN_INCOME: "הכנסה מחו״ל",
  INVESTMENT_INCOME: "הכנסה מהשקעות",
  FAMILY_SUPPORT: "תמיכה משפחתית קבועה",
  UPLOADED: "הועלה",
  VERIFIED: "אומת",
  REJECTED: "נדחה",
  DELETED: "נמחק",
  REPLACED: "הוחלף",
  PENDING_DELIVERY: "ממתין לשליחה",
  SENT: "נשלח",
  DELIVERED: "נמסר",
  DELIVERY_FAILED: "השליחה נכשלה",
  OPENED: "נפתח",
  IN_REVIEW: "בבדיקה",
  MORE_INFO_REQUESTED: "נדרש מידע נוסף",
  IDENTITY_REQUESTED: "ממתין לחשיפת זהות",
  IDENTITY_APPROVED: "חשיפת זהות אושרה",
  IDENTITY_REJECTED: "חשיפת זהות נדחתה",
  OFFER_RECEIVED: "התקבלה הצעה",
  DECLINED: "נדחה על ידי החברה",
  EXPIRED: "פג תוקף",
  CANCELLED: "בוטל",
  PENDING: "ממתין",
  SUSPENDED: "מושעה",
  DISABLED: "מושבת",
  PARTIALLY_APPROVED: "אושר חלקית",
  APPROVED: "אושר",
  FULL_NAME: "שם מלא",
  PHONE: "טלפון",
  EMAIL: "דוא״ל",
  IDENTITY_NUMBER: "מספר תעודת זהות",
  PROPERTY_ADDRESS: "כתובת הנכס",
  EMPLOYER: "מעסיק",
  SPECIFIC_DOCUMENTS: "מסמכים נבחרים",
  FINANCIAL: "מסמך פיננסי",
  IDENTIFICATION: "מסמך זיהוי",
  INCOME: "אישור הכנסה",
  BANK_STATEMENT: "דף חשבון",
  OTHER: "אחר",
  ID_FRONT: "תעודת זהות — צד קדמי",
  ID_BACK: "תעודת זהות — צד אחורי",
  ID_APPENDIX: "ספח תעודת זהות",
  PROPERTY_RIGHTS: "נסח טאבו או אישור זכויות",
  POWER_OF_ATTORNEY: "כתב הסמכה",
  SUBMITTED_OFFER: "הוגשה",
  UPDATED: "עודכנה",
  WITHDRAWN: "נמשכה",
  ACCEPTED: "התקבלה"
};

const deliveryEventLabels: Record<string, string> = {
  SUBMISSION_CREATED: "נוצרה שליחה", EMAIL_QUEUED: "הודעה הוכנסה לתור", EMAIL_SENT: "הודעה נשלחה לשרת הדואר", EMAIL_FAILED: "שליחת הודעה נכשלה",
  REVIEW_LINK_OPENED: "קישור הבדיקה נפתח", MASKED_PDF_VIEWED: "נצפה PDF מוסווה", MASKED_PDF_DOWNLOADED: "הורד PDF מוסווה", REMINDER_SENT: "נשלחה תזכורת",
  INTEREST_DECISION_STARTED: "החל תהליך בחירת מעוניינים", OTP_SENT: "נשלח קוד חד־פעמי", OTP_FAILED: "אימות הקוד נכשל", OTP_VERIFIED: "הקוד אומת",
  COMPANY_INTERESTED: "החברה מעוניינת", COMPANY_NOT_INTERESTED: "החברה אינה מעוניינת", COMPANY_RESPONSE_EXPIRED: "מועד התגובה פג", FULL_ACCESS_GRANTED: "נפתחה גישה מלאה",
  FULL_ACCESS_OPENED: "הפורטל המלא נפתח", FULL_PDF_VIEWED: "נצפה PDF מלא", FULL_PDF_DOWNLOADED: "הורד PDF מלא", DOCUMENT_VIEWED: "נצפה מסמך", DOCUMENT_DOWNLOADED: "הורד מסמך",
  FULL_CASE_VIEWED: "התיק המלא נפתח", FULL_CASE_ZIP_DOWNLOADED: "הורד תיק מלא", OFFER_SUBMITTED: "הוגשה הצעת מימון", FULL_ACCESS_EXPIRED: "הגישה המלאה פגה", ADMIN_ACCESS_EXTENDED: "מנהל האריך את הגישה", ADMIN_ACCESS_REVOKED: "מנהל ביטל את הגישה", INVITATION_CANCELLED: "ההזמנה בוטלה"
};

const deliveryStatusLabels: Record<string, string> = {PENDING: "ממתין", QUEUED: "בתור לשליחה", PARTIALLY_SENT: "נשלח חלקית", SENT: "נשלח לשרת הדואר", FAILED: "שליחה נכשלה"};
const decisionStatusLabels: Record<string, string> = {PENDING: "ממתינה לתגובה", PENDING_VERIFICATION: "ממתינה לאימות", INTERESTED: "מעוניינת", NOT_INTERESTED: "לא מעוניינת", EXPIRED: "פג תוקף", CANCELLED: "בוטלה"};
const accessStatusLabels: Record<string, string> = {NONE: "ללא גישה", ACTIVE: "גישה מלאה פעילה", EXPIRED: "הגישה פגה", REVOKED: "הגישה בוטלה"};
const invitationStatusLabels: Record<string, string> = {QUEUED: "בתור לשליחה", SENT: "נשלח לשרת הדואר", FAILED: "נכשל", OPENED: "נפתח", CLOSED: "נסגר", EXPIRED: "פג תוקף"};
export const formatDeliveryStatus = (value: string) => deliveryStatusLabels[value] ?? "מצב לא ידוע";
export const formatDecisionStatus = (value: string) => decisionStatusLabels[value] ?? "מצב לא ידוע";
export const formatAccessStatus = (value: string) => accessStatusLabels[value] ?? "מצב לא ידוע";
export const formatInvitationStatus = (value: string) => invitationStatusLabels[value] ?? "מצב לא ידוע";
export const formatDeliveryEvent = (value: string) => deliveryEventLabels[value] ?? "אירוע מערכת";

export const formatUserRole = (value: UserRole | string) => labels[value] ?? "משתמש מערכת";
export const formatUserStatus = (value: string) => labels[value] ?? "לא ידוע";
export const formatClientStatus = (value: string) => labels[value] ?? "בטיפול";
export const formatEmploymentType = (value: string) => labels[value] ?? "לא צוין";
export const formatDealType = (value: string) => labels[value] ?? "לא צוין";
export const formatLoanPurpose = formatDealType;
export const formatLiabilityType = (value: string) => labels[value] ?? "התחייבות";
export const formatPropertyType = (value: string) => labels[value] ?? "לא צוין";
export const formatRegion = (value: string) => labels[value] ?? "לא צוין";
export const formatMaritalStatus = (value: string) => labels[value] ?? "לא צוין";
export const formatAdditionalIncomeType = (value: string | null) => value ? labels[value] ?? "אחר" : "לא קיימת";
export const formatDocumentStatus = (value: string) => labels[value] ?? "בטיפול";
export const formatDocumentType = (value: string) => labels[value] ?? "מסמך לקוח";
export const formatSubmissionStatus = (value: string | null) => value ? labels[value] ?? "בטיפול" : "טרם נשלח";
export const formatOfferStatus = (value: string) => value === "SUBMITTED" ? "הוגשה" : labels[value] ?? "בטיפול";
export const formatIdentityStatus = (value: string) => labels[value] ?? "בטיפול";
export const formatIdentityField = (value: string) => labels[value] ?? "פרט נוסף";

const borrowerRelationshipLabels: Record<string, string> = {
  MARRIED: "נשואים",
  COMMON_LAW: "ידועים בציבור",
  FAMILY: "משפחה",
  PARTNERS: "שותפים",
  OTHER: "אחר"
};

export const formatBorrowerRelationship = (value: string | null) => value ? borrowerRelationshipLabels[value] ?? "אחר" : "לווה יחיד";

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("he-IL", {style: "currency", currency: "ILS", maximumFractionDigits: 0}).format(Number.isFinite(amount) ? amount : 0);
}

export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";
const israelHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ISRAEL_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23"
});
const israelDateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  timeZone: ISRAEL_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export type IsraelTimeGreeting = "בוקר טוב" | "צהריים טובים" | "ערב טוב" | "לילה טוב";

export function getIsraelHour(value: string | Date | number = new Date()): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const hour = israelHourFormatter.formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}

export function getIsraelTimeGreeting(value: string | Date | number = new Date()): IsraelTimeGreeting {
  const hour = getIsraelHour(value);
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 18) return "צהריים טובים";
  if (hour >= 18 && hour < 23) return "ערב טוב";
  return "לילה טוב";
}

export function formatIsraelTimeGreeting(firstName: string, value: string | Date | number = new Date()): string {
  const greeting = getIsraelTimeGreeting(value);
  const normalizedName = firstName.trim();
  return normalizedName ? `${greeting}, ${normalizedName}` : greeting;
}

export function formatIsraelDateTime(value: string | Date | null | undefined): string {
  if (!value) return "לא צוין";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא צוין";
  const parts = Object.fromEntries(israelDateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return formatIsraelDateTime(value);
}

export function maskEmailAddress(value: string | null | undefined): string {
  if (!value || !value.includes("@")) return "כתובת מוסתרת";
  if (value.includes("*")) return value;
  const [localPart, domain] = value.trim().split("@");
  const visibleLocal = localPart.length <= 2 ? localPart.slice(0, 1) : localPart.slice(0, 2);
  const domainParts = domain.split(".");
  const domainName = domainParts.shift() ?? "";
  const visibleDomain = domainName.slice(0, 1);
  return `${visibleLocal}${"*".repeat(Math.max(2, localPart.length - visibleLocal.length))}@${visibleDomain}${"*".repeat(Math.max(2, domainName.length - visibleDomain.length))}${domainParts.length ? `.${domainParts.join(".")}` : ""}`;
}

export function emailServerAcceptedMessage(recipient: string | null | undefined): string {
  return `המייל נשלח לשרת הדואר עבור הכתובת ${maskEmailAddress(recipient)}.\nאם הוא לא מופיע בתוך כמה דקות, יש לבדוק גם בתיקיות ספאם, דואר זבל וקידומי מכירות.`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} בתים`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ק״ב`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} מ״ב`;
}

export function maskIdentityNumber(value: string): string {
  const normalized = value.replace(/\D/g, "");
  if (normalized.length < 4) return "•••••••••";
  return `${"•".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function formatPercentage(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}
