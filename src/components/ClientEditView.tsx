import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { Client } from "../types";
import { ApiError, api } from "../utils/apiClient";
import {
  applyBorrowerRelationship,
  clientDealDetailsPayload, clientFormPayload, clientIncomePayload, clientLiabilitiesPayload,
  clientPersonalPayload, clientPropertyPayload, clientToForm, hasClientFormChanges, moveBorrower,
  resizeBorrowers, resizeChildrenAges, validateClientForm, validateClientFormSection,
  type BorrowerFormState, type ClientEditSection, type ClientFormErrors, type ClientFormState
} from "../utils/clientForm";
import { clientTabPath, editSectionLabels } from "../utils/clientEditRoutes";
import ClientFormFields from "./ClientFormFields";

const steps = [
  {number: 1, title: "פרטים אישיים", description: "הלווים והקשר ביניהם"},
  {number: 2, title: "הכנסות והתחייבויות", description: "תמונה פיננסית לכל לווה"},
  {number: 3, title: "נכס ובקשת מימון", description: "פרטי העסקה המשותפת"}
] as const;
const validSections = new Set<ClientEditSection>(["personal", "income", "liabilities", "property", "deal-details"]);

export default function ClientEditView() {
  const {id = "", section: sectionParam} = useParams();
  const clientId = Number(id);
  const section = sectionParam as ClientEditSection | undefined;
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState | null>(null);
  const [initialForm, setInitialForm] = useState<ClientFormState | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const progress = useMemo(() => `${Math.round((step / steps.length) * 100)}%`, [step]);
  const dirty = Boolean(form && initialForm && hasClientFormChanges(initialForm, form));

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    void api.client(clientId).then((result) => {
      if (cancelled) return;
      const loadedForm = clientToForm(result);
      setClient(result); setForm(loadedForm); setInitialForm(structuredClone(loadedForm));
    }).catch(() => { if (!cancelled) setMessage("טעינת תיק הלקוח נכשלה. נסה לרענן את הדף."); });
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => { window.scrollTo({top: 0, behavior: "smooth"}); }, [step]);

  if (section && !validSections.has(section)) return <Navigate to={`/advisor/clients/${clientId}/edit`} replace />;
  if (!client || !form) return <main className="advisor-page"><div className="empty-state">{message || "טוען את פרטי התיק לעריכה…"}</div></main>;

  const clearError = (key: string) => setErrors((current) => {
    const next = {...current};
    Object.keys(next).filter((errorKey) => errorKey === key || errorKey.startsWith(`${key}.`)).forEach((errorKey) => delete next[errorKey]);
    return next;
  });
  const change = <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => {
    setForm((current) => {
      if (!current) return current;
      if (key === "numberOfBorrowers") {
        const count = value as string;
        return {...current, numberOfBorrowers: count, borrowers: resizeBorrowers(current.borrowers, count), borrowerRelationship: Number(count) > 1 ? current.borrowerRelationship : "", borrowerRelationshipOther: Number(count) > 1 ? current.borrowerRelationshipOther : ""};
      }
      if (key === "householdNumberOfChildren") {
        const count = value as string;
        return {...current, householdNumberOfChildren: count, householdChildrenAges: resizeChildrenAges(current.householdChildrenAges, count)};
      }
      if (key === "borrowerRelationship") {
        return applyBorrowerRelationship(current, value as string);
      }
      return {...current, [key]: value};
    });
    clearError(String(key)); setMessage("");
  };
  const changeBorrower = <Key extends keyof BorrowerFormState>(index: number, key: Key, value: BorrowerFormState[Key]) => {
    setForm((current) => {
      if (!current) return current;
      const borrowers = [...current.borrowers]; const borrower = {...borrowers[index]};
      if (key === "numberOfChildren") { const count = value as string; borrower.numberOfChildren = count; borrower.childrenAges = resizeChildrenAges(borrower.childrenAges, count); }
      else if (key === "hasAdditionalIncome" && value === "no") { borrower.hasAdditionalIncome = "no"; borrower.additionalIncomeType = ""; borrower.additionalIncomeAmount = ""; borrower.additionalIncomeDescription = ""; }
      else borrower[key] = value;
      borrowers[index] = borrower;
      if (current.borrowerRelationship === "MARRIED" && index === 0 && key === "address") {
        for (let borrowerIndex = 1; borrowerIndex < borrowers.length; borrowerIndex += 1) borrowers[borrowerIndex] = {...borrowers[borrowerIndex], address: String(value)};
      }
      return {...current, borrowers};
    });
    clearError(`borrowers.${index}.${String(key)}`); setMessage("");
  };

  const returnTab = section ?? "summary";
  const leave = () => navigate(clientTabPath(client.id, returnTab), {replace: true});
  const cancel = () => dirty ? setConfirmExit(true) : leave();
  const save = async () => {
    const nextErrors = section ? validateClientFormSection(form, section) : validateClientForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setMessage("יש לתקן את השדות המסומנים לפני השמירה."); return; }
    setBusy(true); setMessage("");
    try {
      if (section === "personal") await api.updateClientPersonal(client.id, clientPersonalPayload(form));
      else if (section === "income") await api.updateClientIncome(client.id, clientIncomePayload(form));
      else if (section === "liabilities") await api.updateClientLiabilities(client.id, clientLiabilitiesPayload(form));
      else if (section === "property") await api.updateClientProperty(client.id, clientPropertyPayload(form));
      else if (section === "deal-details") await api.updateClientDealDetails(client.id, clientDealDetailsPayload(form));
      else await api.updateClient(client.id, clientFormPayload(form));
      navigate(clientTabPath(client.id, returnTab), {replace: true, state: {toast: "השינויים נשמרו בהצלחה."}});
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fieldErrors);
        setMessage(`שמירת השינויים נכשלה.${caught.code === "VALIDATION_ERROR" ? " יש לתקן את השדות המסומנים." : " נסה שוב בעוד רגע."}${caught.requestId ? ` מזהה בקשה: ${caught.requestId}` : ""}`);
      } else setMessage("שמירת השינויים נכשלה. נסה שוב בעוד רגע.");
    } finally { setBusy(false); }
  };
  const next = () => {
    const nextErrors = validateClientForm(form, step); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setMessage("יש להשלים את כל השדות המסומנים לפני המעבר לשלב הבא."); return; }
    setMessage(""); setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  };

  const title = section ? `עריכת ${editSectionLabels[section]}` : "עריכת תיק מימון";
  return <main className="advisor-page wizard-page client-edit-page">
    {section && <nav className="client-edit-breadcrumb" aria-label="פירורי לחם"><button type="button" onClick={() => navigate("/advisor/clients")}>לקוחות</button><span>&gt;</span><button type="button" onClick={cancel}>{client.firstName} {client.lastName}</button><span>&gt;</span><strong>עריכת {editSectionLabels[section]}</strong></nav>}
    <section className="page-title"><div><span className="eyebrow">תיק {client.publicCaseNumber}</span><h1>{title}</h1><p>{section ? `עדכון ממוקד של ${editSectionLabels[section]} בתיק הלקוח.` : "עדכון פרטי הלווים, ההכנסות, ההתחייבויות, הנכס ובקשת המימון"}</p></div></section>
    <section className="wizard-shell content-card">
      {!section && <div className="wizard-progress" aria-label={`שלב ${step} מתוך 3`}><div className="progress-track"><span style={{inlineSize: progress}} /></div><ol>{steps.map((item) => <li className={item.number === step ? "current" : item.number < step ? "complete" : ""} key={item.number}><span>{item.number < step ? <Check size={17} /> : item.number}</span><div><strong>{item.title}</strong><small>{item.description}</small></div></li>)}</ol></div>}
      <form className="wizard-form" onSubmit={(event) => { event.preventDefault(); if (!section && step < 3) next(); else void save(); }} noValidate>
        <ClientFormFields form={form} errors={errors} step={step} section={section} onChange={change} onBorrowerChange={changeBorrower} onMoveBorrower={!section || section === "personal" ? (from, to) => setForm((current) => current ? {...current, borrowers: moveBorrower(current.borrowers, from, to)} : current) : undefined} />
        {message && <p className="form-message error" role="alert">{message}</p>}
        <div className="wizard-actions"><div>{!section && step > 1 && <button type="button" className="secondary-action" onClick={() => {setErrors({}); setMessage(""); setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3);}}><ArrowRight size={18} />הקודם</button>}<button type="button" className="ghost-action" onClick={cancel}>ביטול וחזרה לתיק</button></div><div>{!section && step < 3 ? <button type="submit" className="primary-action">הבא<ArrowLeft size={18} /></button> : <button type="submit" className="primary-action" disabled={busy}>{busy ? "שומר…" : "שמירת שינויים"}<Check size={18} /></button>}</div></div>
      </form>
    </section>
    {confirmExit && <div className="modal-backdrop"><section className="modal confirm-exit-modal content-card" role="dialog" aria-modal="true" aria-labelledby="unsaved-title"><h2 id="unsaved-title">השינויים לא נשמרו</h2><p>בוצעו שינויים בטופס. האם לצאת ללא שמירה?</p><div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setConfirmExit(false)}>המשך עריכה</button><button type="button" className="danger-action" onClick={leave}>יציאה ללא שמירה</button></div></section></div>}
  </main>;
}
