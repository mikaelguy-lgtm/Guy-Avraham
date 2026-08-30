import { useCallback, useEffect, useState } from "react";
import type { AdvisorAdminRecord, LegalDocumentAcceptanceRecord, UserAuditEvent } from "../types";
import { ApiError, api } from "../utils/apiClient";
import { emailServerAcceptedMessage, formatDate, formatUserStatus } from "../utils/formatters";

const auditActionLabel: Record<string, string> = {
  USER_UPDATED: "פרטי המשתמש עודכנו",
  USER_ENABLED: "המשתמש הופעל",
  USER_SUSPENDED: "המשתמש הושעה",
  USER_DISABLED: "המשתמש הושבת",
  USER_ARCHIVED: "המשתמש נמחק (ארכיון)",
  USER_RESTORED: "המשתמש שוחזר מהארכיון",
  PASSWORD_RESET_REQUESTED_BY_ADMIN: "נשלח קישור לאיפוס סיסמה על ידי מנהל",
  EMAIL_VERIFICATION_RESENT: "מייל אימות דוא״ל נשלח מחדש",
  EMAIL_VERIFICATION_SENT: "נשלח מייל אימות דוא״ל"
};

interface EditForm { firstName: string; lastName: string; phone: string; businessName: string }

export default function AdminAdvisorsView() {
  const [advisors, setAdvisors] = useState<AdvisorAdminRecord[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorAdminRecord | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState<{advisorId: number; availableAt: number} | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [emailForm, setEmailForm] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<UserAuditEvent[]>([]);
  const [acceptances, setAcceptances] = useState<LegalDocumentAcceptanceRecord[]>([]);
  const load = useCallback(async () => setAdvisors(await api.adminAdvisors(includeArchived)), [includeArchived]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  const openProfile = async (advisor: AdvisorAdminRecord) => {
    setSelectedAdvisor(advisor); setEditForm(null); setEmailForm(null); setMessage("");
    const [events, acceptanceHistory] = await Promise.all([api.adminAdvisorAuditEvents(advisor.id), api.adminAdvisorLegalAcceptances(advisor.id)]);
    setAuditEvents(events); setAcceptances(acceptanceHistory);
  };

  const refreshSelected = async (advisor: AdvisorAdminRecord) => {
    setSelectedAdvisor(advisor);
    const events = await api.adminAdvisorAuditEvents(advisor.id);
    setAuditEvents(events);
  };

  const updateStatus = async (advisor: AdvisorAdminRecord, status: "ACTIVE" | "SUSPENDED" | "DISABLED") => {
    let reason: string | undefined;
    if (status === "DISABLED") {
      const input = window.prompt("סיבת ההשבתה (אופציונלי):", "");
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    setBusy(advisor.id); setMessage("");
    try {
      const updated = await api.updateAdvisorStatus(advisor.id, status, reason);
      await load();
      if (selectedAdvisor?.id === advisor.id) await refreshSelected(updated);
      setMessage("סטטוס היועץ עודכן בהצלחה.");
    } catch {
      setMessage("לא ניתן לעדכן את סטטוס היועץ. הפעלה אפשרית רק לאחר אימות דוא״ל.");
    } finally {
      setBusy(null);
    }
  };

  const resend = async (advisor: AdvisorAdminRecord) => {
    setBusy(advisor.id);
    setMessage("");
    try {
      await api.adminResendAdvisorVerification(advisor.id);
      setResendCooldown({advisorId: advisor.id, availableAt: Date.now() + 60_000});
      setMessage(emailServerAcceptedMessage(advisor.email));
    } catch {
      setMessage("לא ניתן לשלוח כעת מייל אימות נוסף.");
    } finally {
      setBusy(null);
    }
  };

  const sendPasswordReset = async (advisor: AdvisorAdminRecord) => {
    setBusy(advisor.id); setMessage("");
    try {
      await api.adminSendAdvisorPasswordReset(advisor.id);
      setMessage(`נשלח קישור לאיפוס סיסמה אל ${advisor.email}.`);
      if (selectedAdvisor?.id === advisor.id) await refreshSelected(advisor);
    } catch {
      setMessage("לא ניתן לשלוח כעת קישור לאיפוס סיסמה.");
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    if (!selectedAdvisor || !editForm) return;
    setBusy(selectedAdvisor.id); setMessage("");
    try {
      const updated = await api.adminUpdateAdvisorProfile(selectedAdvisor.id, editForm);
      setSelectedAdvisor(updated); setEditForm(null);
      await load();
      setMessage("פרטי היועץ עודכנו בהצלחה.");
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.publicMessage ?? "עדכון הפרטים נכשל." : "עדכון הפרטים נכשל.");
    } finally {
      setBusy(null);
    }
  };

  const saveEmail = async () => {
    if (!selectedAdvisor || emailForm === null) return;
    if (!window.confirm(`לשנות את כתובת הדוא״ל ל-${emailForm}? היועץ יידרש לאמת מחדש את הכתובת החדשה.`)) return;
    setBusy(selectedAdvisor.id); setMessage("");
    try {
      const updated = await api.adminUpdateAdvisorEmail(selectedAdvisor.id, emailForm);
      setSelectedAdvisor(updated); setEmailForm(null);
      await load();
      setMessage("כתובת הדוא״ל עודכנה בהצלחה. נשלח מייל אימות לכתובת החדשה.");
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.publicMessage ?? "עדכון כתובת הדוא״ל נכשל." : "עדכון כתובת הדוא״ל נכשל.");
    } finally {
      setBusy(null);
    }
  };

  const archive = async (advisor: AdvisorAdminRecord) => {
    const input = window.prompt("המשתמש יוסר מגישה למערכת. תיקים, מסמכים ורישומי Audit לא יימחקו.\n\nסיבה (אופציונלי):", "");
    if (input === null) return;
    if (!window.confirm("לאשר מחיקת המשתמש (ארכוב)? הפעולה הפיכה על ידי שחזור.")) return;
    setBusy(advisor.id); setMessage("");
    try {
      await api.adminArchiveAdvisor(advisor.id, input.trim() || undefined);
      await load();
      setSelectedAdvisor(null);
      setMessage("המשתמש הועבר לארכיון.");
    } catch {
      setMessage("מחיקת המשתמש נכשלה.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (advisor: AdvisorAdminRecord) => {
    setBusy(advisor.id); setMessage("");
    try {
      const updated = await api.adminRestoreAdvisor(advisor.id);
      await load();
      setSelectedAdvisor(updated);
      setMessage("המשתמש שוחזר בהצלחה.");
    } catch {
      setMessage("שחזור המשתמש נכשל.");
    } finally {
      setBusy(null);
    }
  };

  return <>
    <main className="admin-page">
      <section className="panel">
        <span className="eyebrow">ניהול הרשמות</span>
        <h1>יועצי משכנתאות</h1>
        <p>ניהול סטטוס, אימות ופרטי החשבון המקצועי של יועצי SynCash.</p>
        <label className="check-list"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />הצגת משתמשים בארכיון</label>
      </section>
      {message && <p className={message.includes("לא ניתן") || message.includes("נכשל") ? "form-message error" : "form-message success"} role="status">{message}</p>}
      <section className="advisor-admin-grid">
        {advisors.map((advisor) => <article className={`content-card advisor-admin-card${advisor.archivedAt ? " archived" : ""}`} key={advisor.id}>
          <header>
            <div><h2>{advisor.firstName} {advisor.lastName}</h2><p>{advisor.businessName || "ללא שם חברה"}</p></div>
            <span className={`status-badge status-${advisor.status.toLowerCase()}`}>{advisor.archivedAt ? "בארכיון" : formatUserStatus(advisor.status)}</span>
          </header>
          <dl>
            <div><dt>דוא״ל</dt><dd>{advisor.email}</dd></div>
            <div><dt>טלפון</dt><dd>{advisor.phone}</dd></div>
            <div><dt>אימות דוא״ל</dt><dd>{advisor.emailVerified ? "אומת" : "טרם אומת"}</dd></div>
            <div><dt>תאריך הרשמה</dt><dd>{formatDate(advisor.createdAt)}</dd></div>
            <div><dt>פעילות אחרונה</dt><dd>{advisor.lastLoginAt ? formatDate(advisor.lastLoginAt) : "טרם התחבר"}</dd></div>
          </dl>
          <div className="advisor-admin-actions">
            <button className="ghost-action" onClick={() => void openProfile(advisor)}>צפייה בפרופיל</button>
            {!advisor.archivedAt && <>
              {advisor.status !== "ACTIVE" && <button className="primary-action" disabled={busy === advisor.id || !advisor.emailVerified} onClick={() => void updateStatus(advisor, "ACTIVE")}>הפעלה</button>}
              {advisor.status === "ACTIVE" && <button className="secondary-action" disabled={busy === advisor.id} onClick={() => void updateStatus(advisor, "SUSPENDED")}>השעיה</button>}
              {advisor.status !== "DISABLED" && <button className="secondary-action danger" disabled={busy === advisor.id} onClick={() => void updateStatus(advisor, "DISABLED")}>השבתה</button>}
              {!advisor.emailVerified && <button className="ghost-action" disabled={busy === advisor.id || (resendCooldown?.advisorId === advisor.id && resendCooldown.availableAt > now)} onClick={() => void resend(advisor)}>{resendCooldown?.advisorId === advisor.id && resendCooldown.availableAt > now ? `שליחת המייל מחדש בעוד ${Math.ceil((resendCooldown.availableAt - now) / 1000)} שניות` : "שליחת המייל מחדש"}</button>}
            </>}
            {advisor.archivedAt && <button className="primary-action" disabled={busy === advisor.id} onClick={() => void restore(advisor)}>שחזור מהארכיון</button>}
          </div>
        </article>)}
      </section>
    </main>
    {selectedAdvisor && <div className="modal-backdrop" role="presentation">
      <section className="modal content-card advisor-management-modal" role="dialog" aria-modal="true" aria-labelledby="advisor-profile-title">
        <div className="modal-heading">
          <div><span className="eyebrow">פרופיל יועץ</span><h2 id="advisor-profile-title">{selectedAdvisor.firstName} {selectedAdvisor.lastName}</h2></div>
          <button className="icon-action" aria-label="סגירת פרופיל" onClick={() => setSelectedAdvisor(null)}>×</button>
        </div>

        {editForm ? <div className="legal-document-draft-form">
          <div className="responsive-form-grid">
            <label className="form-field"><span>שם פרטי</span><input value={editForm.firstName} onChange={(event) => setEditForm({...editForm, firstName: event.target.value})} /></label>
            <label className="form-field"><span>שם משפחה</span><input value={editForm.lastName} onChange={(event) => setEditForm({...editForm, lastName: event.target.value})} /></label>
            <label className="form-field"><span>טלפון</span><input value={editForm.phone} onChange={(event) => setEditForm({...editForm, phone: event.target.value})} /></label>
            <label className="form-field"><span>חברה או משרד</span><input value={editForm.businessName} onChange={(event) => setEditForm({...editForm, businessName: event.target.value})} /></label>
          </div>
          <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setEditForm(null)}>ביטול</button><button type="button" className="primary-action" disabled={busy === selectedAdvisor.id} onClick={() => void saveProfile()}>שמירה</button></div>
        </div> : <dl className="advisor-profile-details">
          <div><dt>דוא״ל</dt><dd>{selectedAdvisor.email}</dd></div>
          <div><dt>טלפון</dt><dd>{selectedAdvisor.phone}</dd></div>
          <div><dt>חברה או משרד</dt><dd>{selectedAdvisor.businessName}</dd></div>
          <div><dt>סטטוס</dt><dd>{selectedAdvisor.archivedAt ? "בארכיון" : formatUserStatus(selectedAdvisor.status)}</dd></div>
          <div><dt>אימות דוא״ל</dt><dd>{selectedAdvisor.emailVerified ? "אומת" : "טרם אומת"}</dd></div>
          <div><dt>תאריך הרשמה</dt><dd>{formatDate(selectedAdvisor.createdAt)}</dd></div>
          <div><dt>פעילות אחרונה</dt><dd>{selectedAdvisor.lastLoginAt ? formatDate(selectedAdvisor.lastLoginAt) : "טרם התחבר"}</dd></div>
        </dl>}

        {!editForm && !selectedAdvisor.archivedAt && <div className="advisor-admin-actions">
          <button className="secondary-action" onClick={() => setEditForm({firstName: selectedAdvisor.firstName, lastName: selectedAdvisor.lastName, phone: selectedAdvisor.phone, businessName: selectedAdvisor.businessName})}>עריכת פרטים</button>
          <button className="secondary-action" onClick={() => setEmailForm(selectedAdvisor.email)}>שינוי כתובת דוא״ל</button>
          <button className="secondary-action" disabled={busy === selectedAdvisor.id} onClick={() => void sendPasswordReset(selectedAdvisor)}>שליחת קישור לאיפוס סיסמה</button>
          <button className="secondary-action danger" disabled={busy === selectedAdvisor.id} onClick={() => void archive(selectedAdvisor)}>מחיקת משתמש (ארכוב)</button>
        </div>}

        {emailForm !== null && <div className="legal-document-draft-form">
          <label className="form-field"><span>כתובת דוא״ל חדשה</span><input type="email" value={emailForm} onChange={(event) => setEmailForm(event.target.value)} /></label>
          <p className="field-hint">היועץ יידרש לאמת מחדש את הכתובת החדשה לפני שיוכל להמשיך להשתמש במערכת.</p>
          <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setEmailForm(null)}>ביטול</button><button type="button" className="primary-action" disabled={busy === selectedAdvisor.id} onClick={() => void saveEmail()}>עדכון כתובת</button></div>
        </div>}

        <h3>אישורי תנאי שימוש</h3>
        {acceptances.length === 0 ? <p className="empty-inline">לא נמצאו רישומי אישור עבור משתמש זה.</p> : <div className="responsive-table"><table><thead><tr><th>מסמך</th><th>גרסה</th><th>אושר בתאריך</th><th>סטטוס הגרסה כיום</th></tr></thead>
          <tbody>{acceptances.map((acceptance) => <tr key={`${acceptance.documentType}-${acceptance.versionId}`}><td>{acceptance.documentType === "TERMS" ? "תנאי שימוש" : "מדיניות פרטיות"}</td><td>v{acceptance.versionNumber}</td><td>{formatDate(acceptance.acceptedAt)}</td><td>{acceptance.status === "PUBLISHED" ? "פעילה" : acceptance.status === "ARCHIVED" ? "בארכיון" : "טיוטה"}</td></tr>)}</tbody>
        </table></div>}

        <h3>יומן פעולות</h3>
        {auditEvents.length === 0 ? <p className="empty-inline">אין רישומי פעולות עבור משתמש זה.</p> : <ul className="submission-timeline">{auditEvents.map((event, index) => <li key={`${event.action}-${index}`}><span /><div><strong>{auditActionLabel[event.action] ?? event.action}</strong><time>{formatDate(event.createdAt)}</time>{Boolean(event.metadata?.reason) && <small>סיבה: {String(event.metadata?.reason)}</small>}</div></li>)}</ul>}
      </section>
    </div>}
  </>;
}
