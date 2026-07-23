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
  SALARIED: "שכיר",
  SELF_EMPLOYED: "עצמאי",
  CONTROLLING_SHAREHOLDER: "בעל שליטה",
  RETIRED: "פנסיונר",
  GOVERNMENT_EMPLOYEE: "עובד מדינה",
  SECURITY_FORCES: "עובד מערכת הביטחון",
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
  SUBMITTED_OFFER: "הוגשה",
  UPDATED: "עודכנה",
  WITHDRAWN: "נמשכה",
  ACCEPTED: "התקבלה"
};

export const formatUserRole = (value: UserRole | string) => labels[value] ?? "משתמש מערכת";
export const formatUserStatus = (value: string) => labels[value] ?? "לא ידוע";
export const formatClientStatus = (value: string) => labels[value] ?? "בטיפול";
export const formatEmploymentType = (value: string) => labels[value] ?? "לא צוין";
export const formatDealType = (value: string) => labels[value] ?? "לא צוין";
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

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "לא צוין";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "לא צוין" : new Intl.DateTimeFormat("he-IL", {day: "2-digit", month: "2-digit", year: "numeric"}).format(date);
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
