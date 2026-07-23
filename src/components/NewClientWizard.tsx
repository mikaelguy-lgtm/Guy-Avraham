import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../types";
import { ApiError, api } from "../utils/apiClient";
import {
  clientFormPayload,
  emptyClientForm,
  moveBorrower,
  resizeBorrowers,
  resizeChildrenAges,
  validateClientForm,
  type BorrowerFormState,
  type ClientFormErrors,
  type ClientFormState
} from "../utils/clientForm";
import ClientFormFields from "./ClientFormFields";

const steps = [
  {number: 1, title: "פרטים אישיים", description: "הלווים והקשר ביניהם"},
  {number: 2, title: "הכנסות והתחייבויות", description: "תמונה פיננסית לכל לווה"},
  {number: 3, title: "נכס ובקשת מימון", description: "פרטי העסקה המשותפת"}
] as const;

export default function NewClientWizard({onCreated}: {onCreated?: (client: Client) => void}) {
  const [form, setForm] = useState<ClientFormState>(() => emptyClientForm());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [message, setMessage] = useState("");
  const [relationshipWarning, setRelationshipWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const progress = useMemo(() => `${Math.round((step / steps.length) * 100)}%`, [step]);

  const clearError = (key: string) => setErrors((current) => {
    const next = {...current};
    Object.keys(next).filter((errorKey) => errorKey === key || errorKey.startsWith(`${key}.`)).forEach((errorKey) => delete next[errorKey]);
    return next;
  });

  const change = <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => {
    if (key === "borrowerRelationship" && form.borrowerRelationship && form.borrowerRelationship !== value
      && !window.confirm("שינוי הקשר ישנה את אופן הצגת נתוני הילדים. הנתונים יישמרו בטופס ככל האפשר. להמשיך?")) return;
    setForm((current) => {
      if (key === "numberOfBorrowers") {
        const count = value as string;
        const borrowers = resizeBorrowers(current.borrowers, count);
        return {...current, numberOfBorrowers: count, borrowers, borrowerRelationship: Number(count) > 1 ? current.borrowerRelationship : "", borrowerRelationshipOther: Number(count) > 1 ? current.borrowerRelationshipOther : ""};
      }
      if (key === "borrowerRelationship" && current.borrowerRelationship && current.borrowerRelationship !== value) {
        setRelationshipWarning("שינוי הקשר עשוי לשנות את אופן הצגת הילדים. הנתונים הקיימים נשמרו ותוכל להתאים אותם לפני השמירה.");
      }
      if (key === "householdNumberOfChildren") {
        const count = value as string;
        return {...current, householdNumberOfChildren: count, householdChildrenAges: resizeChildrenAges(current.householdChildrenAges, count)};
      }
      return {...current, [key]: value};
    });
    clearError(String(key));
    setMessage("");
  };

  const changeBorrower = <Key extends keyof BorrowerFormState>(index: number, key: Key, value: BorrowerFormState[Key]) => {
    setForm((current) => {
      const borrowers = [...current.borrowers];
      const borrower = {...borrowers[index]};
      if (key === "numberOfChildren") {
        const count = value as string;
        borrower.numberOfChildren = count;
        borrower.childrenAges = resizeChildrenAges(borrower.childrenAges, count);
      } else if (key === "hasAdditionalIncome" && value === "no") {
        borrower.hasAdditionalIncome = "no";
        borrower.additionalIncomeType = "";
        borrower.additionalIncomeAmount = "";
        borrower.additionalIncomeDescription = "";
      } else borrower[key] = value;
      borrowers[index] = borrower;
      return {...current, borrowers};
    });
    clearError(`borrowers.${index}.${String(key)}`);
    setMessage("");
  };

  const next = () => {
    const nextErrors = validateClientForm(form, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
    else setMessage("יש להשלים את כל השדות המסומנים לפני המעבר לשלב הבא.");
  };

  const previous = () => {
    setErrors({}); setMessage(""); setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3);
  };

  const save = async () => {
    const allErrors = validateClientForm(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setMessage("יש להשלים את כל שדות החובה לפני יצירת התיק.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const client = await api.createClient(clientFormPayload(form));
      onCreated?.(client);
      navigate(`/advisor/clients/${client.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fieldErrors);
        setMessage(`יצירת התיק נכשלה. ${caught.code === "VALIDATION_ERROR" ? "יש לתקן את השדות המסומנים." : "נסה שוב בעוד רגע."}${caught.requestId ? ` מזהה בקשה: ${caught.requestId}` : ""}`);
      } else setMessage("יצירת התיק נכשלה. נסה שוב בעוד רגע.");
    } finally { setBusy(false); }
  };

  return <main className="advisor-page wizard-page">
    <section className="page-title"><div><span className="eyebrow">תיק לקוח חדש</span><h1>יצירת תיק מימון</h1><p>שלושה שלבים ברורים ליצירת תיק מלא עבור עד חמישה לווים.</p></div></section>
    <section className="wizard-shell content-card">
      <div className="wizard-progress" aria-label={`שלב ${step} מתוך 3`}>
        <div className="progress-track"><span style={{inlineSize: progress}} /></div>
        <ol>{steps.map((item) => <li className={item.number === step ? "current" : item.number < step ? "complete" : ""} key={item.number}><span>{item.number < step ? <Check size={17} /> : item.number}</span><div><strong>{item.title}</strong><small>{item.description}</small></div></li>)}</ol>
      </div>
      <form className="wizard-form" onSubmit={(event) => { event.preventDefault(); if (step < 3) next(); else void save(); }} noValidate>
        <ClientFormFields form={form} errors={errors} step={step} onChange={change} onBorrowerChange={changeBorrower} onMoveBorrower={(from, to) => setForm((current) => ({...current, borrowers: moveBorrower(current.borrowers, from, to)}))} />
        {relationshipWarning && <p className="form-message warning" role="status">{relationshipWarning}</p>}
        {message && <p className="form-message error" role="alert">{message}</p>}
        <div className="wizard-actions"><div>{step > 1 && <button type="button" className="secondary-action" onClick={previous}><ArrowRight size={18} />הקודם</button>}</div><div>{step < 3 ? <button type="submit" className="primary-action">הבא<ArrowLeft size={18} /></button> : <button type="submit" className="primary-action" disabled={busy}>{busy ? "יוצר תיק…" : "יצירת תיק"}<Check size={18} /></button>}</div></div>
      </form>
    </section>
  </main>;
}
