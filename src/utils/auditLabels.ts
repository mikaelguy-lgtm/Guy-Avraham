// שמות בעברית לפעולות ביומן הפעילות ולסוגי המבצעים — כדי שמנהל המערכת יבין מה קרה
// בלי לפענח קודים פנימיים. קוד שאין לו תווית מוצג כ"פעולת מערכת" עם הקוד בסוגריים, לצורכי תמיכה.
const auditActionLabels: Record<string, string> = {
  ADMIN_NOTIFICATION_SETTINGS_UPDATED: "עודכנו הגדרות התראות מנהל",
  ADVISOR_PROFILE_UPDATED: "יועץ עדכן את הפרופיל",
  ADVISOR_REGISTERED: "יועץ השלים הרשמה",
  ADVISOR_REGISTRATION_FAILED: "הרשמת יועץ נכשלה",
  ADVISOR_REGISTRATION_STARTED: "יועץ התחיל הרשמה",
  ADVISOR_VERIFICATION_EMAIL_FAILED: "שליחת מייל אימות ליועץ נכשלה",
  BUSINESS_CALENDAR_EXCEPTION_CREATED: "נוסף חריג ללוח ימי העסקים",
  BUSINESS_CALENDAR_EXCEPTION_DELETED: "נמחק חריג מלוח ימי העסקים",
  BUSINESS_CALENDAR_EXCEPTION_UPDATED: "עודכן חריג בלוח ימי העסקים",
  CLIENT_CREATED: "נפתח תיק חדש",
  CLIENT_CREDIT_INDICATION_UPDATED: "עודכן חיווי אשראי",
  CLIENT_DEAL_DETAILS_UPDATED: "עודכן פירוט העסקה",
  CLIENT_DELETED: "תיק נמחק",
  CLIENT_FULL_UPDATED: "התיק עודכן",
  CLIENT_INCOME_UPDATED: "עודכנו הכנסות",
  CLIENT_LIABILITIES_UPDATED: "עודכנו התחייבויות",
  CLIENT_PERSONAL_UPDATED: "עודכנו פרטים אישיים",
  CLIENT_PROPERTY_UPDATED: "עודכנו פרטי הנכס והמימון",
  COMPANY_SUBMISSION_CANCEL_INVITATION: "מנהל ביטל הגשה לחברה",
  COMPANY_SUBMISSION_EXTEND_ACCESS: "מנהל האריך גישה לתיק המלא",
  COMPANY_SUBMISSION_REISSUE: "מנהל שלח מחדש הזמנה לחברה",
  COMPANY_SUBMISSION_RESEND_FAILED: "מנהל שלח מחדש הודעה שנכשלה",
  COMPANY_SUBMISSION_REVOKE_ACCESS: "מנהל ביטל גישה לתיק המלא",
  COMPANY_SUBMISSION_SEND_REMINDER: "מנהל שלח תזכורת לחברה",
  DOCUMENT_DELETED: "מסמך נמחק",
  DOCUMENT_DOWNLOADED: "מסמך הורד",
  DOCUMENT_UPLOADED: "מסמך הועלה",
  EMAIL_VERIFICATION_RESENT: "מייל אימות נשלח שוב",
  EMAIL_VERIFICATION_SENT: "נשלח מייל אימות",
  EMAIL_VERIFIED: "כתובת הדוא״ל אומתה",
  FINANCING_COMPANY_CONTACT_CREATED: "נוסף איש קשר לחברת מימון",
  FINANCING_COMPANY_CONTACT_DELETED: "הוסר איש קשר מחברת מימון",
  FINANCING_COMPANY_CONTACT_UPDATED: "עודכן איש קשר בחברת מימון",
  FINANCING_COMPANY_CREATED: "נוספה חברת מימון",
  FINANCING_COMPANY_DELETED: "הוסרה חברת מימון",
  FINANCING_COMPANY_LOGO_UPDATED: "עודכן לוגו חברת מימון",
  FINANCING_COMPANY_UPDATED: "עודכנה חברת מימון",
  IDENTITY_APPROVED: "יועץ אישר חשיפת פרטים",
  IDENTITY_REJECTED: "יועץ דחה חשיפת פרטים",
  IDENTITY_REQUESTED: "התבקשה חשיפת פרטים",
  INVITE_OPENED: "הזמנה נפתחה",
  LEGAL_DOCUMENT_DRAFT_CREATED: "נוצרה טיוטת מסמך משפטי",
  LEGAL_DOCUMENT_DRAFT_DISCARDED: "טיוטת מסמך משפטי נמחקה",
  LEGAL_DOCUMENT_DRAFT_UPDATED: "עודכנה טיוטת מסמך משפטי",
  LEGAL_DOCUMENT_PUBLISHED: "פורסם מסמך משפטי",
  LENDER_DELIVERY_BATCH_CREATED: "התיק נשלח לחברות המימון",
  LENDER_REPLY_CREATED: "חברת מימון השיבה",
  NOTIFICATIONS_MARKED_READ: "כל ההתראות סומנו כנקראו",
  NOTIFICATION_MARKED_READ: "התראה סומנה כנקראה",
  PASSWORD_RESET_EMAIL_FAILED: "שליחת מייל איפוס סיסמה נכשלה",
  PASSWORD_RESET_REQUESTED: "התבקש איפוס סיסמה",
  PASSWORD_RESET_REQUESTED_BY_ADMIN: "מנהל שלח איפוס סיסמה",
  PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL: "בקשת איפוס לכתובת לא מוכרת",
  PRIVACY_REQUEST_CREATED: "התקבלה בקשת פרטיות",
  PRIVACY_REQUEST_UPDATED: "עודכנה בקשת פרטיות",
  PUBLIC_SITE_SETTINGS_UPDATED: "עודכנו הגדרות האתר הציבורי",
  SESSION_IDLE_TIMEOUT: "החיבור נותק אחרי 5 דקות ללא פעילות",
  SMTP_ACTIVATED: "הופעלה תצורת דוא״ל",
  SMTP_DRAFT_CREATED: "נשמרה טיוטת תצורת דוא״ל",
  SMTP_DRAFT_FAILED: "שמירת תצורת דוא״ל נכשלה",
  SMTP_PASSWORD_CLEARED: "נמחקה סיסמת תצורת הדוא״ל",
  SMTP_ROLLED_BACK: "תצורת הדוא״ל הוחזרה לגרסה קודמת",
  SMTP_TESTED: "בוצעה בדיקת דוא״ל",
  SUBMISSION_DELIVERY_FAILED: "שליחת הזמנה נכשלה",
  SUBMISSION_EMAIL_SENT: "הזמנה נשלחה",
  TEST_ADVISOR_CLEANED: "נוקה חשבון בדיקה",
  USER_ARCHIVED: "משתמש הועבר לארכיון",
  USER_DISABLED: "משתמש הושבת",
  USER_LOGOUT: "משתמש התנתק",
  USER_ENABLED: "משתמש הופעל",
  USER_RESTORED: "משתמש שוחזר",
  USER_SUSPENDED: "משתמש הושעה",
  USER_UPDATED: "פרטי משתמש עודכנו"
};

const actorTypeLabels: Record<string, string> = {
  SYSTEM: "מערכת", ADVISOR: "יועץ", ADMIN: "מנהל", COMPANY_CONTACT: "איש קשר בחברת המימון", SUPER_ADMIN: "מנהל מערכת ראשי"
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "מנהל מערכת ראשי", ADMIN: "מנהל מערכת", ADVISOR: "יועץ", LENDER_ADMIN: "מנהל חברת מימון", LENDER_UNDERWRITER: "חתם"
};

export function formatAuditAction(action: string): string {
  return auditActionLabels[action] ?? `פעולת מערכת (${action})`;
}

export function formatActorType(actorType: string | null | undefined): string {
  return actorType ? actorTypeLabels[actorType] ?? "מערכת" : "מערכת";
}

export function formatAuditRole(role: string | null | undefined): string {
  return role ? roleLabels[role] ?? "—" : "—";
}

const emailTemplateLabels: Record<string, string> = {
  ADVISOR_EMAIL_VERIFICATION: "אימות כתובת דוא״ל",
  ADVISOR_PASSWORD_RESET: "איפוס סיסמה",
  SMTP_CONFIGURATION_TEST: "בדיקת הגדרת דוא״ל",
  LENDER_INITIAL: "הזמנה לחברת מימון",
  LENDER_REMINDER: "תזכורת לחברת מימון",
  LENDER_DECISION: "אישור החלטה לחברת המימון",
  LENDER_INTERESTED: "אישור התעניינות לחברת המימון",
  LENDER_NOT_INTERESTED: "אישור תשובה שלילית לחברת המימון",
  OTP: "קוד אימות",
  INTEREST_OTP: "קוד אימות להתעניינות",
  PORTAL_OTP: "קוד כניסה לפורטל",
  FULL_ACCESS: "פתיחת גישה מלאה",
  ADVISOR_DECISION: "עדכון ליועץ על תשובת חברה",
  ADVISOR_DELIVERY_FAILURE: "עדכון ליועץ על כשל שליחה",
  ADVISOR_EXPIRY: "עדכון ליועץ על תום מועד מענה",
  ADVISOR_REGISTERED: "יועץ חדש נרשם (למנהל)",
  SUPER_ADMIN_ADVISOR_REGISTERED: "יועץ חדש נרשם (למנהל)",
  SUPER_ADMIN_CASE_CREATED: "תיק חדש נוצר (למנהל)",
  SUPER_ADMIN_LENDER_INTERESTED: "חברת מימון התעניינה (למנהל)",
  DECISION_CONFIRMATION: "אישור תגובת חברה",
  ADVISOR_NOTIFICATION: "התראה ליועץ"
};

const outboxStatusLabels: Record<string, string> = {
  PENDING: "ממתין לשליחה", PROCESSING: "בשליחה", SENT: "נשלח לשרת הדואר", FAILED: "השליחה נכשלה", CANCELLED: "בוטל"
};

export function formatEmailTemplate(template: string | null | undefined): string {
  return template ? emailTemplateLabels[template] ?? "הודעת מערכת" : "הודעת מערכת";
}

export function formatOutboxStatus(status: string | null | undefined): string {
  return status ? outboxStatusLabels[status] ?? status : "—";
}
