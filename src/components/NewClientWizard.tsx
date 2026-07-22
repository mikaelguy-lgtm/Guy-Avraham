import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Client } from "../types";
import { ApiError, api } from "../utils/apiClient";
import {
  clientFormPayload,
  emptyClientForm,
  resizeChildrenAges,
  validateClientForm,
  type ClientFormErrors,
  type ClientFormState
} from "../utils/clientForm";
import ClientFormFields from "./ClientFormFields";

const steps = [
  {number: 1, title: "פרטים אישיים", description: "פרטי הלקוח והלווים"},
  {number: 2, title: "הכנסות והתחייבויות", description: "תעסוקה ותמונה פיננסית"},
  {number: 3, title: "נכס ובקשת מימון", description: "פרטי העסקה והבקשה"}
] as const;

export default function NewClientWizard({onCreated}: {onCreated?: (client: Client) => void}) {
  const [form, setForm] = useState<ClientFormState>(() => emptyClientForm());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const progress = useMemo(() => `${Math.round((step / steps.length) * 100)}%`, [step]);

  const change = <Key extends keyof ClientFormState>(key: Key, value: ClientFormState[Key]) => {
    setForm((current) => {
      if (key === "numberOfChildren") {
        const count = value as string;
        return {...current, numberOfChildren: count, childrenAges: resizeChildrenAges(current.childrenAges, count)};
      }
      if (key === "hasAdditionalIncome" && value === "no") {
        return {...current, hasAdditionalIncome: "no", additionalIncomeType: "", additionalIncomeAmount: "", additionalIncomeDescription: ""};
      }
      return {...current, [key]: value};
    });
    setErrors((current) => {
      const next = {...current}; delete next[String(key)]; return next;
    });
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
    <section className="page-title"><div><span className="eyebrow">תיק לקוח חדש</span><h1>יצירת תיק מימון</h1><p>שלושה שלבים ברורים ליצירת תיק מלא ומוכן לעבודה.</p></div></section>
    <section className="wizard-shell content-card">
      <div className="wizard-progress" aria-label={`שלב ${step} מתוך 3`}>
        <div className="progress-track"><span style={{inlineSize: progress}} /></div>
        <ol>{steps.map((item) => <li className={item.number === step ? "current" : item.number < step ? "complete" : ""} key={item.number}><span>{item.number < step ? <Check size={17} /> : item.number}</span><div><strong>{item.title}</strong><small>{item.description}</small></div></li>)}</ol>
      </div>
      <form className="wizard-form" onSubmit={(event) => { event.preventDefault(); if (step < 3) next(); else void save(); }} noValidate>
        <ClientFormFields form={form} errors={errors} step={step} onChange={change} />
        {message && <p className="form-message error" role="alert">{message}</p>}
        <div className="wizard-actions">
          <div>{step > 1 && <button type="button" className="secondary-action" onClick={previous}><ArrowRight size={18} />הקודם</button>}</div>
          <div>{step < 3
            ? <button type="submit" className="primary-action">הבא<ArrowLeft size={18} /></button>
            : <button type="submit" className="primary-action" disabled={busy}>{busy ? "יוצר תיק…" : "יצירת תיק"}<Check size={18} /></button>}
          </div>
        </div>
      </form>
    </section>
  </main>;
}
