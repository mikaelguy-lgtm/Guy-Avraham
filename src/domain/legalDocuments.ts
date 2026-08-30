import { z } from "zod";

export const LEGAL_DOCUMENT_TYPES = ["TERMS", "PRIVACY"] as const;
export type LegalDocumentType = typeof LEGAL_DOCUMENT_TYPES[number];
export type LegalDocumentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface LegalDocumentVersionRecord {
  id: number;
  documentType: LegalDocumentType;
  versionNumber: number;
  status: LegalDocumentStatus;
  title: string;
  content: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  effectiveDate: string | null;
  contentHash: string | null;
  createdByUserId: number;
  publishedByUserId: number | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// עורך פשוט ומבוקר: התוכן הוא טקסט חופשי בלבד (ללא HTML), כך שאין צורך
// ב-sanitizer — React מציג אותו כטקסט תמיד, ולכן script/iframe/HTML לא
// יכולים לרוץ בשום מקרה.
export const legalDocumentDraftSchema = z.object({
  title: z.string().trim().min(2, "יש להזין כותרת").max(200, "הכותרת ארוכה מדי"),
  content: z.string().trim().min(1, "יש להזין תוכן").max(200_000, "התוכן ארוך מדי"),
  contactEmail: z.string().trim().max(320).email("כתובת דוא״ל אינה תקינה").nullable().or(z.literal("")).transform((value) => value || null),
  contactPhone: z.string().trim().max(32).nullable().or(z.literal("")).transform((value) => value || null),
  contactAddress: z.string().trim().max(300).nullable().or(z.literal("")).transform((value) => value || null),
  effectiveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").nullable().or(z.literal("")).transform((value) => value || null)
}).strict();

export const legalDocumentTypeParamSchema = z.enum(LEGAL_DOCUMENT_TYPES);
