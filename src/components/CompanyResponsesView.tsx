import {useCallback, useEffect, useState} from "react";
import {Building2, Clock3, Download, Eye, MailCheck, ShieldCheck, X} from "lucide-react";
import type {CompanyResponse} from "../types";
import {api, subscribeDeliveryEvents} from "../utils/apiClient";
import {formatDate} from "../utils/formatters";

const deliveryLabel: Record<string, string> = {PENDING: "ממתין", QUEUED: "בתור לשליחה", PARTIALLY_SENT: "נשלח חלקית", SENT: "נשלח לשרת הדואר", FAILED: "שליחה נכשלה"};
const decisionLabel: Record<string, string> = {PENDING: "ממתינה לתגובה", PENDING_VERIFICATION: "ממתינה לאימות", INTERESTED: "מעוניינת", NOT_INTERESTED: "לא מעוניינת", EXPIRED: "פג תוקף", CANCELLED: "בוטלה"};
const accessLabel: Record<string, string> = {NONE: "ללא גישה", ACTIVE: "גישה מלאה פעילה", EXPIRED: "הגישה פגה", REVOKED: "הגישה בוטלה"};
const eventLabel: Record<string, string> = {
  SUBMISSION_CREATED: "נוצרה שליחה", EMAIL_QUEUED: "הודעה הוכנסה לתור", EMAIL_SENT: "הודעה נשלחה לשרת הדואר", EMAIL_FAILED: "שליחת הודעה נכשלה",
  REVIEW_LINK_OPENED: "קישור הבדיקה נפתח", MASKED_PDF_VIEWED: "נצפה PDF מוסווה", MASKED_PDF_DOWNLOADED: "הורד PDF מוסווה", REMINDER_SENT: "נשלחה תזכורת",
  INTEREST_DECISION_STARTED: "החל תהליך בחירת מעוניינים", OTP_SENT: "נשלח קוד חד־פעמי", OTP_FAILED: "אימות הקוד נכשל", OTP_VERIFIED: "הקוד אומת",
  COMPANY_INTERESTED: "החברה מעוניינת", COMPANY_NOT_INTERESTED: "החברה אינה מעוניינת", COMPANY_RESPONSE_EXPIRED: "מועד התגובה פג", FULL_ACCESS_GRANTED: "נפתחה גישה מלאה",
  FULL_ACCESS_OPENED: "הפורטל המלא נפתח", FULL_PDF_VIEWED: "נצפה PDF מלא", FULL_PDF_DOWNLOADED: "הורד PDF מלא", DOCUMENT_VIEWED: "נצפה מסמך", DOCUMENT_DOWNLOADED: "הורד מסמך", FULL_CASE_ZIP_DOWNLOADED: "הורד תיק מלא"
};

export default function CompanyResponsesView({clientId}: {clientId: number}) {
  const [items, setItems] = useState<CompanyResponse[]>([]);
  const [selected, setSelected] = useState<CompanyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setItems(await api.companyResponses(clientId)); setError(""); }
    catch { setError("לא ניתן לטעון את תגובות חברות המימון."); }
    finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => {void load();}, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void subscribeDeliveryEvents(controller.signal, () => void load()).catch(() => undefined);
    return () => controller.abort();
  }, [load]);
  const openTimeline = async (item: CompanyResponse) => {
    try { setSelected(await api.companyResponse(clientId, item.publicId)); }
    catch { setError("לא ניתן לטעון את ציר הזמן."); }
  };
  if (loading) return <div className="empty-state">טוען תגובות חברות…</div>;
  return <div className="detail-section company-responses"><header className="section-heading compact"><div><h2>תגובות חברות</h2><p>סטטוס SMTP, החלטה וגישה מלאה לכל גרסת תיק שנשלחה. “נשלח לשרת הדואר” אינו אישור מסירה לתיבה; מומלץ לנמען לבדוק גם ספאם, דואר זבל וקידומי מכירות.</p></div></header>
    {error && <p className="form-message error" role="alert">{error}</p>}
    {!items.length ? <div className="empty-state"><Building2 /><h3>טרם נשלח תיק לחברות מימון</h3><p>לאחר השליחה יופיעו כאן פתיחות, הורדות והחלטות בזמן אמת.</p></div> : <div className="response-card-grid">{items.map((item) => <article className="response-card" key={item.publicId}>
      <header><span className="lender-logo"><Building2 /></span><div><h3>{item.companyName}</h3><small>גרסה {item.versionNumber}</small></div><span className={`status-badge decision-${item.decisionStatus.toLowerCase()}`}>{decisionLabel[item.decisionStatus] ?? "ממתינה"}</span></header>
      <dl><div><dt><MailCheck />מצב שליחה</dt><dd>{deliveryLabel[item.deliveryStatus] ?? item.deliveryStatus}</dd></div><div><dt><Clock3 />מועד אחרון</dt><dd>{formatDate(item.responseDeadlineAt)}</dd></div><div><dt><ShieldCheck />גישה מלאה</dt><dd>{accessLabel[item.accessStatus] ?? item.accessStatus}</dd></div></dl>
      <div className="response-metrics"><span><Eye />{item.openedCount} פתיחות</span><span><Eye />{item.viewedCount} צפיות</span><span><Download />{item.downloadedCount} הורדות</span></div>
      {item.decisionContact && <p className="decision-contact"><strong>איש הקשר שהגיב:</strong> {item.decisionContact.name} · {item.decisionContact.role}</p>}
      <button type="button" className="secondary-action" onClick={() => void openTimeline(item)}>צפייה בציר הזמן</button>
    </article>)}</div>}
    {selected && <div className="modal-backdrop"><section className="modal content-card timeline-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-title"><header className="modal-heading"><div><span className="eyebrow">{selected.companyName}</span><h2 id="timeline-title">ציר זמן השליחה</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setSelected(null)}><X /></button></header><ol className="submission-timeline">{selected.timeline?.map((event, index) => <li key={`${event.createdAt}-${index}`}><span /><div><strong>{eventLabel[event.type] ?? "אירוע מערכת"}</strong><time>{formatDate(event.createdAt)}</time></div></li>)}</ol></section></div>}
  </div>;
}
