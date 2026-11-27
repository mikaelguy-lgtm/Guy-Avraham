import { z } from "zod";

export const PRIVACY_REQUEST_TYPES = ["VIEW", "CORRECTION", "DELETION", "ACCOUNT_CLOSURE", "OTHER"] as const;
export type PrivacyRequestType = typeof PRIVACY_REQUEST_TYPES[number];

export const PRIVACY_REQUEST_STATUSES = ["NEW", "IN_REVIEW", "IDENTITY_VERIFICATION_REQUIRED", "APPROVED", "REJECTED", "COMPLETED"] as const;
export type PrivacyRequestStatus = typeof PRIVACY_REQUEST_STATUSES[number];

export interface PrivacyRequestRecord {
  id: number;
  requestType: PrivacyRequestType;
  name: string;
  email: string;
  description: string | null;
  status: PrivacyRequestStatus;
  internalNotes: string | null;
  handledByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// טופס ציבורי — ללא התחייבות לחשיפת מידע אישי בחזרה; הבקשה נכנסת ל-workflow
// אדמין בלבד ואינה גוררת שום פעולה אוטומטית על נתונים.
export const privacyRequestSubmitSchema = z.object({
  requestType: z.enum(PRIVACY_REQUEST_TYPES),
  name: z.string().trim().min(2, "יש להזין שם").max(200, "השם ארוך מדי"),
  email: z.string().trim().max(320).email("כתובת דוא״ל אינה תקינה"),
  description: z.string().trim().max(2000, "התיאור ארוך מדי").optional().transform((value) => value || null)
}).strict();

export const privacyRequestUpdateSchema = z.object({
  status: z.enum(PRIVACY_REQUEST_STATUSES),
  internalNotes: z.string().trim().max(4000, "ההערה ארוכה מדי").nullable().optional().transform((value) => value || null)
}).strict();
