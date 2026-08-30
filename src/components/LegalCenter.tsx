import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { PRIVACY_REQUEST_TYPES } from "../domain/privacyRequests";
import type { LegalDocumentType, LegalDocumentVersion, PrivacyRequestType } from "../types";
import { api } from "../utils/apiClient";
import { formatDate, formatPrivacyRequestType } from "../utils/formatters";

type LegalCenterTab = LegalDocumentType | "REQUESTS";

const tabs: {id: LegalCenterTab; label: string}[] = [
  {id: "TERMS", label: "תנאי שימוש"},
  {id: "PRIVACY", label: "מדיניות פרטיות"},
  {id: "DPA", label: "DPA"},
  {id: "REQUESTS", label: "בקשות פרטיות ומחיקת חשבון"}
];

type DocumentState = LegalDocumentVersion | "unavailable" | "loading";

function DocumentTabPanel({state, showAcceptBar, onAccept}: {state: DocumentState | undefined; showAcceptBar: boolean; onAccept: () => void}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const handleScroll = () => {
    const element = bodyRef.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 32) setReachedEnd(true);
  };

  useEffect(() => {
    setReachedEnd(false);
    const element = bodyRef.current;
    if (element && element.scrollHeight <= element.clientHeight + 32) setReachedEnd(true);
  }, [state]);

  if (!state || state === "loading") return <div className="empty-state">טוען מסמך…</div>;
  if (state === "unavailable") return <p className="empty-inline">המסמך אינו זמין כרגע.</p>;

  return <>
    <div className="legal-center-body" ref={bodyRef} onScroll={showAcceptBar ? handleScroll : undefined}>
      <p className="legal-document-updated-label">עודכן לאחרונה: {state.effectiveDate ? formatDate(state.effectiveDate) : "לא צוין"}</p>
      <div className="legal-document-content-view">{state.content}</div>
      {(state.contactEmail || state.contactPhone || state.contactAddress) && <div className="legal-document-contact"><h3>יצירת קשר</h3>{state.contactEmail && <p>דוא״ל: {state.contactEmail}</p>}{state.contactPhone && <p>טלפון: {state.contactPhone}</p>}{state.contactAddress && <p>כתובת: {state.contactAddress}</p>}</div>}
    </div>
    {showAcceptBar && <div className="legal-center-accept-bar">
      {reachedEnd
        ? <button type="button" className="primary-action" onClick={onAccept}><CheckCircle2 size={18} />קראתי ואני מסכים/ה</button>
        : <p className="empty-inline">יש לגלול עד סוף המסמך כדי לאשר.</p>}
    </div>}
  </>;
}

function RequestsTabPanel() {
  const [requestType, setRequestType] = useState<PrivacyRequestType>("VIEW");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim() || busy) return;
    setBusy(true); setResult(null);
    try {
      await api.submitPrivacyRequest({requestType, name: name.trim(), email: email.trim(), description: description.trim() || undefined});
      setResult("success");
      setName(""); setEmail(""); setDescription(""); setRequestType("VIEW");
    } catch { setResult("error"); }
    finally { setBusy(false); }
  };

  return <div className="legal-center-body">
    <p>משתמש או נושא מידע המעוניין בבקשה הנוגעת למידע האישי שלו יכול לפנות ל-SynCash לצורך עיון במידע, תיקון מידע, מחיקת מידע, סגירת חשבון, או כל שאלה אחרת בנושא פרטיות.</p>
    <p className="status-warning">בקשת מחיקה אינה בהכרח מביאה למחיקה מיידית של כל המידע. ייתכן שמידע מסוים יישמר כאשר קיימת חובה או הצדקה חוקית לשמירתו, לצורכי אבטחה, תיעוד, טיפול בתיקים קיימים או הגנה משפטית.</p>
    <p>ניתן גם לפנות ישירות בדוא״ל: <a href="mailto:support@syncash.co.il">support@syncash.co.il</a></p>
    <div className="legal-center-request-form">
      <label className="form-field"><span>סוג בקשה</span>
        <select value={requestType} onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)}>
          {PRIVACY_REQUEST_TYPES.filter((type) => type !== "OTHER").map((type) => <option key={type} value={type}>{formatPrivacyRequestType(type)}</option>)}
          <option value="OTHER">{formatPrivacyRequestType("OTHER")}</option>
        </select>
      </label>
      <label className="form-field"><span>שם</span><input value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
      <label className="form-field"><span>דוא״ל</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
      <label className="form-field"><span>תיאור הבקשה (אופציונלי)</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} /></label>
      {result === "success" && <p className="form-message success" role="status">הבקשה נשלחה בהצלחה. ניצור איתך קשר בהקדם.</p>}
      {result === "error" && <p className="form-message error" role="alert">שליחת הבקשה נכשלה. ניתן לפנות ישירות בדוא״ל.</p>}
      <button type="button" className="primary-action" disabled={busy || !name.trim() || !email.trim()} onClick={() => void submit()}>{busy ? "שולח…" : "שליחת בקשה"}</button>
    </div>
  </div>;
}

export default function LegalCenter({initialTab, onClose, onAcceptTerms}: {initialTab: LegalCenterTab; onClose: () => void; onAcceptTerms?: () => void}) {
  const [activeTab, setActiveTab] = useState<LegalCenterTab>(initialTab);
  const [documents, setDocuments] = useState<Partial<Record<LegalDocumentType, DocumentState>>>({});

  useEffect(() => {
    if (activeTab === "REQUESTS" || documents[activeTab]) return;
    const type = activeTab;
    setDocuments((current) => ({...current, [type]: "loading"}));
    api.legalDocument(type).then((document) => setDocuments((current) => ({...current, [type]: document})))
      .catch(() => setDocuments((current) => ({...current, [type]: "unavailable"})));
  }, [activeTab, documents]);

  return <div className="modal-backdrop" role="presentation">
    <section className="modal content-card legal-center" role="dialog" aria-modal="true" aria-label="מסמכים משפטיים של SynCash">
      <header className="legal-center-header">
        <div><span className="eyebrow">SynCash</span><h2>מסמכים משפטיים של SynCash</h2></div>
        <button type="button" className="icon-action" aria-label="סגירה" onClick={onClose}><X /></button>
      </header>
      <nav className="legal-center-tabs" role="tablist" aria-label="מסמכים משפטיים">
        {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`legal-center-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>
      <div role="tabpanel">
        {activeTab === "REQUESTS"
          ? <RequestsTabPanel />
          : <DocumentTabPanel state={documents[activeTab]} showAcceptBar={activeTab === "TERMS" && Boolean(onAcceptTerms)} onAccept={() => { onAcceptTerms?.(); onClose(); }} />}
      </div>
    </section>
  </div>;
}
