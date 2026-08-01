import {useEffect, useState, type ReactNode} from "react";
import {Building2, CheckCircle2, Download, Eye, FileArchive, FileText, KeyRound, LockKeyhole, LogOut, ShieldCheck, XCircle} from "lucide-react";
import {useNavigate, useParams} from "react-router-dom";
import type {ExternalAccess, ExternalPortalCase, ExternalPortalDocument, ExternalReview} from "../types";
import {ApiError, api} from "../utils/apiClient";
import {emailServerAcceptedMessage, formatBorrowerRelationship, formatCurrency, formatDate, formatLoanPurpose, formatPropertyType} from "../utils/formatters";
import {useResendCooldown} from "../utils/resendCooldown";
import {openFreshPdfBlob} from "../utils/pdfBlob";
import {ExternalBorrowersSection, type ExternalBorrowerDetailsModel, type ExternalLiabilityDetails} from "./ExternalBorrowerDetails";
import SynCashLogo from "./SynCashLogo";

const errorMessage = (error: unknown) => error instanceof ApiError ? error.publicMessage ?? "לא ניתן להשלים את הפעולה." : "לא ניתן להשלים את הפעולה.";
const downloadBlob = (blob: Blob, filename: string, open = false) => {
  if (open) {openFreshPdfBlob(blob); return;}
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

function ExternalShell({children}: {children: ReactNode}) {
  return <main className="external-shell" dir="rtl"><header className="external-header"><SynCashLogo size="md" /><span><ShieldCheck />סביבה מאובטחת לבחינת תיק מימון</span></header><section className="external-content">{children}</section><footer>המידע חסוי ומיועד לנמען המורשה בלבד · SynCash</footer></main>;
}

function MaskedCase({snapshot}: {snapshot: Record<string, unknown>}) {
  const data = snapshot as {
    numberOfBorrowers?: number; borrowerRelationship?: string; household?: {numberOfChildren?: number; childrenAges?: number[]};
    loanRequest?: {purpose?: string; requestedAmount?: number; requestedTermMonths?: number; loanToValue?: number};
    property?: {propertyType?: string; city?: string; value?: number}; totals?: {monthlyIncome?: number; liabilityBalance?: number; monthlyPayments?: number};
    borrowers?: ExternalBorrowerDetailsModel[];
    householdLiabilities?: ExternalLiabilityDetails[];
    dealDetails?: string; documentStatus?: string;
  };
  return <div className="external-case-grid"><article className="external-summary-card"><h2>תקציר העסקה</h2><dl><div><dt>מטרת ההלוואה</dt><dd>{formatLoanPurpose(data.loanRequest?.purpose ?? "")}</dd></div><div><dt>סכום מבוקש</dt><dd>{formatCurrency(data.loanRequest?.requestedAmount ?? 0)}</dd></div><div><dt>שווי הנכס</dt><dd>{formatCurrency(data.property?.value ?? 0)}</dd></div><div><dt>אחוז מימון</dt><dd>{data.loanRequest?.loanToValue ?? 0}%</dd></div><div><dt>תקופה</dt><dd>{data.loanRequest?.requestedTermMonths ?? 0} חודשים</dd></div><div><dt>סוג נכס</dt><dd>{formatPropertyType(data.property?.propertyType ?? "")}</dd></div><div><dt>עיר הנכס</dt><dd>{data.property?.city || "לא צוין"}</dd></div></dl></article>
    <article className="external-summary-card"><h2>סיכום פיננסי</h2><dl><div><dt>סך הכנסה חודשית</dt><dd>{formatCurrency(data.totals?.monthlyIncome ?? 0)}</dd></div><div><dt>סך יתרות</dt><dd>{formatCurrency(data.totals?.liabilityBalance ?? 0)}</dd></div><div><dt>סך החזרים</dt><dd>{formatCurrency(data.totals?.monthlyPayments ?? 0)}</dd></div><div><dt>מספר לווים</dt><dd>{data.numberOfBorrowers ?? 0}</dd></div><div><dt>קשר בין הלווים</dt><dd>{formatBorrowerRelationship(data.borrowerRelationship ?? "")}</dd></div></dl></article>
    <ExternalBorrowersSection mode="MASKED" title="לווים מוסווים" borrowers={data.borrowers} borrowerRelationship={data.borrowerRelationship} household={data.household} householdLiabilities={data.householdLiabilities} />
    <article className="external-wide external-summary-card"><h2>פירוט העסקה לאחר הסוואה</h2><p className="deal-details-text">{data.dealDetails || "לא צוין"}</p><p className="security-note"><ShieldCheck />{data.documentStatus ?? "כל מסמכי החובה קיימים בתיק"}</p></article>
  </div>;
}

export function ExternalReviewPage() {
  const {token = ""} = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<ExternalReview | null>(null);
  const [code, setCode] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [otpLastSentAt, setOtpLastSentAt] = useState<string | null>(null);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState(5);
  const otpCooldownSeconds = useResendCooldown(otpLastSentAt);
  useEffect(() => {void api.externalReview(token).then(setReview).catch((caught) => setError(errorMessage(caught)));}, [token]);
  const action = async (work: () => Promise<unknown>, success: string) => {setBusy(true); setError(""); try {await work(); setMessage(success); setReview(await api.externalReview(token));} catch (caught) {setError(errorMessage(caught));} finally {setBusy(false);}};
  const sendInterestCode = async (resend: boolean) => {
    if (otpCooldownSeconds > 0 || otpAttemptsRemaining <= 0) return;
    setBusy(true); setError("");
    try {
      const result = resend ? await api.externalResendInterest(token, review!.csrfToken) : await api.externalStartInterest(token, review!.csrfToken);
      setOtpLastSentAt(result.lastSentAt); setOtpAttemptsRemaining(result.attemptsRemaining); setOtpOpen(true);
      setMessage(result.status === "SMTP_ACCEPTED" ? emailServerAcceptedMessage(result.recipientMasked) : `המייל הועבר לתור השליחה עבור ${result.recipientMasked}.`);
      setReview(await api.externalReview(token));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };
  if (error && !review) return <ExternalShell><div className="external-state error"><XCircle /><h1>לא ניתן לפתוח את התיק</h1><p>{error}</p></div></ExternalShell>;
  if (!review) return <ExternalShell><div className="external-state"><LockKeyhole /><p>טוען תיק מאובטח…</p></div></ExternalShell>;
  return <ExternalShell><section className="external-title"><div><span className="eyebrow">{review.companyName}</span><h1>תיק מימון מוסווה לבחינה</h1><p>תיק {review.publicCaseNumber} · גרסה {review.versionNumber}</p></div><div className="deadline-card"><small>מועד אחרון למתן תשובה</small><strong>{formatDate(review.responseDeadlineAt)}</strong></div></section>
    {review.message && <p className="form-message success">{review.message}</p>}{message && <p className="form-message success" role="status">{message}</p>}{error && !otpOpen && <p className="form-message error" role="alert">{error}</p>}
    <MaskedCase snapshot={review.maskedSnapshot} />
    <div className="external-actions"><button type="button" className="secondary-action" onClick={() => void api.externalMaskedPdf(token).then((blob) => downloadBlob(blob, "תיק-מוסווה.pdf", true)).catch((caught) => setError(errorMessage(caught)))}><Eye />צפייה ב־PDF</button><button type="button" className="secondary-action" onClick={() => void api.externalMaskedPdf(token, true).then((blob) => downloadBlob(blob, "תיק-מימון-מוסווה.pdf")).catch((caught) => setError(errorMessage(caught)))}><Download />הורדת PDF</button></div>
    {!review.closed && review.decisionStatus !== "INTERESTED" && review.decisionStatus !== "NOT_INTERESTED" && <div className="decision-panel"><h2>החלטת החברה</h2><p>התגובה הראשונה שתושלם תקבע עבור כל אנשי הקשר בחברה.</p><div><button type="button" className="danger-action" disabled={busy} onClick={() => {if (window.confirm("לאשר שהחברה אינה מעוניינת בתיק?")) void action(() => api.externalNotInterested(token, review.csrfToken), "התגובה נשמרה. תודה על המענה.");}}><XCircle />לא מעוניינים</button><button type="button" className="primary-action" disabled={busy} onClick={() => void sendInterestCode(false)}><CheckCircle2 />מעוניינים</button></div></div>}
    {otpOpen && <div className="modal-backdrop"><form className="modal content-card otp-modal" onSubmit={(event) => {event.preventDefault(); setBusy(true); setError(""); void api.externalVerifyInterest(token, code, review.csrfToken).then(() => navigate("/external/portal", {replace: true})).catch((caught) => setError(errorMessage(caught))).finally(() => setBusy(false));}}><KeyRound /><h2>אימות בדוא״ל</h2><p>הזן את הקוד בן שש הספרות שנשלח אליך. לאחר האימות תועבר מיד לתיק המלא.</p><label><span>קוד חד־פעמי</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label>{error && <p className="form-message error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setOtpOpen(false)}>ביטול</button><button type="button" className="text-action" disabled={busy || otpCooldownSeconds > 0 || otpAttemptsRemaining <= 0} onClick={() => void sendInterestCode(true)}>{otpCooldownSeconds > 0 ? `שליחת המייל מחדש בעוד ${otpCooldownSeconds} שניות` : "שליחת המייל מחדש"}</button><button type="submit" className="primary-action" disabled={busy || code.length !== 6}>אימות ומעבר לתיק המלא</button></div>{otpAttemptsRemaining <= 0 && <p>אם המייל עדיין לא הגיע, ודא שהכתובת נכונה ובדוק את תיקיית הספאם.</p>}</form></div>}
  </ExternalShell>;
}

export function ExternalAccessPage() {
  const {token = ""} = useParams(); const navigate = useNavigate();
  const [access, setAccess] = useState<ExternalAccess | null>(null); const [code, setCode] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [lastSentAt, setLastSentAt] = useState<string | null>(null); const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const cooldownSeconds = useResendCooldown(lastSentAt);
  useEffect(() => {void api.externalAccess(token).then((result) => {if (result.authenticated || !result.requiresOtp) {navigate("/external/portal", {replace: true}); return;} setAccess(result);}).catch((caught) => setError(errorMessage(caught)));}, [navigate, token]);
  if (error && !access) return <ExternalShell><div className="external-state error"><XCircle /><h1>הגישה אינה זמינה</h1><p>{error}</p></div></ExternalShell>;
  if (!access) return <ExternalShell><div className="external-state"><LockKeyhole /><p>בודק הרשאת גישה…</p></div></ExternalShell>;
  const sendCode = async () => {if (cooldownSeconds > 0 || attemptsRemaining <= 0) return; setBusy(true); setError(""); try {const result = await api.externalSendAccessCode(token, access.csrfToken); setLastSentAt(result.lastSentAt); setAttemptsRemaining(result.attemptsRemaining); setMessage(result.status === "SMTP_ACCEPTED" ? emailServerAcceptedMessage(result.recipientMasked) : `המייל הועבר לתור השליחה עבור ${result.recipientMasked}.`); setSent(true);} catch (caught) {setError(errorMessage(caught));} finally {setBusy(false);}};
  const verify = async (event: React.FormEvent) => {event.preventDefault(); setBusy(true); setError(""); try {await api.externalVerifyAccessCode(token, code, access.csrfToken); navigate("/external/portal", {replace: true});} catch (caught) {setError(errorMessage(caught));} finally {setBusy(false);}};
  return <ExternalShell><section className="external-auth-card"><LockKeyhole /><span className="eyebrow">{access.companyName}</span><h1>גישה מלאה לתיק</h1><p>תיק {access.publicCaseNumber} · גרסה {access.versionNumber}</p><p>הגישה בתוקף עד {formatDate(access.expiresAt)}. הכניסה אישית ודורשת קוד חד־פעמי.</p>{message && <p className="form-message success">{message}</p>}{error && <p className="form-message error">{error}</p>}{!sent ? <button type="button" className="primary-action large" disabled={busy} onClick={() => void sendCode()}><KeyRound />שליחת קוד כניסה</button> : <form onSubmit={(event) => void verify(event)}><label><span>קוד חד־פעמי</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label><button type="submit" className="primary-action large" disabled={busy || code.length !== 6}>כניסה מאובטחת</button><button type="button" className="text-action" disabled={busy || cooldownSeconds > 0 || attemptsRemaining <= 0} onClick={() => void sendCode()}>{cooldownSeconds > 0 ? `שליחת המייל מחדש בעוד ${cooldownSeconds} שניות` : "שליחת המייל מחדש"}</button>{attemptsRemaining <= 0 && <p>אם המייל עדיין לא הגיע, ודא שהכתובת נכונה ובדוק את תיקיית הספאם.</p>}</form>}</section></ExternalShell>;
}

function PortalOfferForm({csrfToken}: {csrfToken: string}) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      await api.externalPortalOffer({idempotencyKey, amount: Number(amount), interestRate: Number(interestRate), termMonths: Number(termMonths), ...(monthlyPayment ? {monthlyPayment: Number(monthlyPayment)} : {}), ...(conditions.trim() ? {conditions: conditions.trim()} : {})}, csrfToken);
      setMessage("ההצעה הוגשה בהצלחה ליועץ."); setIdempotencyKey(crypto.randomUUID()); setAmount(""); setInterestRate(""); setTermMonths(""); setMonthlyPayment(""); setConditions("");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };
  return <section className="external-wide external-summary-card portal-offer-card"><h2>הגשת הצעת מימון</h2><p>ההצעה תישמר בתיק ותוצג ליועץ המטפל.</p>{message && <p className="form-message success" role="status">{message}</p>}{error && <p className="form-message error" role="alert">{error}</p>}<form className="portal-offer-form" onSubmit={(event) => void submit(event)}><label><span>סכום ההצעה *</span><input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="הזן סכום בש״ח" required /></label><label><span>ריבית שנתית באחוזים *</span><input type="number" min="0" max="100" step="0.01" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="לדוגמה 4.75" required /></label><label><span>תקופה בחודשים *</span><input type="number" min="12" max="600" step="1" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="בין 12 ל־600 חודשים" required /></label><label><span>החזר חודשי משוער</span><input type="number" min="0" step="1" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder="הזן סכום בש״ח" /></label><label className="full-width"><span>תנאים והערות</span><textarea maxLength={4000} value={conditions} onChange={(event) => setConditions(event.target.value)} placeholder="פרט תנאים, עמלות או דרישות נוספות" /></label><button type="submit" className="primary-action" disabled={busy}>{busy ? "שומר את ההצעה…" : "הגשת הצעה"}</button></form></section>;
}

export function ExternalPortalPage() {
  const navigate = useNavigate(); const [portal, setPortal] = useState<ExternalPortalCase | null>(null); const [documents, setDocuments] = useState<ExternalPortalDocument[]>([]); const [error, setError] = useState("");
  useEffect(() => {void Promise.all([api.externalPortalCase(), api.externalPortalDocuments()]).then(([caseResult, documentResult]) => {setPortal(caseResult); setDocuments(documentResult);}).catch((caught) => setError(errorMessage(caught)));}, []);
  if (error && !portal) return <ExternalShell><div className="external-state error"><XCircle /><h1>הגישה לתיק הסתיימה</h1><p>{error}</p></div></ExternalShell>;
  if (!portal) return <ExternalShell><div className="external-state"><LockKeyhole /><p>טוען את התיק המלא…</p></div></ExternalShell>;
  const snapshot = portal.snapshot as {publicCaseNumber?: string; numberOfBorrowers?: number; borrowerRelationship?: string; household?: {numberOfChildren?: number; childrenAges?: number[]}; advisor?: {fullName?: string; businessName?: string; phone?: string; email?: string; website?: string}; borrowers?: ExternalBorrowerDetailsModel[]; householdLiabilities?: ExternalLiabilityDetails[]; property?: {propertyType?: string; city?: string; address?: string; value?: number}; loanRequest?: {purpose?: string; requestedAmount?: number; requestedTermMonths?: number; loanToValue?: number}; totals?: {monthlyIncome?: number; liabilityBalance?: number; monthlyPayments?: number}; dealDetails?: string};
  return <ExternalShell><section className="external-title"><div><span className="eyebrow">{portal.companyName}</span><h1>תיק מימון מלא</h1><p>תיק {snapshot.publicCaseNumber} · גרסה {portal.versionNumber}</p></div><div className="external-actions"><button type="button" className="secondary-action" onClick={() => void api.externalPortalPdf().then((blob) => downloadBlob(blob, "תיק-מימון-מלא.pdf"))}><FileText />PDF מלא</button><button type="button" className="secondary-action" onClick={() => void api.externalPortalZip().then((blob) => downloadBlob(blob, "תיק-מימון-מלא.zip"))}><FileArchive />הורדת כל התיק</button><button type="button" className="danger-action" onClick={() => void api.externalPortalLogout(portal.csrfToken).then(() => navigate("/login", {replace: true}))}><LogOut />יציאה</button></div></section>
    <section className="advisor-contact-card"><Building2 /><div><span className="eyebrow">היועץ המטפל</span><h2>{snapshot.advisor?.fullName}</h2><p>{snapshot.advisor?.businessName}</p><div className="external-actions"><a href={`tel:${snapshot.advisor?.phone}`}>חיוג: {snapshot.advisor?.phone}</a><a href={`mailto:${snapshot.advisor?.email}`}>דוא״ל: {snapshot.advisor?.email}</a>{snapshot.advisor?.phone && <a href={`https://wa.me/972${snapshot.advisor.phone.replace(/\D/g, "").replace(/^0/, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}{snapshot.advisor?.website && <a href={snapshot.advisor.website} target="_blank" rel="noreferrer">אתר היועץ</a>}</div></div></section>
    <div className="external-case-grid"><article className="external-summary-card"><h2>בקשת המימון והנכס</h2><dl><div><dt>מטרת ההלוואה</dt><dd>{formatLoanPurpose(snapshot.loanRequest?.purpose ?? "")}</dd></div><div><dt>סכום מבוקש</dt><dd>{formatCurrency(snapshot.loanRequest?.requestedAmount ?? 0)}</dd></div><div><dt>תקופת ההלוואה</dt><dd>{snapshot.loanRequest?.requestedTermMonths ?? 0} חודשים</dd></div><div><dt>סוג הנכס</dt><dd>{formatPropertyType(snapshot.property?.propertyType ?? "")}</dd></div><div><dt>עיר הנכס</dt><dd>{snapshot.property?.city}</dd></div><div><dt>כתובת הנכס</dt><dd>{snapshot.property?.address}</dd></div><div><dt>שווי הנכס</dt><dd>{formatCurrency(snapshot.property?.value ?? 0)}</dd></div><div><dt>אחוז מימון</dt><dd>{snapshot.loanRequest?.loanToValue ?? 0}%</dd></div></dl></article><article className="external-summary-card"><h2>סיכום פיננסי ומשפחתי</h2><dl><div><dt>סך הכנסה</dt><dd>{formatCurrency(snapshot.totals?.monthlyIncome ?? 0)}</dd></div><div><dt>סך יתרות</dt><dd>{formatCurrency(snapshot.totals?.liabilityBalance ?? 0)}</dd></div><div><dt>סך החזרים</dt><dd>{formatCurrency(snapshot.totals?.monthlyPayments ?? 0)}</dd></div><div><dt>מספר לווים</dt><dd>{snapshot.numberOfBorrowers ?? 0}</dd></div><div><dt>קשר בין הלווים</dt><dd>{formatBorrowerRelationship(snapshot.borrowerRelationship ?? "")}</dd></div><div><dt>גילאי הילדים</dt><dd>{snapshot.household?.childrenAges?.length ? snapshot.household.childrenAges.join(", ") : "אין ילדים"}</dd></div></dl></article>
      <ExternalBorrowersSection mode="FULL" title="פרטי הלווים" borrowers={snapshot.borrowers} borrowerRelationship={snapshot.borrowerRelationship} household={snapshot.household} householdLiabilities={snapshot.householdLiabilities} />
      <article className="external-wide external-summary-card"><h2>פירוט העסקה</h2><p className="deal-details-text">{snapshot.dealDetails}</p></article>
      <section className="external-wide"><h2>מסמכי התיק</h2><div className="document-card-grid">{documents.map((document) => <article className="document-card" key={document.publicId}><FileText /><div><h3>{document.displayName}</h3><small>{Math.ceil(document.sizeBytes / 1024)} ק״ב · {formatDate(document.createdAt)}</small></div><div><button type="button" className="icon-action" aria-label={`צפייה ב${document.displayName}`} onClick={() => void api.externalPortalDocument(document.publicId).then((blob) => downloadBlob(blob, document.displayName, true))}><Eye /></button><button type="button" className="icon-action" aria-label={`הורדת ${document.displayName}`} onClick={() => void api.externalPortalDocument(document.publicId, true).then((blob) => downloadBlob(blob, document.displayName))}><Download /></button></div></article>)}</div></section>
      <PortalOfferForm csrfToken={portal.csrfToken} />
    </div>
  </ExternalShell>;
}
