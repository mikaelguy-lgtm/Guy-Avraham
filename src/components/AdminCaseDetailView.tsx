import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, X } from "lucide-react";
import type { AdminCaseDetail } from "../types";
import { api } from "../utils/apiClient";
import { caseStageLabels, formatClientStatus, formatCurrency, formatDealType, formatDocumentType, formatFileSize, formatIsraelDateTime } from "../utils/formatters";

const decisionLabel: Record<string, string> = {
  PENDING: "ממתין", PENDING_VERIFICATION: "ממתין לאימות", INTERESTED: "מעוניינת", NOT_INTERESTED: "לא מעוניינת", EXPIRED: "פג ללא מענה", CANCELLED: "בוטל"
};

export default function AdminCaseDetailView() {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<AdminCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // ClientEditView (reused verbatim for admin case editing) navigates back
  // here with {state: {toast: "..."}} exactly like it does for the advisor's
  // own ClientDetailView — read the toast the same way, and re-fetch since
  // location.key changes on every navigation (even a same-path replace)
  // while the :id param does not.
  const [toast, setToast] = useState<string | null>(() => (location.state as {toast?: string} | null)?.toast ?? null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true); setError("");
    void api.adminCaseDetail(Number(id))
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch(() => { if (!cancelled) setError("לא ניתן לטעון את התיק."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, location.key]);

  useEffect(() => {
    if (!toast) return;
    navigate(location.pathname, {replace: true, state: null});
  }, [location.pathname, navigate, toast]);

  if (loading) return <main className="admin-page"><div className="empty-state">טוען תיק…</div></main>;
  if (error || !detail) return <main className="admin-page"><div className="empty-state">{error || "התיק לא נמצא."}</div></main>;

  return <main className="admin-page case-detail-page">
    {toast && <div className="toast success" role="status"><strong>{toast}</strong><button type="button" aria-label="סגירת הודעה" onClick={() => setToast(null)}><X size={16} /></button></div>}
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><Link to="/admin/cases">תיקים</Link><span>›</span><span aria-current="page">{detail.publicCaseNumber}</span></nav>

    <section className="panel"><header className="section-heading compact"><div><span className="eyebrow">תיק {detail.publicCaseNumber}</span><h1>{detail.property.city} · {formatDealType(detail.loanRequest.purpose)}</h1><p>יועץ: {detail.advisor.name} · {detail.advisor.email}</p></div><div className="header-actions"><span className={`status-badge status-${detail.caseStage.toLowerCase()}`}>{caseStageLabels[detail.caseStage] ?? formatClientStatus(detail.caseStage)}</span><Link to={`/admin/cases/${detail.id}/edit`} className="secondary-button">עריכת תיק</Link></div></header>

      {detail.status === "SUBMITTED" && <p className="submitted-edit-warning" role="note"><AlertTriangle size={18} aria-hidden="true" />השינויים יחולו על התיק הנוכחי בלבד ואינם משנים גרסאות שכבר נשלחו לחברות המימון.</p>}

      {detail.readiness && (detail.readiness.ready
        ? <p className="status-badge status-ready" style={{justifySelf: "start"}}><CheckCircle2 size={15} /> התיק מוכן לשליחה לחברות מימון</p>
        : <div className="delivery-blockers-list"><strong>חסרים בתיק:</strong><ul>{detail.readiness.blockers.map((blocker) => <li key={blocker.code}><span><strong>{blocker.label}</strong><small>{blocker.hint}</small></span></li>)}</ul></div>)}

      <dl className="company-stat-row">
        <div><small>סכום מבוקש</small><strong>{formatCurrency(detail.loanRequest.requestedAmount)}</strong></div>
        <div><small>שווי נכס</small><strong>{formatCurrency(detail.property.value)}</strong></div>
        <div><small>אחוז מימון</small><strong>{detail.loanRequest.loanToValue}%</strong></div>
        <div><small>עודכן לאחרונה</small><strong>{formatIsraelDateTime(detail.updatedAt)}</strong></div>
      </dl>
    </section>

    <section className="panel"><header className="section-heading compact"><div><h2>מסמכים</h2></div></header>
      {detail.documents.length === 0 ? <div className="empty-state">אין מסמכים בתיק.</div> : <ul className="document-list">{detail.documents.map((document) => <li key={document.id}><FileText size={17} aria-hidden="true" /><span>{document.customTitle || formatDocumentType(document.documentType)}</span><small>{formatFileSize(document.sizeBytes)} · {formatIsraelDateTime(document.createdAt)}</small></li>)}</ul>}
    </section>

    <section className="panel"><header className="section-heading compact"><div><h2>שליחות לחברות מימון</h2></div></header>
      {detail.submissions.length === 0 ? <div className="empty-state">התיק טרם נשלח לאף חברת מימון.</div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>חברה</th><th>נשלח</th><th>סטטוס מסירה</th><th>החלטה</th><th>Deadline</th><th>הוחלט</th></tr></thead>
        <tbody>{detail.submissions.map((submission) => <tr key={submission.id}><td>{submission.companyName}</td><td>{formatIsraelDateTime(submission.createdAt)}</td><td>{submission.deliveryStatus}</td><td>{decisionLabel[submission.decisionStatus] ?? submission.decisionStatus}</td><td>{formatIsraelDateTime(submission.responseDeadlineAt)}</td><td>{submission.decisionAt ? formatIsraelDateTime(submission.decisionAt) : "—"}</td></tr>)}</tbody>
      </table></div>}
    </section>

    <section className="panel"><header className="section-heading compact"><div><h2>ציר זמן</h2></div></header>
      {detail.timeline.length === 0 ? <div className="empty-state">אין אירועים לתיק זה.</div> : <ul className="timeline">{detail.timeline.map((event, index) => <li key={index}><span /><div><strong>{event.type}</strong><p>{formatIsraelDateTime(event.createdAt)} · {event.actorType}</p></div></li>)}</ul>}
    </section>

    <section className="panel"><header className="section-heading compact"><div><h2>היסטוריית דוא״ל</h2><p>מיילים שנקשרו לתיק זה בפועל בלבד (דרך שליחה/הזמנה), לא לפי כתובת נמען.</p></div></header>
      {detail.emailHistory.length === 0 ? <div className="empty-state">אין היסטוריית דוא״ל לתיק זה.</div> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>תבנית</th><th>נמען</th><th>סטטוס</th><th>נשלח</th></tr></thead>
        <tbody>{detail.emailHistory.map((email) => <tr key={email.id}><td>{email.template}</td><td dir="ltr">{email.recipientMasked}</td><td>{email.status}</td><td>{email.sentAt ? formatIsraelDateTime(email.sentAt) : "—"}</td></tr>)}</tbody>
      </table></div>}
    </section>

    <section className="panel"><header className="section-heading compact"><div><h2>גרסאות תיק (Immutable)</h2><p>עותקים בלתי ניתנים לשינוי שנוצרו בכל שליחה — עריכת התיק החי אינה משפיעה עליהם.</p></div></header>
      {detail.versions.length === 0 ? <div className="empty-state">לא נוצרה עדיין אף גרסת תיק.</div> : <ul className="calendar-list">{detail.versions.map((version) => <li key={version.id}><span>גרסה {version.versionNumber}</span><span>{version.status}</span><span>{formatIsraelDateTime(version.createdAt)}</span></li>)}</ul>}
    </section>
  </main>;
}
