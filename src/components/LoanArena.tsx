import {useEffect, useMemo, useState} from "react";
import {Building2, CheckCircle2, ChevronLeft, ChevronRight, Eye, Mail, Send, ShieldCheck, Sparkles, X} from "lucide-react";
import type {Client, DeliveryBlocker, DeliveryCompany, DeliveryPreview} from "../types";
import {ApiError, api} from "../utils/apiClient";
import {formatCurrency, formatDate} from "../utils/formatters";

type Stage = "companies" | "preview" | "confirm" | "complete";

function openPdf(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type: "application/pdf"}));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function MaskedSummary({preview}: {preview: DeliveryPreview}) {
  const snapshot = preview.maskedSnapshot as {
    numberOfBorrowers?: number;
    loanRequest?: {requestedAmount?: number; purpose?: string; requestedTermMonths?: number; loanToValue?: number};
    property?: {propertyType?: string; city?: string; value?: number};
    totals?: {monthlyIncome?: number; liabilityBalance?: number; monthlyPayments?: number};
    documentStatus?: string;
  };
  return <div className="delivery-preview-grid" data-testid="masked-preview">
    <article><small>מספר לווים</small><strong>{snapshot.numberOfBorrowers ?? "—"}</strong></article>
    <article><small>סכום מבוקש</small><strong>{formatCurrency(snapshot.loanRequest?.requestedAmount ?? 0)}</strong></article>
    <article><small>שווי נכס</small><strong>{formatCurrency(snapshot.property?.value ?? 0)}</strong></article>
    <article><small>אחוז מימון</small><strong>{snapshot.loanRequest?.loanToValue ?? 0}%</strong></article>
    <article><small>סך הכנסה חודשית</small><strong>{formatCurrency(snapshot.totals?.monthlyIncome ?? 0)}</strong></article>
    <article><small>סך החזרים חודשיים</small><strong>{formatCurrency(snapshot.totals?.monthlyPayments ?? 0)}</strong></article>
    <article className="wide"><small>סטטוס מסמכים</small><strong>{snapshot.documentStatus ?? "כל מסמכי החובה קיימים בתיק"}</strong></article>
  </div>;
}

export default function LoanArena({clientId, onMissingDocuments, onSent}: {clientId?: number; onMissingDocuments?: () => void; onSent?: () => void}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? 0);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [preview, setPreview] = useState<DeliveryPreview | null>(null);
  const [stage, setStage] = useState<Stage>("companies");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<DeliveryBlocker[]>([]);

  useEffect(() => {
    void api.clients().then((result) => {
      setClients(result.items);
      if (!clientId && result.items[0]) setSelectedClientId(result.items[0].id);
    }).catch(() => setMessage("לא ניתן לטעון את רשימת התיקים."));
  }, [clientId]);
  useEffect(() => {
    if (!selectedClientId) return;
    setStage("companies"); setPreview(null); setSelectedCompanies([]);
    void api.deliveryCompanies(selectedClientId).then(setCompanies).catch((error) => setMessage(error instanceof ApiError ? error.publicMessage ?? "לא ניתן לטעון חברות מימון." : "לא ניתן לטעון חברות מימון."));
  }, [selectedClientId]);

  const client = useMemo(() => clients.find((item) => item.id === selectedClientId), [clients, selectedClientId]);
  const contactCount = companies.filter((company) => selectedCompanies.includes(company.id)).reduce((total, company) => total + company.activeContactCount, 0);

  const showError = (caught: unknown) => {
    if (caught instanceof ApiError) {
      setMessage(caught.publicMessage ?? "הפעולה נכשלה. נסה שוב.");
      if (caught.blockers.length) setBlockers(caught.blockers);
    } else setMessage("הפעולה נכשלה. נסה שוב.");
  };

  const createPreview = async () => {
    if (!selectedClientId || !selectedCompanies.length) return;
    setBusy(true); setMessage("");
    try { setPreview(await api.deliveryPreview(selectedClientId, selectedCompanies)); setStage("preview"); }
    catch (caught) { showError(caught); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!selectedClientId || !preview) return;
    setBusy(true); setMessage("");
    try {
      await api.deliverySend(selectedClientId, {companyIds: selectedCompanies, idempotencyKey: crypto.randomUUID(), previewConfirmation: preview.previewConfirmation});
      setStage("complete"); setMessage("התיק נשלח בהצלחה לאנשי הקשר של החברות שנבחרו."); onSent?.();
    } catch (caught) { showError(caught); }
    finally { setBusy(false); }
  };

  return <section className="arena-workspace delivery-flow" aria-busy={busy}>
    <ol className="delivery-steps" aria-label="שלבי שליחת תיק">
      <li className={stage === "companies" ? "active" : "done"}><span>1</span>בחירת חברות</li>
      <li className={stage === "preview" ? "active" : stage === "confirm" || stage === "complete" ? "done" : ""}><span>2</span>תצוגה מוסווית</li>
      <li className={stage === "confirm" ? "active" : stage === "complete" ? "done" : ""}><span>3</span>אישור ושליחה</li>
    </ol>
    {!clientId && <label className="client-picker"><span>בחירת תיק לקוח</span><select aria-label="בחירת תיק לקוח" value={selectedClientId} onChange={(event) => setSelectedClientId(Number(event.target.value))}>{clients.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} — {item.publicCaseNumber}</option>)}</select></label>}
    {client && <div className="arena-summary"><span className="stat-icon cyan"><Sparkles /></span><div><small>התיק שנבחר</small><h3>{client.firstName} {client.lastName}</h3><p>{client.publicCaseNumber} · מימון מבוקש {formatCurrency(client.requestedAmount)}</p></div></div>}

    {stage === "companies" && <>
      <header className="section-heading compact"><div><h2>בחירת חברות מימון</h2><p>הבחירה היא ברמת החברה. כל אנשי הקשר הפעילים יקבלו קישור אישי ונפרד.</p></div></header>
      <div className="lenders-grid">{companies.map((company) => {
        const selected = selectedCompanies.includes(company.id);
        return <label className={`lender-card${selected ? " selected" : ""}`} key={company.id}>
          <input type="checkbox" aria-label={`בחירת ${company.name}`} checked={selected} disabled={company.activeContactCount === 0} onChange={(event) => setSelectedCompanies((current) => event.target.checked ? [...current, company.id] : current.filter((id) => id !== company.id))} />
          <div className="lender-card-top"><span className="lender-logo"><Building2 /><b>{company.name.slice(0, 1)}</b></span><span className="status-badge status-active">פעילה</span></div>
          <div><h3>{company.name}</h3><p>{company.activityAreas.length ? company.activityAreas.join(" · ") : "מימון חוץ־בנקאי"}</p></div>
          <div className="lender-meta"><span><Mail size={16} />{company.activeContactCount} אנשי קשר פעילים</span><span><CheckCircle2 size={16} />שליחה אחרונה: {company.lastSentAt ? formatDate(company.lastSentAt) : "טרם נשלח"}</span></div>
        </label>;
      })}</div>
      {!companies.length && <div className="empty-state">אין חברות מימון פעילות עם אנשי קשר זמינים.</div>}
      <div className="arena-actions"><button type="button" className="primary-action large" disabled={!selectedCompanies.length || busy} onClick={() => void createPreview()}>{busy ? "מכין תצוגה מוסווית…" : <><Eye size={19} />המשך לתצוגה מוסווית</>}</button><small>{selectedCompanies.length} חברות · {contactCount} אנשי קשר</small></div>
    </>}

    {stage === "preview" && preview && <>
      <header className="section-heading compact"><div><h2>תצוגה מקדימה מוסווית</h2><p>בדוק שהמידע העסקי מלא ושאין בו פרטים מזהים.</p></div><button type="button" className="secondary-action" onClick={() => openPdf(preview.maskedPdfBase64)}><Eye size={18} />צפייה ב־PDF המוסווה</button></header>
      <MaskedSummary preview={preview} />
      <div className="security-note"><ShieldCheck /><p><strong>הגנה על פרטיות הלקוח</strong><br />בשלב הראשון החברות יקבלו תיק מוסווה בלבד, ללא מסמכי הלקוח וללא פרטי היועץ.</p></div>
      <div className="arena-actions split"><button type="button" className="secondary-action" onClick={() => setStage("companies")}><ChevronRight />חזרה לבחירה</button><button type="button" className="primary-action" onClick={() => setStage("confirm")}>המשך לאישור<ChevronLeft /></button></div>
    </>}

    {stage === "confirm" && preview && <>
      <header className="section-heading compact"><div><h2>אישור ושליחת התיק</h2><p>לאחר השליחה תיווצר גרסה קבועה ובלתי ניתנת לשינוי של התיק והמסמכים.</p></div></header>
      <div className="delivery-confirmation content-card"><dl><div><dt>חברות נבחרות</dt><dd>{preview.selectedCompanyCount}</dd></div><div><dt>נמענים</dt><dd>{preview.selectedContactCount}</dd></div><div><dt>מועד אחרון לתגובה</dt><dd>{formatDate(preview.responseDeadlineAt)}</dd></div></dl><p><ShieldCheck /> לכל נמען יישלח קישור אישי. קבצים אינם מצורפים למייל.</p></div>
      <label className="confirmation-check"><input type="checkbox" required />אני מאשר/ת שהמידע המוסווה נבדק ושהתיק מוכן לשליחה.</label>
      <div className="arena-actions split"><button type="button" className="secondary-action" onClick={() => setStage("preview")}><ChevronRight />חזרה לתצוגה</button><button type="button" className="primary-action large" disabled={busy} onClick={(event) => {const checkbox = event.currentTarget.closest("section")?.querySelector<HTMLInputElement>(".confirmation-check input"); if (checkbox && !checkbox.checked) {setMessage("יש לאשר את בדיקת התיק לפני השליחה."); checkbox.focus(); return;} void send();}}><Send size={19} />{busy ? "שולח…" : "אישור ושליחת התיק"}</button></div>
    </>}

    {stage === "complete" && <div className="delivery-complete"><CheckCircle2 /><h2>התיק נשלח בהצלחה</h2><p>הודעות נפרדות הוכנסו לתור השליחה לכל אנשי הקשר הפעילים.</p><button type="button" className="secondary-action" onClick={() => {setStage("companies"); setPreview(null); setSelectedCompanies([]);}}>שליחת גרסה חדשה</button></div>}
    {message && <p className={stage === "complete" ? "form-message success" : "form-message error"} role="status">{message}</p>}
    {blockers.length > 0 && <div className="modal-backdrop"><section className="modal content-card" role="dialog" aria-modal="true" aria-labelledby="delivery-guard-title"><header className="modal-heading"><div><span className="eyebrow">בדיקת מוכנות</span><h2 id="delivery-guard-title">לא ניתן לשלוח את התיק</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setBlockers([])}><X /></button></header><p>התיק השתנה ויש להשלים את הפריטים הבאים:</p><ul className="delivery-blockers-list">{blockers.map((blocker) => <li key={blocker.code}><span><strong>{blocker.label}</strong><small>{blocker.hint}</small></span></li>)}</ul><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setBlockers([])}>סגירה</button>{onMissingDocuments && blockers.some((item) => item.action === "documents") && <button type="button" className="primary-action" onClick={onMissingDocuments}>מעבר למסמכים</button>}</div></section></div>}
  </section>;
}
