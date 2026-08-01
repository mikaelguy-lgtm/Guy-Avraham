import {useEffect, useMemo, useState} from "react";
import type {AdminEmailLogRecord} from "../types";
import {api} from "../utils/apiClient";
import {formatIsraelDateTime} from "../utils/formatters";

const templateLabel = (template: string | null) => ({
  ADVISOR_EMAIL_VERIFICATION: "אימות כתובת דוא״ל",
  SMTP_CONFIGURATION_TEST: "בדיקת הגדרת דוא״ל",
  LENDER_INITIAL: "הזמנה לחברת מימון",
  LENDER_REMINDER: "תזכורת לחברת מימון",
  INTEREST_OTP: "קוד אימות להתעניינות",
  PORTAL_OTP: "קוד כניסה לפורטל",
  FULL_ACCESS: "פתיחת גישה מלאה",
  DECISION_CONFIRMATION: "אישור תגובת חברה",
  ADVISOR_NOTIFICATION: "התראה ליועץ"
})[template ?? ""] ?? "הודעת מערכת";

const smtpStatus = (status: string) => status === "SENT" ? "נשלח לשרת הדואר" : status === "FAILED" ? "השליחה נכשלה" : "ממתין לשליחה";

export default function AdminEmailLogsView() {
  const [logs, setLogs] = useState<AdminEmailLogRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void api.adminEmailLogs().then(setLogs).catch(() => setError("לא ניתן לטעון את יומן הדוא״ל.")); }, []);
  const filtered = useMemo(() => logs.filter((log) => (!status || log.status === status) && (!query || `${log.recipientMasked} ${templateLabel(log.template)} ${log.requestId ?? ""}`.includes(query))), [logs, query, status]);

  return <main className="admin-page">
    <section className="page-title"><div><span className="eyebrow">בקרה תפעולית</span><h1>יומן דוא״ל</h1><p>סטטוס SMTP מסונן. “נשלח לשרת הדואר” אינו אישור מסירה לתיבה.</p></div></section>
    <p className="security-note">אם הודעה אינה מופיעה בתוך כמה דקות, יש לבקש מהנמען לבדוק גם ספאם, דואר זבל וקידומי מכירות.</p>
    {error && <p className="form-message error">{error}</p>}
    <section className="content-card"><div className="admin-filters"><input aria-label="חיפוש ביומן דוא״ל" placeholder="חיפוש לפי נמען מוסתר, סוג או מזהה בקשה" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="סינון סטטוס דוא״ל" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">כל הסטטוסים</option><option value="SENT">נשלח לשרת הדואר</option><option value="FAILED">נכשל</option></select></div>
      <div className="responsive-table"><table><thead><tr><th>סוג הודעה</th><th>נמען</th><th>נוצרה</th><th>ניסיון אחרון</th><th>סטטוס SMTP</th><th>ניסיונות</th><th>שליחה מחדש</th><th>סיבת כשל</th><th>מזהה בקשה</th></tr></thead><tbody>{filtered.map((log, index) => <tr key={`${log.requestId ?? "email"}-${log.createdAt}-${index}`}><td>{templateLabel(log.template)}</td><td>{log.recipientMasked}</td><td>{formatIsraelDateTime(log.createdAt)}</td><td>{formatIsraelDateTime(log.sentAt ?? log.failedAt ?? log.createdAt)}</td><td>{smtpStatus(log.status)}</td><td>{log.attempts}</td><td>{log.resent ? "כן" : "לא"}</td><td>{log.sanitizedError ?? "—"}</td><td><small>{log.requestId ?? "—"}</small></td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
