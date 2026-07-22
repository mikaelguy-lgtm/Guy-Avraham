import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, Edit3, FileUp, Send, X } from "lucide-react";
import { useParams } from "react-router-dom";
import type { Client, ClientSubmission, IdentityRequest, LoanOffer } from "../types";
import { ApiError, api } from "../utils/apiClient";
import {
  calculateLoanToValue,
  calculateRepaymentRatio,
  calculateTotalMonthlyIncome,
  calculateTotalMonthlyPayments
} from "../utils/clientCalculations";
import { clientFormPayload, clientToForm, resizeChildrenAges, validateClientForm, type ClientFormErrors, type ClientFormState } from "../utils/clientForm";
import {
  formatAdditionalIncomeType, formatClientStatus, formatCurrency, formatDate, formatDealType, formatEmploymentType,
  formatIdentityField, formatIdentityStatus, formatMaritalStatus, formatOfferStatus, formatPercentage, formatPropertyType,
  formatRegion, formatSubmissionStatus, maskIdentityNumber
} from "../utils/formatters";
import ClientFormFields from "./ClientFormFields";
import DocumentManager from "./DocumentManager";
import LoanArena from "./LoanArena";

const tabs = ["תקציר", "פרטים אישיים", "הכנסות", "התחייבויות", "נכס", "מסמכים", "חברות מימון", "בקשות חשיפה", "הצעות", "פעילות"] as const;
type Tab = typeof tabs[number];

export default function ClientDetailView() {
  const {id = ""} = useParams();
  const clientId = Number(id);
  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<Tab>("תקציר");
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [identityRequests, setIdentityRequests] = useState<IdentityRequest[]>([]);
  const [identitySelections, setIdentitySelections] = useState<Record<number, string[]>>({});
  const [editing, setEditing] = useState(false);
  const [editStep, setEditStep] = useState<1 | 2 | 3>(1);
  const [editForm, setEditForm] = useState<ClientFormState | null>(null);
  const [editErrors, setEditErrors] = useState<ClientFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{type: "success" | "error"; text: string; requestId?: string} | null>(null);

  const load = useCallback(async () => {
    const [clientResult, submissionResult, offerResult, requestResult] = await Promise.all([api.client(clientId), api.submissions(clientId), api.offers(clientId), api.identityRequests()]);
    setClient(clientResult); setSubmissions(submissionResult); setOffers(offerResult);
    const clientRequests = requestResult.filter((request) => request.clientId === clientId);
    setIdentityRequests(clientRequests);
    setIdentitySelections((current) => Object.fromEntries(clientRequests.map((request) => [request.id, current[request.id] ?? request.approvedFields ?? []])));
  }, [clientId]);
  useEffect(() => { if (clientId) void load(); }, [clientId, load]);

  const calculations = useMemo(() => {
    if (!client) return {income: 0, payments: 0, ratio: 0, ltv: 0};
    const income = calculateTotalMonthlyIncome(client.monthlyNetIncome, client.additionalIncomeAmount);
    const payments = calculateTotalMonthlyPayments(client.monthlyLiabilities, client.existingMortgageMonthlyPayment);
    return {income, payments, ratio: calculateRepaymentRatio(payments, income), ltv: calculateLoanToValue(client.requestedAmount, client.propertyValue)};
  }, [client]);

  if (!client) return <main className="advisor-page"><div className="empty-state">טוען את תיק הלקוח…</div></main>;

  const info = (label: string, value: ReactNode) => <div className="info-row"><dt>{label}</dt><dd>{value === "" || value === null || value === undefined ? "לא צוין" : value}</dd></div>;
  const latestSubmission = submissions[0];

  const openEditor = () => {
    setEditForm(clientToForm(client)); setEditErrors({}); setEditStep(1); setToast(null); setEditing(true);
  };
  const changeEdit = <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => {
    setEditForm((current) => {
      if (!current) return current;
      if (key === "numberOfChildren") {
        const count = value as string;
        return {...current, numberOfChildren: count, childrenAges: resizeChildrenAges(current.childrenAges, count)};
      }
      if (key === "hasAdditionalIncome" && value === "no") return {...current, hasAdditionalIncome: "no", additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: ""};
      return {...current, [key]: value};
    });
    setEditErrors((current) => { const next = {...current}; delete next[String(key)]; return next; });
  };
  const advanceEdit = () => {
    if (!editForm) return;
    const errors = validateClientForm(editForm, editStep); setEditErrors(errors);
    if (Object.keys(errors).length === 0) setEditStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  };
  const saveEdit = async () => {
    if (!editForm) return;
    const errors = validateClientForm(editForm); setEditErrors(errors);
    if (Object.keys(errors).length > 0) { setToast({type: "error", text: "יש לתקן את השדות המסומנים לפני השמירה."}); return; }
    setSaving(true); setToast(null);
    try {
      const updated = await api.updateClient(client.id, clientFormPayload(editForm));
      setClient(updated); setEditing(false); setToast({type: "success", text: "פרטי הלקוח נשמרו בהצלחה."});
    } catch (caught) {
      if (caught instanceof ApiError) {
        setEditErrors(caught.fieldErrors);
        setToast({type: "error", text: caught.code === "VALIDATION_ERROR" ? "יש לתקן את השדות המסומנים." : "שמירת פרטי הלקוח נכשלה.", requestId: caught.requestId});
      } else setToast({type: "error", text: "שמירת פרטי הלקוח נכשלה."});
    } finally { setSaving(false); }
  };

  return <main className="advisor-page client-detail-page">
    {toast && <div className={`toast ${toast.type}`} role="status"><strong>{toast.text}</strong>{toast.requestId && <small>מזהה בקשה: {toast.requestId}</small>}</div>}
    <section className="client-profile-header content-card">
      <div className="client-profile-title"><span className="client-avatar large">{client.firstName.slice(0, 1)}{client.lastName.slice(0, 1)}</span><div><span className="eyebrow">תיק {client.publicCaseNumber}</span><h1>{client.firstName} {client.lastName}</h1><span className={`status-badge status-${client.status.toLowerCase()}`}>{formatClientStatus(client.status)}</span></div></div>
      <div className="client-profile-metrics"><div><small>סכום מבוקש</small><strong>{formatCurrency(client.requestedAmount)}</strong></div><div><small>שווי הנכס</small><strong>{formatCurrency(client.propertyValue)}</strong></div><div><small>אחוז מימון</small><strong>{formatPercentage(calculations.ltv)}</strong></div></div>
      <div className="profile-actions"><button type="button" className="secondary-action" onClick={openEditor}><Edit3 size={17} />עריכה</button><button type="button" className="secondary-action" onClick={() => setTab("מסמכים")}><FileUp size={17} />העלאת מסמך</button><button type="button" className="primary-action" onClick={() => setTab("חברות מימון")}><Send size={17} />שליחה לחברות מימון</button></div>
    </section>
    <nav className="client-tabs" aria-label="כרטיסיות תיק לקוח">{tabs.map((item) => <button type="button" className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <section className="content-card tab-content">
      {tab === "תקציר" && <div className="summary-grid">
        <article><h2>תמונת מצב</h2><dl>{info("סטטוס התיק", formatClientStatus(client.status))}{info("סוג העסקה", formatDealType(client.dealType))}{info("סטטוס מול חברות", formatSubmissionStatus(latestSubmission?.status ?? null))}{info("מספר הצעות", offers.length)}{info("עודכן לאחרונה", formatDate(client.updatedAt))}</dl></article>
        <article><h2>נתונים פיננסיים</h2><dl>{info("סך הכנסה חודשית", formatCurrency(calculations.income))}{info("סך החזרים חודשיים", formatCurrency(calculations.payments))}{info("יחס החזר", formatPercentage(calculations.ratio))}{info("אחוז מימון", formatPercentage(calculations.ltv))}{info("יתרת משכנתה קיימת", formatCurrency(client.existingMortgageBalance))}</dl></article>
      </div>}
      {tab === "פרטים אישיים" && <div className="detail-section"><h2>פרטים אישיים</h2><dl className="detail-grid">{info("שם מלא", `${client.firstName} ${client.lastName}`)}{info("מספר תעודת זהות", maskIdentityNumber(client.identityNumber))}{info("תאריך לידה", formatDate(client.birthDate))}{info("טלפון", client.phone)}{info("דוא״ל", client.email)}{info("כתובת מגורים", client.address)}{info("מצב משפחתי", formatMaritalStatus(client.maritalStatus))}{info("מספר ילדים", client.numberOfChildren)}{info("גילאי הילדים", client.childrenAges.length ? client.childrenAges.join(", ") : "אין ילדים")}{info("מספר לווים בתיק", client.borrowerCount)}</dl></div>}
      {tab === "הכנסות" && <div className="detail-section"><h2>הכנסות ותעסוקה</h2><dl className="detail-grid">{info("סוג תעסוקה", formatEmploymentType(client.employmentType))}{info("שם המעסיק או העסק", client.employerName)}{info("תפקיד", client.jobTitle)}{info("ותק", `${client.employmentSeniorityYears} שנים`)}{info("הכנסה חודשית נטו", formatCurrency(client.monthlyNetIncome))}{info("האם קיימת הכנסה נוספת", client.hasAdditionalIncome ? "כן" : "לא")}{client.hasAdditionalIncome && info("סוג הכנסה נוספת", formatAdditionalIncomeType(client.additionalIncomeType))}{client.hasAdditionalIncome && info("סכום הכנסה נוספת", formatCurrency(client.additionalIncomeAmount))}{client.additionalIncomeDescription && info("תיאור הכנסה נוספת", client.additionalIncomeDescription)}{info("סך הכנסה חודשית", formatCurrency(calculations.income))}</dl></div>}
      {tab === "התחייבויות" && <div className="detail-section"><h2>התחייבויות</h2><dl className="detail-grid">{info("התחייבויות חודשיות שאינן משכנתה", formatCurrency(client.monthlyLiabilities))}{info("יתרת משכנתה קיימת", formatCurrency(client.existingMortgageBalance))}{info("החזר משכנתה חודשי", formatCurrency(client.existingMortgageMonthlyPayment))}{info("סך החזרים חודשיים", formatCurrency(calculations.payments))}{info("יחס החזר", formatPercentage(calculations.ratio))}</dl></div>}
      {tab === "נכס" && <div className="detail-section"><h2>נכס ובקשת מימון</h2><dl className="detail-grid">{info("סוג העסקה", formatDealType(client.dealType))}{info("סוג הנכס", formatPropertyType(client.propertyType))}{client.propertyTypeOtherDescription && info("תיאור סוג הנכס", client.propertyTypeOtherDescription)}{info("עיר", client.propertyCity)}{info("אזור", formatRegion(client.propertyRegion))}{info("כתובת הנכס", client.propertyAddress)}{info("שווי הנכס", formatCurrency(client.propertyValue))}{info("סכום המימון המבוקש", formatCurrency(client.requestedAmount))}{info("אחוז מימון", formatPercentage(calculations.ltv))}{info("תקופת ההלוואה", `${client.requestedTermMonths} חודשים`)}{info("יתרת משכנתה קיימת", formatCurrency(client.existingMortgageBalance))}{info("החזר משכנתה חודשי", formatCurrency(client.existingMortgageMonthlyPayment))}{info("הערות מקצועיות", client.notes)}</dl></div>}
      {tab === "מסמכים" && <DocumentManager clientId={client.id} />}
      {tab === "חברות מימון" && <LoanArena clientId={client.id} />}
      {tab === "בקשות חשיפה" && <div className="detail-section"><h2>בקשות חשיפת זהות</h2>{identityRequests.length === 0 ? <div className="empty-state">אין בקשות חשיפה בתיק זה.</div> : <div className="request-list">{identityRequests.map((request) => {
        const selectedFields = identitySelections[request.id] ?? [];
        return <article className="request-card" key={request.id}><div><span className="status-badge status-active">{formatIdentityStatus(request.status)}</span><h3>{request.lenderName ?? "חברת מימון"}</h3><p>{request.reason}</p><small>הוגש בתאריך {formatDate(request.createdAt)}</small></div><div className="requested-fields">{request.requestedFields.map((field) => <span key={field}>{formatIdentityField(field)}</span>)}</div>{request.status === "PENDING" && <><fieldset className="identity-approval-fields"><legend>בחירת פרטים לחשיפה</legend>{request.requestedFields.map((field) => <label key={field}><input type="checkbox" aria-label={`אישור ${formatIdentityField(field)}`} checked={selectedFields.includes(field)} onChange={(event) => setIdentitySelections((current) => ({...current, [request.id]: event.target.checked ? [...selectedFields, field] : selectedFields.filter((item) => item !== field)}))} />{formatIdentityField(field)}</label>)}</fieldset><div className="request-actions"><button type="button" className="secondary-action danger" onClick={() => void api.decideIdentity(request.id, false, [], []).then(load)}>דחייה</button><button type="button" className="primary-action" disabled={selectedFields.length === 0} onClick={() => void api.decideIdentity(request.id, true, selectedFields, []).then(load)}>אישור השדות שנבחרו</button></div></>}</article>;
      })}</div>}</div>}
      {tab === "הצעות" && <div className="detail-section"><h2>הצעות מימון</h2>{offers.length === 0 ? <div className="empty-state">עדיין לא התקבלו הצעות לתיק זה.</div> : <div className="offers-grid">{offers.map((offer) => <article className="offer-card" key={offer.id}><span className="stat-icon green"><Building2 /></span><div><h3>{offer.lenderName}</h3><span className="status-badge status-active">{formatOfferStatus(offer.status)}</span></div><strong>{formatCurrency(offer.amount)}</strong><dl>{info("ריבית", `${offer.interestRate}%`)}{info("תקופה", `${offer.termMonths} חודשים`)}{info("החזר חודשי", offer.monthlyPayment ? formatCurrency(offer.monthlyPayment) : "טרם חושב")}</dl>{offer.conditions && <p>{offer.conditions}</p>}</article>)}</div>}</div>}
      {tab === "פעילות" && <div className="detail-section"><h2>פעילות אחרונה</h2><div className="timeline"><article><span /><div><strong>התיק עודכן</strong><p>{formatDate(client.updatedAt)}</p></div></article>{submissions.map((submission) => <article key={submission.id}><span /><div><strong>{submission.lenderName}</strong><p>{formatSubmissionStatus(submission.status)} · {formatDate(submission.updatedAt)}</p></div></article>)}</div></div>}
    </section>
    {editing && editForm && <div className="modal-backdrop"><section className="modal client-edit-modal content-card" role="dialog" aria-modal="true" aria-labelledby="edit-client-title">
      <header className="modal-heading"><div><span className="eyebrow">שלב {editStep} מתוך 3</span><h2 id="edit-client-title">עריכת תיק לקוח</h2></div><button type="button" className="icon-action" aria-label="סגירת חלון עריכה" onClick={() => setEditing(false)}><X /></button></header>
      <div className="edit-progress"><span style={{inlineSize: `${editStep * 33.333}%`}} /></div>
      <ClientFormFields form={editForm} errors={editErrors} step={editStep} onChange={changeEdit} />
      <div className="modal-actions"><button type="button" className="ghost-action" onClick={() => setEditing(false)}>ביטול</button>{editStep > 1 && <button type="button" className="secondary-action" onClick={() => { setEditErrors({}); setEditStep((current) => current - 1 as 1 | 2); }}><ArrowRight size={17} />הקודם</button>}{editStep < 3 ? <button type="button" className="primary-action" onClick={advanceEdit}>הבא<ArrowLeft size={17} /></button> : <button type="button" className="primary-action" disabled={saving} onClick={() => void saveEdit()}>{saving ? "שומר…" : "שמירת שינויים"}</button>}</div>
    </section></div>}
  </main>;
}
