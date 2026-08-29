import {useCallback, useEffect, useMemo, useState} from "react";
import {Clock3, Eye, FileText, MailCheck, RefreshCw, ShieldOff, ShieldPlus, X} from "lucide-react";
import type {CompanyResponse} from "../types";
import {api, subscribeDeliveryEvents} from "../utils/apiClient";
import {formatAccessStatus, formatDate, formatDecisionStatus, formatDeliveryEvent, formatDeliveryStatus, formatInvitationStatus} from "../utils/formatters";
import {openFreshPdfBlob} from "../utils/pdfBlob";

const smtpStatusLabel = (status: string) => ({NOT_CREATED: "לא נוצרה הודעה", PENDING: "ממתין לשליחה", PROCESSING: "בתהליך שליחה", SENT: "נשלח לשרת הדואר", FAILED: "השליחה נכשלה", CANCELLED: "בוטל"})[status] ?? "מצב לא ידוע";

export default function AdminCompanySubmissionsView() {
  const [items, setItems] = useState<CompanyResponse[]>([]);
  const [selected, setSelected] = useState<CompanyResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => setItems(await api.adminCompanySubmissions()), []);

  useEffect(() => { void load().catch(() => setError("לא ניתן לטעון שליחות.")); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void subscribeDeliveryEvents(controller.signal, () => void load()).catch(() => undefined);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => (!query || `${item.publicCaseNumber} ${item.companyName} ${item.clientName} ${item.advisorName}`.includes(query)) && (!status || item.decisionStatus === status || item.deliveryStatus === status || item.accessStatus === status)), [items, query, status]);
  const open = async (item: CompanyResponse) => setSelected(await api.adminCompanySubmission(item.publicId));
  const openPdf = async (kind: "masked-pdf" | "full-pdf") => {
    if (!selected) return;
    const filename = `SynCash_תיק_מימון_${kind === "masked-pdf" ? "ראשוני" : "מלא"}_${selected.publicCaseNumber}.pdf`;
    try { openFreshPdfBlob(await api.adminCompanySubmissionPdf(selected.publicId, kind), filename); }
    catch { setError("לא ניתן לפתוח את קובץ ה־PDF."); }
  };
  const action = async (name: string, values: Record<string, unknown> = {}) => {
    if (!selected || !window.confirm("לאשר את הפעולה? הפעולה תירשם ביומן הביקורת.")) return;
    try { setSelected(await api.adminCompanySubmissionAction(selected.publicId, name, values)); await load(); }
    catch { setError("הפעולה נכשלה."); }
  };
  const canResend = selected?.invitations?.some((invitation) => invitation.resendEligible) ?? false;

  return <main className="admin-page">
    <section className="page-title"><div><span className="eyebrow">בקרה תפעולית</span><h1>שליחות לחברות</h1><p>מעקב אחר קבלת SMTP, פתיחות, החלטות וגישה מלאה.</p></div></section>
    {error && <p className="form-message error">{error}</p>}
    <section className="content-card"><div className="admin-filters"><input aria-label="חיפוש שליחות" placeholder="חיפוש לפי תיק, לקוח, יועץ או חברה" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="סינון סטטוס" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">כל הסטטוסים</option><option value="PENDING">ממתינה</option><option value="INTERESTED">מעוניינת</option><option value="NOT_INTERESTED">לא מעוניינת</option><option value="EXPIRED">פג תוקף</option><option value="FAILED">שגיאת שליחה</option><option value="ACTIVE">גישה פעילה</option></select></div><div className="responsive-table"><table><thead><tr><th>תיק</th><th>לקוח</th><th>יועץ</th><th>חברה</th><th>גרסה</th><th>שליחה</th><th>החלטה</th><th>גישה</th><th>מועד אחרון</th><th>פעולות</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.publicId}><td>{item.publicCaseNumber}</td><td>{item.clientName}</td><td>{item.advisorName}</td><td>{item.companyName}</td><td>{item.versionNumber}</td><td>{formatDeliveryStatus(item.deliveryStatus)}</td><td>{formatDecisionStatus(item.decisionStatus)}</td><td>{formatAccessStatus(item.accessStatus)}</td><td>{formatDate(item.responseDeadlineAt)}</td><td><button type="button" className="icon-action" aria-label="צפייה בפרטי השליחה" onClick={() => void open(item)}><Eye /></button></td></tr>)}</tbody></table></div></section>
    {selected && <div className="modal-backdrop"><section className="modal content-card submission-admin-modal"><header className="modal-heading"><div><span className="eyebrow">{selected.companyName}</span><h2>תיק {selected.publicCaseNumber} · גרסה {selected.versionNumber}</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setSelected(null)}><X /></button></header>
      <div className="company-stat-row"><span><strong>{formatDeliveryStatus(selected.deliveryStatus)}</strong> שליחה</span><span><strong>{formatDecisionStatus(selected.decisionStatus)}</strong> החלטה</span><span><strong>{formatAccessStatus(selected.accessStatus)}</strong> גישה</span></div>
      <p className="security-note">סטטוס “נשלח לשרת הדואר” מאשר קבלת SMTP בלבד, ולא מסירה לתיבת הנמען. מומלץ לבדוק גם ספאם, דואר זבל וקידומי מכירות.</p>
      <div className="modal-actions wrap"><button type="button" className="secondary-action" onClick={() => void openPdf("masked-pdf")}><Eye />צפייה ב־PDF הראשוני</button><button type="button" className="secondary-action" onClick={() => void openPdf("full-pdf")}><FileText />צפייה ב־PDF המלא</button></div>
      <h3>אנשי קשר והזמנות</h3><div className="invitation-list detailed">{selected.invitations?.map((invitation) => <article key={invitation.publicId}><MailCheck /><div><strong>{invitation.contactName}</strong><small>{invitation.contactRole} · {invitation.recipientMasked}</small><small>נוצר: {formatDate(invitation.createdAt)} · ניסיון אחרון: {invitation.lastAttemptAt ? formatDate(invitation.lastAttemptAt) : "טרם בוצע"}</small><small>SMTP: {smtpStatusLabel(invitation.smtpStatus)} · ניסיונות: {invitation.attempts} · שליחה מחדש: {invitation.resent ? "כן" : "לא"}</small>{invitation.safeFailureReason && <small>סיבת כשל: {invitation.safeFailureReason}</small>}{invitation.requestId && <small>מזהה בקשה: {invitation.requestId}</small>}</div><span>{formatInvitationStatus(invitation.status)}</span></article>)}</div>
      <h3>ציר זמן</h3><ol className="submission-timeline">{selected.timeline?.map((event, index) => <li key={`${event.createdAt}-${index}`}><span /><div><strong>{formatDeliveryEvent(event.type)}</strong><time>{formatDate(event.createdAt)}</time>{event.requestId && <small>מזהה בקשה: {event.requestId}</small>}</div></li>)}</ol>
      <div className="modal-actions wrap"><button type="button" className="secondary-action" disabled={!canResend} title={!canResend ? "שליחה מחדש זמינה רק לכשל ללא Message ID מוצלח" : undefined} onClick={() => void action("resend-failed")}><RefreshCw />שליחה מחדש לכשלים</button><button type="button" className="secondary-action" onClick={() => void action("send-reminder")}><Clock3 />תזכורת ידנית</button><button type="button" className="secondary-action" onClick={() => void action("reissue")}><MailCheck />הזמנה חדשה</button><button type="button" className="secondary-action" onClick={() => void action("extend-access", {days: 7})}><ShieldPlus />הארכת גישה</button><button type="button" className="danger-action" onClick={() => void action("revoke-access")}><ShieldOff />ביטול גישה</button><button type="button" className="danger-action" onClick={() => void action("cancel-invitation", {reason: "בוטל על ידי מנהל"})}>ביטול הזמנה</button></div>
    </section></div>}
  </main>;
}
