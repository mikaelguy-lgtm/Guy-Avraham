import { useEffect, useState } from "react";
import type { AdvisorAdminRecord } from "../types";
import { api } from "../utils/apiClient";
import { formatDate, formatUserStatus } from "../utils/formatters";

export default function AdminAdvisorsView() {
  const [advisors, setAdvisors] = useState<AdvisorAdminRecord[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorAdminRecord | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => setAdvisors(await api.adminAdvisors());

  useEffect(() => { void load(); }, []);

  const updateStatus = async (advisor: AdvisorAdminRecord, status: "ACTIVE" | "SUSPENDED" | "DISABLED") => {
    setBusy(advisor.id);
    setMessage("");
    try {
      await api.updateAdvisorStatus(advisor.id, status);
      await load();
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
      setMessage("מייל האימות נשלח מחדש.");
    } catch {
      setMessage("לא ניתן לשלוח כעת מייל אימות נוסף.");
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
      </section>
      {message && <p className={message.includes("לא ניתן") ? "form-message error" : "form-message success"} role="status">{message}</p>}
      <section className="advisor-admin-grid">
        {advisors.map((advisor) => <article className="content-card advisor-admin-card" key={advisor.id}>
          <header>
            <div><h2>{advisor.firstName} {advisor.lastName}</h2><p>{advisor.businessName || "ללא שם חברה"}</p></div>
            <span className={`status-badge status-${advisor.status.toLowerCase()}`}>{formatUserStatus(advisor.status)}</span>
          </header>
          <dl>
            <div><dt>דוא״ל</dt><dd>{advisor.email}</dd></div>
            <div><dt>טלפון</dt><dd>{advisor.phone}</dd></div>
            <div><dt>אימות דוא״ל</dt><dd>{advisor.emailVerified ? "אומת" : "טרם אומת"}</dd></div>
            <div><dt>תאריך הרשמה</dt><dd>{formatDate(advisor.createdAt)}</dd></div>
            <div><dt>פעילות אחרונה</dt><dd>{advisor.lastLoginAt ? formatDate(advisor.lastLoginAt) : "טרם התחבר"}</dd></div>
          </dl>
          <div className="advisor-admin-actions">
            <button className="ghost-action" onClick={() => setSelectedAdvisor(advisor)}>צפייה בפרופיל</button>
            {advisor.status !== "ACTIVE" && <button className="primary-action" disabled={busy === advisor.id || !advisor.emailVerified} onClick={() => void updateStatus(advisor, "ACTIVE")}>הפעלה</button>}
            {advisor.status === "ACTIVE" && <button className="secondary-action" disabled={busy === advisor.id} onClick={() => void updateStatus(advisor, "SUSPENDED")}>השעיה</button>}
            {advisor.status !== "DISABLED" && <button className="secondary-action danger" disabled={busy === advisor.id} onClick={() => void updateStatus(advisor, "DISABLED")}>השבתה</button>}
            {!advisor.emailVerified && <button className="ghost-action" disabled={busy === advisor.id} onClick={() => void resend(advisor)}>שליחת אימות מחדש</button>}
          </div>
        </article>)}
      </section>
    </main>
    {selectedAdvisor && <div className="modal-backdrop" role="presentation">
      <section className="modal content-card" role="dialog" aria-modal="true" aria-labelledby="advisor-profile-title">
        <div className="modal-heading">
          <div><span className="eyebrow">פרופיל יועץ</span><h2 id="advisor-profile-title">{selectedAdvisor.firstName} {selectedAdvisor.lastName}</h2></div>
          <button className="icon-action" aria-label="סגירת פרופיל" onClick={() => setSelectedAdvisor(null)}>×</button>
        </div>
        <dl className="advisor-profile-details">
          <div><dt>דוא״ל</dt><dd>{selectedAdvisor.email}</dd></div>
          <div><dt>טלפון</dt><dd>{selectedAdvisor.phone}</dd></div>
          <div><dt>חברה או משרד</dt><dd>{selectedAdvisor.businessName}</dd></div>
          <div><dt>סטטוס</dt><dd>{formatUserStatus(selectedAdvisor.status)}</dd></div>
          <div><dt>אימות דוא״ל</dt><dd>{selectedAdvisor.emailVerified ? "אומת" : "טרם אומת"}</dd></div>
          <div><dt>תאריך הרשמה</dt><dd>{formatDate(selectedAdvisor.createdAt)}</dd></div>
          <div><dt>פעילות אחרונה</dt><dd>{selectedAdvisor.lastLoginAt ? formatDate(selectedAdvisor.lastLoginAt) : "טרם התחבר"}</dd></div>
        </dl>
      </section>
    </div>}
  </>;
}
