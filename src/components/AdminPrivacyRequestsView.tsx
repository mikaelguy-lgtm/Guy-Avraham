import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PRIVACY_REQUEST_STATUSES } from "../domain/privacyRequests";
import type { AdminPrivacyRequest, PrivacyRequestStatus } from "../types";
import { ApiError, api } from "../utils/apiClient";
import { formatIsraelDateTime, formatPrivacyRequestStatus, formatPrivacyRequestType } from "../utils/formatters";

export default function AdminPrivacyRequestsView() {
  const [requests, setRequests] = useState<AdminPrivacyRequest[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminPrivacyRequest | null>(null);
  const [status, setStatus] = useState<PrivacyRequestStatus>("NEW");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.adminPrivacyRequests().then(setRequests).catch(() => setError("לא ניתן לטעון את בקשות הפרטיות."));
  useEffect(() => { void load(); }, []);

  const open = (request: AdminPrivacyRequest) => { setSelected(request); setStatus(request.status); setNotes(request.internalNotes ?? ""); };

  const save = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const updated = await api.adminUpdatePrivacyRequest(selected.id, {status, internalNotes: notes.trim() || null});
      setSelected(updated);
      await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.publicMessage ?? "עדכון הבקשה נכשל." : "עדכון הבקשה נכשל."); }
    finally { setBusy(false); }
  };

  return <main className="admin-page">
    <section className="page-title"><div><span className="eyebrow">הגדרות מערכת</span><h1>בקשות פרטיות</h1><p>בקשות עיון, תיקון, מחיקה וסגירת חשבון שהתקבלו ממרכז המסמכים המשפטיים.</p></div></section>
    {error && <p className="form-message error" role="alert">{error}</p>}
    <section className="content-card">
      <div className="responsive-table"><table><thead><tr><th>מזהה</th><th>סוג בקשה</th><th>שם</th><th>דוא״ל</th><th>התקבלה</th><th>סטטוס</th><th></th></tr></thead>
        <tbody>{requests.map((request) => <tr key={request.id}>
          <td>#{request.id}</td>
          <td>{formatPrivacyRequestType(request.requestType)}</td>
          <td>{request.name}</td>
          <td>{request.email}</td>
          <td>{formatIsraelDateTime(request.createdAt)}</td>
          <td><span className={`status-badge status-${request.status.toLowerCase()}`}>{formatPrivacyRequestStatus(request.status)}</span></td>
          <td><button type="button" className="secondary-action" onClick={() => open(request)}>פתיחה</button></td>
        </tr>)}</tbody>
      </table></div>
      {requests.length === 0 && <p className="empty-inline">לא התקבלו בקשות פרטיות.</p>}
    </section>

    {selected && <div className="modal-backdrop"><section className="modal content-card" role="dialog" aria-modal="true">
      <header className="modal-heading"><div><span className="eyebrow">בקשה #{selected.id}</span><h2>{formatPrivacyRequestType(selected.requestType)}</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setSelected(null)}><X /></button></header>
      <dl className="advisor-profile-details">
        <div><dt>שם</dt><dd>{selected.name}</dd></div>
        <div><dt>דוא״ל</dt><dd>{selected.email}</dd></div>
        <div><dt>התקבלה</dt><dd>{formatIsraelDateTime(selected.createdAt)}</dd></div>
      </dl>
      {selected.description && <p className="deal-details-text">{selected.description}</p>}
      <label className="form-field"><span>סטטוס</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as PrivacyRequestStatus)}>
          {PRIVACY_REQUEST_STATUSES.map((value) => <option key={value} value={value}>{formatPrivacyRequestStatus(value)}</option>)}
        </select>
      </label>
      <label className="form-field"><span>הערות פנימיות</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setSelected(null)}>סגירה</button><button type="button" className="primary-action" disabled={busy} onClick={() => void save()}>{busy ? "שומר…" : "שמירה"}</button></div>
    </section></div>}
  </main>;
}
