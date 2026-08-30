import { useEffect, useState } from "react";
import { Eye, FileText, Plus, Trash2, X } from "lucide-react";
import type { AdminLegalDocumentOverview, AdminLegalDocumentVersion, LegalDocumentType } from "../types";
import { ApiError, api } from "../utils/apiClient";
import { formatDate } from "../utils/formatters";

const documentTypeLabel: Record<LegalDocumentType, string> = { TERMS: "תנאי שימוש", PRIVACY: "מדיניות פרטיות" };
const statusLabel: Record<string, string> = { DRAFT: "טיוטה", PUBLISHED: "פעילה", ARCHIVED: "בארכיון" };

interface DraftForm {
  title: string;
  content: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  effectiveDate: string;
}

function toForm(version: AdminLegalDocumentVersion): DraftForm {
  return {
    title: version.title, content: version.content,
    contactEmail: version.contactEmail ?? "", contactPhone: version.contactPhone ?? "",
    contactAddress: version.contactAddress ?? "", effectiveDate: version.effectiveDate ?? ""
  };
}

export default function AdminLegalDocumentsView() {
  const [overview, setOverview] = useState<AdminLegalDocumentOverview[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedType, setSelectedType] = useState<LegalDocumentType | null>(null);
  const [versions, setVersions] = useState<AdminLegalDocumentVersion[]>([]);
  const [editing, setEditing] = useState<AdminLegalDocumentVersion | null>(null);
  const [form, setForm] = useState<DraftForm | null>(null);
  const [viewing, setViewing] = useState<AdminLegalDocumentVersion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<AdminLegalDocumentVersion | null>(null);

  const load = async () => setOverview(await api.adminLegalDocuments());
  useEffect(() => { void load().catch(() => setError("לא ניתן לטעון את מסמכי המדיניות.")); }, []);

  const openType = async (documentType: LegalDocumentType) => {
    setSelectedType(documentType); setEditing(null); setForm(null); setMessage(""); setError("");
    setVersions(await api.adminLegalDocumentVersions(documentType));
  };

  const startDraft = async () => {
    if (!selectedType) return;
    setBusy(true); setError("");
    try {
      const draft = await api.adminCreateLegalDocumentDraft(selectedType);
      setEditing(draft); setForm(toForm(draft));
      setVersions(await api.adminLegalDocumentVersions(selectedType));
    } catch { setError("לא ניתן היה ליצור טיוטה חדשה."); }
    finally { setBusy(false); }
  };

  const saveDraft = async () => {
    if (!editing || !form) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await api.adminUpdateLegalDocumentDraft(editing.id, {
        title: form.title, content: form.content,
        contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null,
        contactAddress: form.contactAddress || null, effectiveDate: form.effectiveDate || null
      });
      setEditing(updated); setForm(toForm(updated)); setMessage("הטיוטה נשמרה בהצלחה.");
      if (selectedType) setVersions(await api.adminLegalDocumentVersions(selectedType));
    } catch (caught) { setError(caught instanceof ApiError ? caught.publicMessage ?? "שמירת הטיוטה נכשלה." : "שמירת הטיוטה נכשלה."); }
    finally { setBusy(false); }
  };

  const discardDraft = async () => {
    if (!editing || !selectedType) return;
    if (!window.confirm("למחוק את הטיוטה? הפעולה אינה הפיכה.")) return;
    setBusy(true); setError("");
    try {
      await api.adminDiscardLegalDocumentDraft(editing.id);
      setEditing(null); setForm(null);
      setVersions(await api.adminLegalDocumentVersions(selectedType));
      setMessage("הטיוטה נמחקה.");
    } catch { setError("מחיקת הטיוטה נכשלה."); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!publishTarget || !selectedType) return;
    setBusy(true); setError("");
    try {
      await api.adminPublishLegalDocumentVersion(publishTarget.id);
      setPublishTarget(null); setEditing(null); setForm(null);
      setOverview(await api.adminLegalDocuments());
      setVersions(await api.adminLegalDocumentVersions(selectedType));
      setMessage(`גרסה ${publishTarget.versionNumber} פורסמה בהצלחה.`);
    } catch (caught) { setError(caught instanceof ApiError ? caught.publicMessage ?? "פרסום הגרסה נכשל." : "פרסום הגרסה נכשל."); }
    finally { setBusy(false); }
  };

  if (error && !overview) return <main className="admin-page"><p className="form-message error">{error}</p></main>;
  if (!overview) return <main className="admin-page"><div className="empty-state">טוען מסמכים משפטיים…</div></main>;

  return <main className="admin-page legal-documents-page">
    <section className="page-title"><div><span className="eyebrow">הגדרות מערכת</span><h1>מסמכים משפטיים</h1><p>ניהול גרסאות תנאי השימוש ומדיניות הפרטיות. גרסה שפורסמה אינה ניתנת לעריכה.</p></div></section>
    {message && <p className="form-message success" role="status">{message}</p>}
    {error && <p className="form-message error" role="alert">{error}</p>}

    <section className="legal-document-type-grid">
      {overview.map((item) => <article className={`content-card legal-document-type-card${selectedType === item.documentType ? " selected" : ""}`} key={item.documentType} onClick={() => void openType(item.documentType)}>
        <header><FileText /><h2>{documentTypeLabel[item.documentType]}</h2></header>
        {item.active ? <dl>
          <div><dt>גרסה פעילה</dt><dd>v{item.active.versionNumber}</dd></div>
          <div><dt>עודכן לאחרונה</dt><dd>{item.active.effectiveDate ? formatDate(item.active.effectiveDate) : "לא צוין"}</dd></div>
          <div><dt>פורסם</dt><dd>{item.active.publishedAt ? formatDate(item.active.publishedAt) : "—"}</dd></div>
        </dl> : <p className="empty-inline">טרם פורסמה גרסה פעילה.</p>}
        {item.draft && <span className="status-badge status-draft">קיימת טיוטה בעריכה</span>}
      </article>)}
    </section>

    {selectedType && <section className="content-card legal-document-editor">
      <header className="section-heading compact"><div><h2>{documentTypeLabel[selectedType]}</h2><p>היסטוריית גרסאות ועריכת טיוטה.</p></div>
        {!editing && <button type="button" className="primary-action" disabled={busy} onClick={() => void startDraft()}><Plus size={17} />{versions.some((version) => version.status === "DRAFT") ? "המשך עריכת טיוטה" : "יצירת גרסה חדשה"}</button>}
      </header>

      {editing && form && <div className="legal-document-draft-form">
        <p className="security-note">עריכת טיוטה — הגרסה עדיין אינה גלויה למשתמשים. יש לפרסם כדי שהיא תיכנס לתוקף.</p>
        <label className="form-field"><span>כותרת</span><input value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} /></label>
        <div className="responsive-form-grid">
          <label className="form-field"><span>עודכן לאחרונה (תאריך תוקף)</span><input type="date" value={form.effectiveDate} onChange={(event) => setForm({...form, effectiveDate: event.target.value})} /></label>
          <label className="form-field"><span>דוא״ל ליצירת קשר</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({...form, contactEmail: event.target.value})} /></label>
          <label className="form-field"><span>טלפון (אופציונלי)</span><input value={form.contactPhone} onChange={(event) => setForm({...form, contactPhone: event.target.value})} /></label>
          <label className="form-field"><span>כתובת (אופציונלי)</span><input value={form.contactAddress} onChange={(event) => setForm({...form, contactAddress: event.target.value})} /></label>
        </div>
        <label className="form-field"><span>תוכן המסמך</span><textarea className="legal-document-content-editor" rows={22} value={form.content} onChange={(event) => setForm({...form, content: event.target.value})} /></label>
        <div className="modal-actions wrap">
          <button type="button" className="secondary-action" onClick={() => setPreviewOpen(true)}><Eye size={16} />תצוגה מקדימה</button>
          <button type="button" className="secondary-action danger" disabled={busy} onClick={() => void discardDraft()}><Trash2 size={16} />מחיקת טיוטה</button>
          <button type="button" className="secondary-action" disabled={busy} onClick={() => void saveDraft()}>{busy ? "שומר…" : "שמירת טיוטה"}</button>
          <button type="button" className="primary-action" disabled={busy} onClick={() => setPublishTarget(editing)}>פרסום גרסה</button>
        </div>
      </div>}

      <h3>היסטוריית גרסאות</h3>
      <div className="responsive-table"><table><thead><tr><th>גרסה</th><th>סטטוס</th><th>עודכן לאחרונה</th><th>פורסם</th><th>אושר על ידי</th><th></th></tr></thead>
        <tbody>{versions.map((version) => <tr key={version.id}>
          <td>v{version.versionNumber}</td>
          <td><span className={`status-badge status-${version.status.toLowerCase()}`}>{statusLabel[version.status]}</span></td>
          <td>{version.effectiveDate ? formatDate(version.effectiveDate) : "—"}</td>
          <td>{version.publishedAt ? formatDate(version.publishedAt) : "—"}</td>
          <td>{version.acceptanceCount ?? 0} משתמשים</td>
          <td><button type="button" className="icon-action" aria-label={`הצגת גרסה ${version.versionNumber}`} onClick={() => setViewing(version)}><Eye size={16} /></button></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    {previewOpen && form && <div className="modal-backdrop"><section className="modal content-card legal-document-preview-modal" role="dialog" aria-modal="true"><header className="modal-heading"><div><span className="eyebrow">תצוגה מקדימה</span><h2>{form.title}</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setPreviewOpen(false)}><X /></button></header>
      <p className="legal-document-updated-label">עודכן לאחרונה: {form.effectiveDate ? formatDate(form.effectiveDate) : "לא צוין"}</p>
      <div className="legal-document-content-view">{form.content}</div>
      {(form.contactEmail || form.contactPhone || form.contactAddress) && <div className="legal-document-contact"><h3>יצירת קשר</h3>{form.contactEmail && <p>דוא״ל: {form.contactEmail}</p>}{form.contactPhone && <p>טלפון: {form.contactPhone}</p>}{form.contactAddress && <p>כתובת: {form.contactAddress}</p>}</div>}
    </section></div>}

    {viewing && <div className="modal-backdrop"><section className="modal content-card legal-document-preview-modal" role="dialog" aria-modal="true"><header className="modal-heading"><div><span className="eyebrow">{statusLabel[viewing.status]} · v{viewing.versionNumber}</span><h2>{viewing.title}</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setViewing(null)}><X /></button></header>
      <p className="legal-document-updated-label">עודכן לאחרונה: {viewing.effectiveDate ? formatDate(viewing.effectiveDate) : "לא צוין"}</p>
      <div className="legal-document-content-view">{viewing.content}</div>
    </section></div>}

    {publishTarget && <div className="modal-backdrop"><section className="modal content-card" role="dialog" aria-modal="true"><header className="modal-heading"><h2>פרסום גרסה חדשה</h2><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setPublishTarget(null)}><X /></button></header>
      <p>פרסום גרסה חדשה לא ישנה אישורים קיימים. משתמשים חדשים יאשרו את הגרסה החדשה.</p>
      <dl className="advisor-profile-details"><div><dt>גרסה</dt><dd>v{publishTarget.versionNumber}</dd></div><div><dt>תאריך תוקף</dt><dd>{publishTarget.effectiveDate ? formatDate(publishTarget.effectiveDate) : "לא צוין"}</dd></div></dl>
      <div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setPublishTarget(null)}>ביטול</button><button type="button" className="primary-action" disabled={busy} onClick={() => void publish()}>{busy ? "מפרסם…" : "אישור ופרסום"}</button></div>
    </section></div>}
  </main>;
}
