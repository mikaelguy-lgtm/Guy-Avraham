import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Mail, Send, Sparkles, X } from "lucide-react";
import type { Client, ClientSubmission, Lender, LoanOffer, MissingRequiredDocument } from "../types";
import { ApiError, api } from "../utils/apiClient";
import { formatCurrency, formatOfferStatus, formatSubmissionStatus } from "../utils/formatters";

export default function LoanArena({clientId, onMissingDocuments}: {clientId?: number; onMissingDocuments?: () => void}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(clientId ?? 0);
  const [selectedLenders, setSelectedLenders] = useState<number[]>([]);
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [missingDocuments, setMissingDocuments] = useState<MissingRequiredDocument[]>([]);

  useEffect(() => { void Promise.all([api.clients(), api.lenders()]).then(([clientResult, lenderResult]) => {setClients(clientResult.items); setLenders(lenderResult); if (!clientId && clientResult.items[0]) setSelectedClientId(clientResult.items[0].id);}); }, [clientId]);
  useEffect(() => { if (!selectedClientId) return; void Promise.all([api.submissions(selectedClientId), api.offers(selectedClientId)]).then(([submissionResult, offerResult]) => {setSubmissions(submissionResult); setOffers(offerResult);}); }, [selectedClientId]);
  const client = useMemo(() => clients.find((item) => item.id === selectedClientId), [clients, selectedClientId]);

  const submit = async () => {
    if (!selectedClientId || selectedLenders.length === 0) return;
    setBusy(true); setMessage("");
    try {
      const result = await api.submit(selectedClientId, selectedLenders);
      const failed = result.results.filter((item) => item.status !== "SENT").length;
      setMessage(failed ? `התיק נשלח, אך ${failed} משלוחים דורשים טיפול.` : "התיק נשלח בהצלחה לכל חברות המימון שנבחרו.");
      setSelectedLenders([]); setSubmissions(await api.submissions(selectedClientId));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "MISSING_REQUIRED_DOCUMENTS") setMissingDocuments(caught.missingDocuments);
      else if (caught instanceof ApiError && caught.code === "INCOMPLETE_LEGACY_LIABILITIES") setMessage(`שליחת התיק נכשלה. ${caught.publicMessage ?? "נדרש להשלים את פרטי ההתחייבויות שהועברו מהמערכת הישנה."}`);
      else setMessage("שליחת התיק נכשלה. בדוק את פרטי התיק ונסה שוב.");
    }
    finally { setBusy(false); }
  };

  return <section className="arena-workspace">
    {!clientId && <label className="client-picker"><span>בחירת תיק לקוח</span><select aria-label="בחירת תיק לקוח" value={selectedClientId} onChange={(event) => setSelectedClientId(Number(event.target.value))}>{clients.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} — {item.publicCaseNumber}</option>)}</select></label>}
    {client && <div className="arena-summary"><span className="stat-icon cyan"><Sparkles /></span><div><small>התיק שנבחר</small><h3>{client.firstName} {client.lastName}</h3><p>{client.publicCaseNumber} · מימון מבוקש {formatCurrency(client.requestedAmount)}</p></div></div>}
    <div className="lenders-grid">{lenders.map((lender) => {
      const submission = submissions.find((item) => item.lenderId === lender.id);
      const offer = offers.find((item) => item.lenderName === lender.name);
      const selected = selectedLenders.includes(lender.id);
      return <label className={`lender-card${selected ? " selected" : ""}`} key={lender.id}><input type="checkbox" aria-label={`בחירת ${lender.name}`} checked={selected} onChange={(event) => setSelectedLenders((current) => event.target.checked ? [...current, lender.id] : current.filter((id) => id !== lender.id))} /><div className="lender-card-top"><span className="lender-logo"><Building2 /><b>{lender.name.slice(0, 1)}</b></span><span className="status-badge status-active">פעילה</span></div><div><h3>{lender.name}</h3><p>פתרונות מימון חוץ־בנקאיים</p></div><div className="lender-meta"><span><Mail size={16} />{lender.contactEmail}</span><span><CheckCircle2 size={16} />סטטוס שליחה: {formatSubmissionStatus(submission?.status ?? null)}</span></div>{offer && <div className="offer-highlight"><strong>הצעה שהתקבלה</strong><span>{formatCurrency(offer.amount)} · {offer.interestRate}%</span><small>{formatOfferStatus(offer.status)}</small></div>}</label>;
    })}</div>
    {message && <p className={message.includes("נכשלה") || message.includes("דורשים") ? "form-message error" : "form-message success"} role="status">{message}</p>}
    <div className="arena-actions"><button type="button" className="primary-action large" disabled={!selectedClientId || selectedLenders.length === 0 || busy} onClick={() => void submit()}><Send size={19} />{busy ? "שולח את התיק…" : "שליחת התיק לחברות שנבחרו"}</button><small>{selectedLenders.length} חברות נבחרו</small></div>
    {missingDocuments.length > 0 && <div className="modal-backdrop"><section className="modal content-card" role="dialog" aria-modal="true" aria-labelledby="missing-documents-title"><header className="modal-heading"><div><span className="eyebrow">מסמכי חובה</span><h2 id="missing-documents-title">לא ניתן לשלוח את התיק</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setMissingDocuments([])}><X /></button></header><p>חסרים מסמכי חובה. יש להשלים את המסמכים הבאים לפני שליחת התיק לחברות מימון:</p><ul className="missing-documents-list">{missingDocuments.map((document) => <li key={`${document.borrowerId ?? "client"}-${document.documentType}`}>{document.label}</li>)}</ul><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setMissingDocuments([])}>סגירה</button>{onMissingDocuments && <button type="button" className="primary-action" onClick={onMissingDocuments}>מעבר למסמכים</button>}</div></section></div>}
  </section>;
}
