import { useCallback, useEffect, useState, type Key, type ReactNode } from "react";
import { AlertTriangle, Edit3, FileUp, LoaderCircle, Send, X } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Client, ClientBorrower, ClientLiability, ClientSubmission, DeliveryBlocker } from "../types";
import { ApiError, api } from "../utils/apiClient";
import { calculateRemainingCommitmentPeriod } from "../utils/commitmentPeriod";
import { clientEditPath, clientTabFromSearch, clientTabs, type ClientTab } from "../utils/clientEditRoutes";
import { formatAdditionalIncomeType, formatBorrowerRelationship, formatClientStatus, formatCurrency, formatDate, formatEmploymentType, formatLiabilityType, formatLoanPurpose, formatMaritalStatus, formatPropertyType, formatSubmissionStatus, maskIdentityNumber } from "../utils/formatters";
import CreditIndicationView from "./CreditIndicationView";
import DocumentManager from "./DocumentManager";
import LoanArena from "./LoanArena";
import CompanyResponsesView from "./CompanyResponsesView";

export default function ClientDetailView() {
  const {id = ""} = useParams();
  const clientId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = clientTabFromSearch(location.search);
  const [client, setClient] = useState<Client | null>(null);
  const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [deliveryBlockers, setDeliveryBlockers] = useState<DeliveryBlocker[]>([]);
  const [toast, setToast] = useState<string | null>(() => (location.state as {toast?: string} | null)?.toast ?? null);

  const load = useCallback(async () => {
    const [clientResult, submissionResult] = await Promise.all([api.client(clientId), api.submissions(clientId)]);
    setClient(clientResult); setSubmissions(submissionResult);
  }, [clientId]);
  useEffect(() => { if (clientId) void load(); }, [clientId, load]);
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && requested !== tab) setSearchParams({tab: "summary"}, {replace: true});
  }, [searchParams, setSearchParams, tab]);
  useEffect(() => {
    if (!toast) return;
    navigate(`${location.pathname}${location.search}`, {replace: true, state: null});
  }, [location.pathname, location.search, navigate, toast]);
  if (!client) return <main className="advisor-page"><div className="empty-state">טוען את תיק הלקוח…</div></main>;

  const selectTab = (nextTab: ClientTab) => {
    setSearchParams({tab: nextTab});
    window.scrollTo({top: 0, behavior: "smooth"});
  };
  const editButton = (section: "personal" | "income" | "liabilities" | "property" | "deal-details", label: string) => <button type="button" className="secondary-action section-edit-action" title={label} aria-label={label} onClick={() => navigate(clientEditPath(client.id, section))}><Edit3 size={17} />{label}</button>;
  const info = (label: string, value: ReactNode, key?: Key) => <div className="info-row" key={key ?? label}><dt>{label}</dt><dd>{value === "" || value === null || value === undefined ? "לא צוין" : value}</dd></div>;
  const liabilitySummary = (items: ClientLiability[]) => ({balance: items.reduce((sum, item) => sum + (item.currentBalance ?? 0), 0), monthly: items.reduce((sum, item) => sum + item.monthlyPayment, 0), count: items.length});
  const liabilityList = (title: string, items: ClientLiability[]) => {
    const summary = liabilitySummary(items);
    return <article className="borrower-detail-card liability-detail-group" key={title}><header><div><span className="eyebrow">התחייבויות</span><h3>{title}</h3></div></header>{items.length === 0 ? <p className="empty-inline">אין התחייבויות פעילות.</p> : <div className="liability-detail-list">{items.map((liability) => <article className="liability-card" key={liability.id}>{liability.incompleteLegacy && <p className="form-message error">נדרש להשלים את פרטי ההתחייבות שהועברו מהמערכת הישנה.</p>}<dl className="detail-grid">{info("סוג", formatLiabilityType(liability.type))}{liability.otherTypeDescription && info("שם הגוף או סוג ההתחייבות", liability.otherTypeDescription)}{liability.financialInstitution && info("גוף פיננסי", liability.financialInstitution)}{liability.type !== "ALIMONY" && liability.type !== "RENT" && info("יתרה", formatCurrency(liability.currentBalance))}{info("החזר חודשי", formatCurrency(liability.monthlyPayment))}{info("תאריך סיום", formatDate(liability.endDate))}{info("תקופה שנותרה", liability.endDate ? calculateRemainingCommitmentPeriod(liability.endDate)?.label ?? "נדרש להשלים" : "נדרש להשלים")}{info("הערות", liability.notes || "נדרש להשלים")}</dl></article>)}</div>}<div className="form-calculation"><span>סך התחייבויות: <strong>{formatCurrency(summary.balance)}</strong></span><span>סך החזרים: <strong>{formatCurrency(summary.monthly)}</strong></span><span>מספר התחייבויות: <strong>{summary.count}</strong></span></div></article>;
  };
  const borrowerCard = (borrower: ClientBorrower, content: "personal" | "income") => { const additionalTotal = borrower.income.additionalIncomes.reduce((sum, income) => sum + income.monthlyAmount, 0); return <article className="borrower-detail-card" key={borrower.id}><header><div><span className="eyebrow">{borrower.isPrimary ? "לווה ראשי" : `לווה ${borrower.borrowerOrder}`}</span><h3>{borrower.firstName} {borrower.lastName}</h3></div><span className="age-badge">גיל {borrower.age ?? "—"}</span></header>{content === "personal" ? <dl className="detail-grid">{info("מספר תעודת זהות", maskIdentityNumber(borrower.identityNumber))}{info("תאריך לידה", formatDate(borrower.birthDate))}{info("טלפון", borrower.phone)}{info("דוא״ל", borrower.email)}{info("כתובת מגורים", borrower.address)}{info("מצב משפחתי", formatMaritalStatus(borrower.maritalStatus))}{info("מספר ילדים", borrower.children.numberOfChildren)}{info("גילאי הילדים", borrower.children.childrenAges.length ? borrower.children.childrenAges.join(", ") : "אין ילדים")}</dl> : <dl className="detail-grid">{info("סוג תעסוקה", formatEmploymentType(borrower.employment.employmentType))}{info("שם המעסיק או העסק", borrower.employment.employerName)}{info("תפקיד", borrower.employment.jobTitle)}{info("ותק", `${borrower.employment.employmentSeniorityYears} שנים`)}{info("הכנסה חודשית נטו", formatCurrency(borrower.income.monthlyNetIncome))}{info("האם קיימת הכנסה נוספת", borrower.income.additionalIncomes.length ? "כן" : "לא")}{borrower.income.additionalIncomes.map((income, index) => info(`הכנסה נוספת ${index + 1}`, `${formatAdditionalIncomeType(income.type)} · ${formatCurrency(income.monthlyAmount)}${income.description ? ` · ${income.description}` : ""}`, income.id ?? `${borrower.id}-${index}`))}{info("סך הכנסה ללווה", formatCurrency(borrower.income.monthlyNetIncome + additionalTotal))}</dl>}</article>; };
  const latestSubmission = submissions[0];
  const openDelivery = async () => {
    setPreflightBusy(true); setDeliveryBlockers([]);
    try {
      const result = await api.deliveryPreflight(client.id);
      if (result.ready) setSendOpen(true);
      else setDeliveryBlockers(result.blockers);
    } catch (error) {
      if (error instanceof ApiError && error.blockers.length) setDeliveryBlockers(error.blockers);
      else setToast(error instanceof ApiError ? error.publicMessage ?? "לא ניתן לבדוק את מוכנות התיק לשליחה." : "לא ניתן לבדוק את מוכנות התיק לשליחה.");
    } finally { setPreflightBusy(false); }
  };

  return <main className="advisor-page client-detail-page">{toast && <div className="toast success" role="status"><strong>{toast}</strong><button type="button" aria-label="סגירת הודעה" onClick={() => setToast(null)}><X size={16} /></button></div>}
    <section className="client-profile-header content-card"><div className="client-profile-title"><span className="client-avatar large">{client.firstName[0]}{client.lastName[0]}</span><div><span className="eyebrow">תיק {client.publicCaseNumber}</span><h1>{client.firstName} {client.lastName}{client.numberOfBorrowers > 1 && ` ועוד ${client.numberOfBorrowers - 1}`}</h1><span className={`status-badge status-${client.status.toLowerCase()}`}>{formatClientStatus(client.status)}</span>{client.missingRequiredDocumentCount > 0 && <span className="status-badge status-warning">בתיק חסרים מסמכי חובה · {client.missingRequiredDocumentCount}</span>}</div></div><div className="client-profile-metrics"><div><small>סכום מבוקש</small><strong>{formatCurrency(client.requestedAmount)}</strong></div><div><small>שווי הנכס</small><strong>{formatCurrency(client.propertyValue)}</strong></div><div><small>התחייבויות פעילות</small><strong>{client.activeLiabilityCount}</strong></div></div><div className="profile-actions"><button type="button" className="secondary-action" onClick={() => navigate(clientEditPath(client.id))}><Edit3 size={17} />עריכה</button><button type="button" className="secondary-action" onClick={() => selectTab("documents")}><FileUp size={17} />העלאת מסמך</button><button type="button" className="primary-action" disabled={preflightBusy} aria-busy={preflightBusy} onClick={() => void openDelivery()}>{preflightBusy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{preflightBusy ? "בודק את התיק…" : "שליחה לחברות מימון"}{!preflightBusy && client.missingRequiredDocumentCount > 0 && <b className="missing-count">{client.missingRequiredDocumentCount}</b>}</button></div></section>
    <nav className="client-tabs" aria-label="כרטיסיות תיק לקוח">{clientTabs.map((item) => <button type="button" className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} key={item.id} onClick={() => selectTab(item.id)}>{item.label}</button>)}</nav>
    <section className="content-card tab-content">
      {tab === "summary" && <div className="summary-grid"><article><h2>תמונת מצב</h2><dl>{info("סטטוס התיק", formatClientStatus(client.status))}{info("מספר לווים", client.numberOfBorrowers)}{info("הקשר בין הלווים", formatBorrowerRelationship(client.borrowerRelationship))}{info("מטרת ההלוואה", formatLoanPurpose(client.loanPurpose))}{info("סטטוס מול חברות", formatSubmissionStatus(latestSubmission?.status ?? null))}{info("עודכן לאחרונה", formatDate(client.updatedAt))}</dl></article><article><h2>נתונים פיננסיים</h2><dl>{info("סך הכנסה חודשית", formatCurrency(client.totalMonthlyIncome))}{info("סך התחייבויות", formatCurrency(client.totalLiabilityBalance))}{info("סך החזרים חודשיים", formatCurrency(client.totalMonthlyPayments))}{info("מספר התחייבויות", client.activeLiabilityCount)}</dl>{client.missingRequiredDocumentCount > 0 && <button type="button" className="document-alert" onClick={() => selectTab("documents")}>בתיק חסרים מסמכי חובה <b>{client.missingRequiredDocumentCount}</b></button>}</article></div>}
      {tab === "personal" && <div className="detail-section"><div className="section-heading compact"><h2>פרטים אישיים</h2>{editButton("personal", "עריכת פרטים אישיים")}</div>{client.household.numberOfChildren > 0 && <article className="borrower-detail-card household-card"><h3>נתוני משק הבית</h3><dl className="detail-grid">{info("מספר ילדים", client.household.numberOfChildren)}{info("גילאי הילדים", client.household.childrenAges.join(", "))}</dl></article>}<div className="borrower-detail-list">{client.borrowers.map((borrower) => borrowerCard(borrower, "personal"))}</div></div>}
      {tab === "income" && <div className="detail-section"><div className="section-heading compact"><h2>הכנסות ותעסוקה</h2>{editButton("income", "עריכת הכנסות")}</div><div className="borrower-detail-list">{client.borrowers.map((borrower) => borrowerCard(borrower, "income"))}</div><div className="aggregate-summary">סך הכנסה חודשית לכל הלווים: <strong>{formatCurrency(client.totalMonthlyIncome)}</strong></div></div>}
      {tab === "liabilities" && <div className="detail-section"><div className="section-heading compact"><h2>התחייבויות</h2>{editButton("liabilities", "עריכת התחייבויות")}</div><div className="borrower-detail-list">{client.borrowerRelationship === "MARRIED" ? liabilityList("התחייבויות משותפות למשק הבית", client.householdLiabilities) : client.borrowers.map((borrower) => liabilityList(`התחייבויות — לווה ${borrower.borrowerOrder}`, borrower.liabilities))}</div><div className="aggregate-summary">סך התחייבויות: <strong>{formatCurrency(client.totalLiabilityBalance)}</strong> · סך החזרים חודשיים: <strong>{formatCurrency(client.totalMonthlyPayments)}</strong> · מספר התחייבויות: <strong>{client.activeLiabilityCount}</strong></div></div>}
      {tab === "property" && <div className="detail-section"><div className="section-heading compact"><h2>נכס ובקשת מימון</h2>{editButton("property", "עריכת פרטי הנכס")}</div><dl className="detail-grid">{info("מטרת ההלוואה", formatLoanPurpose(client.loanPurpose))}{info("סוג הנכס", formatPropertyType(client.propertyType))}{client.propertyTypeOtherDescription && info("תיאור סוג הנכס", client.propertyTypeOtherDescription)}{info("עיר", client.propertyCity)}{info("כתובת הנכס", client.propertyAddress)}{info("שווי הנכס", formatCurrency(client.propertyValue))}{info("סכום המימון המבוקש", formatCurrency(client.requestedAmount))}</dl></div>}
      {tab === "deal-details" && <div className="detail-section"><div className="section-heading compact"><div><h2>פירוט עסקה</h2><p>מידע זה אינו נכלל בתיק האנונימי ללא אישור מפורש.</p></div>{editButton("deal-details", "עריכת סעיף פירוט העסקה")}</div><dl className="detail-grid">{info("מטרת ההלוואה", formatLoanPurpose(client.loanPurpose))}{info("עודכן לאחרונה", formatDate(client.dealDetailsUpdatedAt))}{info("עודכן על ידי", client.dealDetailsUpdatedBy)}</dl><div className="deal-details-text">{client.dealDetails}</div></div>}
      {tab === "credit-indication" && <CreditIndicationView clientId={client.id} indication={client.creditIndication} onUpdated={() => void load()} />}
      {tab === "documents" && <DocumentManager clientId={client.id} borrowers={client.borrowers} onUpdated={() => void load()} />}
      {tab === "company-responses" && <CompanyResponsesView clientId={client.id} />}
    </section>
    {sendOpen && <div className="modal-backdrop"><section className="modal send-client-modal content-card" role="dialog" aria-modal="true" aria-label="שליחה לחברות מימון"><header className="modal-heading"><h2>שליחה לחברות מימון</h2><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setSendOpen(false)}><X /></button></header><LoanArena clientId={client.id} onMissingDocuments={() => {setSendOpen(false); selectTab("documents");}} /></section></div>}
    {deliveryBlockers.length > 0 && <div className="modal-backdrop"><section className="modal preflight-modal content-card" role="dialog" aria-modal="true" aria-labelledby="delivery-blockers-title"><header className="modal-heading"><div><span className="eyebrow">בדיקת מוכנות</span><h2 id="delivery-blockers-title">לא ניתן לשלוח את התיק</h2></div><button type="button" className="icon-action" aria-label="סגירה" onClick={() => setDeliveryBlockers([])}><X /></button></header><p>לפני שליחה לחברות מימון יש להשלים את הפריטים הבאים:</p><ul className="delivery-blockers-list">{deliveryBlockers.map((blocker) => <li key={blocker.code}><AlertTriangle aria-hidden="true" /><span><strong>{blocker.label}</strong><small>{blocker.hint}</small></span></li>)}</ul><div className="modal-actions wrap"><button type="button" className="secondary-action" onClick={() => setDeliveryBlockers([])}>סגירה</button>{deliveryBlockers.some((item) => item.action === "edit") && <button type="button" className="secondary-action" onClick={() => navigate(clientEditPath(client.id))}><Edit3 size={17} />מעבר לעריכת התיק</button>}{deliveryBlockers.some((item) => item.action === "documents") && <button type="button" className="primary-action" onClick={() => {setDeliveryBlockers([]); selectTab("documents");}}><FileUp size={17} />מעבר למסמכים</button>}</div></section></div>}
  </main>;
}
