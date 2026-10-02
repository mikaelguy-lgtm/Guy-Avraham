# מודל נתונים — מסירת תיקים לחברות מימון

## ישויות חדשות

| טבלה | תפקיד | הגנות עיקריות |
| --- | --- | --- |
| `lender_contacts` | אנשי קשר רבים לכל חברת מימון | Soft delete, מייל מנורמל וייחודי בתוך חברה, סטטוס פעיל ואיש קשר ראשי. |
| `business_calendar_exceptions` | חריגי חגים וימי עבודה | תאריך ייחודי, מקור ויוצר השינוי. |
| `delivery_batches` | פעולת שליחה אחת של יועץ | `idempotency_key` ייחודי לכל יועץ. |
| `case_versions` | גרסת תיק קבועה | Snapshot מלא מוצפן, Snapshot מוסווה, hashes ומפתחות אובייקטים פרטיים. |
| `case_version_documents` | מסמכי הגרסה | עותק immutable, checksum, MIME, גודל ושם עסקי. |
| `company_submissions` | מצב החברה מול גרסת תיק | מצבי מסירה, החלטה וגישה נפרדים; ייחודיות של גרסה וחברה. |
| `submission_contact_invitations` | הזמנה אישית | Token hash, פקיעה, פתיחות, צפיות, הורדות ותזכורות. |
| `company_portal_access_grants` | הרשאת שבעה ימים לאיש קשר | Access token hash, תפוגה וביטול מיידי. |
| `otp_challenges` | אימות החלטה או פורטל | Hash בלבד, single use, ניסיונות, resend ותפוגה. |
| `external_portal_sessions` | Session חיצוני | Session hash, 30 דקות idle, תפוגה וביטול. |
| `submission_events` | Timeline בטוח | מטא־דאטה מסונן, IP hash, Request ID וללא PII/Token/OTP. |
| `email_outbox` | תור הודעות אמין | Idempotency, עד שלושה ניסיונות, backoff וסטטוס SMTP אמיתי. |

## תאימות

הטבלאות `lenders`, `lender_submissions`, `lender_invite_tokens`, `identity_reveal_requests` ו־`loan_offers` אינן נמחקות. אנשי קשר ישנים מועברים ל־`lender_contacts`, והזרימה הישנה נשמרת לתיקים היסטוריים בלבד.

## Enums

- `company_delivery_status`: `PENDING`, `QUEUED`, `PARTIALLY_SENT`, `SENT`, `FAILED`.
- `company_decision_status`: `PENDING`, `PENDING_VERIFICATION`, `INTERESTED`, `NOT_INTERESTED`, `EXPIRED`, `CANCELLED`.
- `company_access_status`: `NONE`, `ACTIVE`, `EXPIRED`, `REVOKED`.
- `contact_invitation_status`, `otp_purpose`, `outbox_status`, `submission_actor_type`, `case_version_status`, `business_calendar_exception_type`.

כל Enum מתורגם לתווית עברית לפני הצגה בממשק.
