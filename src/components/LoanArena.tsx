import {useEffect, useMemo, useState} from "react";
import {CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Send, Sparkles, X} from "lucide-react";
import type {Client, DeliveryBlocker, DeliveryPreview} from "../types";
import {ApiError, api} from "../utils/apiClient";
import {formatCurrency, formatDate} from "../utils/formatters";
import {downloadPdfBlob, openFreshPdfBlob, revokeActivePdfBlob} from "../utils/pdfBlob";

type Stage = "companies" | "preview" | "confirm" | "complete";

function base64ToPdfBlob(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], {type: "application/pdf"});
}

function openPdf(base64: string, filename?: string) {
  openFreshPdfBlob(base64ToPdfBlob(base64), filename);
}

function downloadPdf(base64: string, filename: string) {
  downloadPdfBlob(base64ToPdfBlob(base64), filename);
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
  const [eligibleCompanyCount, setEligibleCompanyCount] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? 0);
  const [preview, setPreview] = useState<DeliveryPreview | null>(null);
  const [sentCompanyCount, setSentCompanyCount] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>("companies");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<DeliveryBlocker[]>([]);

  useEffect(() => () => revokeActivePdfBlob(), []);

  useEffect(() => {
    void api.clients().then((result) => {
      setClients(result.items);
      if (!clientId && result.items[0]) setSelectedClientId(result.items[0].id);
    }).catch(() => setMessage("לא ניתן לטעון את רשימת התיקים."));
  }, [clientId]);
  useEffect(() => {
    if (!selectedClientId) return;
    setStage("companies"); setPreview(null); setEligibleCompanyCount(null);
    void api.deliveryCompanies(selectedClientId).then((result) => setEligibleCompanyCount(result.length)).catch((error) => setMessage(error instanceof ApiError ? error.publicMessage ?? "לא ניתן לבדוק את חברות המימון הפעילות." : "לא ניתן לבדוק את חברות המימון הפעילות."));
  }, [selectedClientId]);

  const client = useMemo(() => clients.find((item) => item.id === selectedClientId), [clients, selectedClientId]);

  const showError = (caught: unknown) => {
    if (caught instanceof ApiError) {
      setMessage(caught.publicMessage ?? "הפעולה נכשלה. נסה שוב.");
      if (caught.blockers.length) setBlockers(caught.blockers);
    } else setMessage("הפעולה נכשלה. נסה שוב.");
  };

  const createPreview = async () => {
    if (!selectedClientId || !eligibleCompanyCount) return;
    setBusy(true); setMessage("");
    try { setPreview(await api.deliveryPreview(selectedClientId)); setStage("preview"); }
    catch (caught) { showError(caught); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!selectedClientId || !preview) return;
    setBusy(true); setMessage("");
    try {
      const result = await api.deliverySend(selectedClientId, {idempotencyKey: crypto.randomUUID(), previewConfirmation: preview.previewConfirmation});
      const companies = (result as {companies?: unknown[]}).companies;
      const count = Array.isArray(companies) ? companies.length : preview.eligibleCompanyCount;
      setSentCompanyCount(count);
      setStage("complete"); setMessage(`התיק הוגש בהצלחה ל-${count} חברות מימון.`); onSent?.();
    } catch (caught) { showError(caught); }
    finally { setBusy(false); }
  };

  return <section className="arena-workspace delivery-flow" aria-busy={busy}>
    <ol className="delivery-steps" aria-label="שלבי שליחת תיק">
      <li className={stage === "companies" ? "active" : "done"}><span>1</span>חברות מימון</li>
      <li className={stage === "preview" ? "active" : stage === "confirm" || stage === "complete" ? "done" : ""}><span>2</span>תצוגה</li>
      <li className={stage === "confirm" ? "active" : stage === "complete" ? "done" : ""}><span>3</span>אישור ושליחה</li>
    </ol>
    {!clientId && <label className="client-picker"><span>בחירת תיק לקוח</span><select aria-label="בחירת תיק לקוח" value={selectedClientId} onChange={(event) => setSelectedClientId(Number(event.target.value))}>{clients.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} — {item.publicCaseNumber}</option>)}</select></label>}
    {client && <div className="arena-summary"><span className="stat-icon cyan"><Sparkles /></span><div><small>התיק שנבחר</small><h3>{client.firstName} {client.lastName}</h3><p>{client.publicCaseNumber} · מימון מבוקש {formatCurrency(client.requestedAmount)}</p></div></div>}

    {stage === "companies" && <>
      <header className="section-heading compact"><div><h2>חברות מימון</h2><p>התיק יישלח אוטומטית לכל חברות המימון הפעילות שיש להן איש קשר פעיל.</p></div></header>
      {eligibleCompanyCount === null && <div className="empty-state">בודק חברות מימון פעילות…</div>}
      {eligibleCompanyCount !== null && eligibleCompanyCount > 0 && <div className="arena-summary"><span className="stat-icon cyan"><Sparkles /></span><div><small>מוכן לשליחה</small><h3>התיק יוגש ל-{eligibleCompanyCount} חברות מימון</h3></div></div>}
      {eligibleCompanyCount === 0 && <div className="empty-state">אין כרגע חברות מימון פעילות עם איש קשר פעיל. לא ניתן לשלוח את התיק.</div>}
      <div className="arena-actions"><button type="button" className="primary-action large" disabled={!eligibleCompanyCount || busy} onClick={() => void createPreview()}>{busy ? "מכין תצוגה…" : <><Eye size={19} />המשך</>}</button></div>
    </>}

    {stage === "preview" && preview && <>
      <header className="section-heading compact"><div><h2>תצוגה מקדימה</h2><p>בדוק שהמידע העסקי מלא ושאין בו פרטים מזהים.</p></div><div className="header-actions"><button type="button" className="secondary-action" onClick={() => openPdf(preview.maskedPdfBase64, `SynCash_תיק_מימון_ראשוני_${client?.publicCaseNumber ?? ""}.pdf`)}><Eye size={18} />צפייה ב-PDF</button><button type="button" className="secondary-action" onClick={() => downloadPdf(preview.maskedPdfBase64, `SynCash_תיק_מימון_ראשוני_${client?.publicCaseNumber ?? ""}.pdf`)}><Download size={18} />הורדת PDF</button></div></header>
      <MaskedSummary preview={preview} />
      <div className="arena-actions split"><button type="button" className="secondary-action" onClick={() => setStage("companies")}><ChevronRight />חזרה</button><button type="button" className="primary-action" onClick={() => setStage("confirm")}>המשך לאישור<ChevronLeft /></button></div>
    </>}

    {stage === "confirm" && preview && <>
      <header className="section-heading compact"><div><h2>אישור ושליחת התיק</h2><p>לאחר השליחה תיווצר גרסה קבועה ובלתי ניתנת לשינוי של התיק והמסמכים.</p></div></header>
      <div className="delivery-confirmation content-card"><dl><div><dt>חברות מימון</dt><dd>{preview.eligibleCompanyCount}</dd></div><div><dt>מועד אחרון למענה</dt><dd>{formatDate(preview.responseDeadlineAt)}</dd></div></dl><p>לכל איש קשר פעיל יישלח קישור אישי. קבצים אינם מצורפים למייל.</p></div>
      <div className="arena-actions split"><button type="button" className="secondary-action" onClick={() => setStage("preview")}><ChevronRight />חזרה לתצוגה</button><button type="button" className="primary-action large" disabled={busy} onClick={() => void send()}><Send size={19} />{busy ? "שולח…" : "אישור ושליחת התיק"}</button></div>
    </>}

    {stage === "complete" && <div className="delivery-complete"><CheckCircle2 /><h2>התיק הוגש בהצלחה{sentCompanyCount ? ` ל-${sentCompanyCount} חברות מימון` : ""}</h2></div>}
    {message && <p className={stage === "complete" ? "form-message success" : "form-message error"} role="status">{message}</p>}
    {blockers.length > 0 && <div className="modal-backdrop"><section className="modal content-card" role="dialog" aria-modal="true" aria-labelledby="delivery-guard-title"><header className="modal-heading"><div><span className="eyebrow">בדיקת מוכנות</span><h2 id="delivery-guard-title">לא ניתן לשלוח את התיק</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setBlockers([])}><X /></button></header><p>התיק השתנה ויש להשלים את הפריטים הבאים:</p><ul className="delivery-blockers-list">{blockers.map((blocker) => <li key={blocker.code}><span><strong>{blocker.label}</strong><small>{blocker.hint}</small></span></li>)}</ul><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setBlockers([])}>סגירה</button>{onMissingDocuments && blockers.some((item) => item.action === "documents") && <button type="button" className="primary-action" onClick={onMissingDocuments}>מעבר למסמכים</button>}</div></section></div>}
  </section>;
}
