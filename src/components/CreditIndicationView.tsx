import { useEffect, useState } from "react";
import type { CreditIndication } from "../types";
import { ApiError, api } from "../utils/apiClient";

interface FormState {
  bouncedChecks: "" | "yes" | "no";
  bouncedChecksCount: string;
  bouncedDirectDebits: "" | "yes" | "no";
  bouncedDirectDebitsCount: string;
  collectionProceedings: "" | "yes" | "no";
  bankruptcy: "" | "yes" | "no";
  liens: "" | "yes" | "no";
  mortgageArrears: "" | "yes" | "no";
}

const toChoice = (value: boolean | null): "" | "yes" | "no" => value === true ? "yes" : value === false ? "no" : "";

function toFormState(indication: CreditIndication | null): FormState {
  return {
    bouncedChecks: toChoice(indication?.bouncedChecks ?? null),
    bouncedChecksCount: indication?.bouncedChecksCount != null ? String(indication.bouncedChecksCount) : "",
    bouncedDirectDebits: toChoice(indication?.bouncedDirectDebits ?? null),
    bouncedDirectDebitsCount: indication?.bouncedDirectDebitsCount != null ? String(indication.bouncedDirectDebitsCount) : "",
    collectionProceedings: toChoice(indication?.collectionProceedings ?? null),
    bankruptcy: toChoice(indication?.bankruptcy ?? null),
    liens: toChoice(indication?.liens ?? null),
    mortgageArrears: toChoice(indication?.mortgageArrears ?? null)
  };
}

function YesNoField({label, value, onChange, countValue, onCountChange, countLabel}: {
  label: string; value: "" | "yes" | "no"; onChange: (value: "" | "yes" | "no") => void;
  countValue?: string; onCountChange?: (value: string) => void; countLabel?: string;
}) {
  return <fieldset className="credit-indication-field">
    <legend>{label}</legend>
    <div className="yes-no-toggle" role="radiogroup" aria-label={label}>
      <label className={value === "yes" ? "selected" : ""}><input type="radio" name={label} checked={value === "yes"} onChange={() => onChange("yes")} />כן</label>
      <label className={value === "no" ? "selected" : ""}><input type="radio" name={label} checked={value === "no"} onChange={() => onChange("no")} />לא</label>
    </div>
    {value === "yes" && countValue !== undefined && onCountChange && <label className="form-field"><span>{countLabel}</span><input type="number" min="1" step="1" inputMode="numeric" value={countValue} onChange={(event) => /^\d*$/.test(event.target.value) && onCountChange(event.target.value)} /></label>}
  </fieldset>;
}

export default function CreditIndicationView({clientId, indication, onUpdated}: {clientId: number; indication: CreditIndication | null; onUpdated: () => void}) {
  const [form, setForm] = useState<FormState>(() => toFormState(indication));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setForm(toFormState(indication)), [indication]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({...current, [key]: value}));

  const save = async () => {
    setBusy(true); setMessage(""); setError("");
    const toBool = (value: "" | "yes" | "no"): boolean | null => value === "yes" ? true : value === "no" ? false : null;
    const toCount = (choice: "" | "yes" | "no", value: string): number | null => choice === "yes" && value ? Number(value) : null;
    try {
      await api.updateClientCreditIndication(clientId, {
        bouncedChecks: toBool(form.bouncedChecks), bouncedChecksCount: toCount(form.bouncedChecks, form.bouncedChecksCount),
        bouncedDirectDebits: toBool(form.bouncedDirectDebits), bouncedDirectDebitsCount: toCount(form.bouncedDirectDebits, form.bouncedDirectDebitsCount),
        collectionProceedings: toBool(form.collectionProceedings), bankruptcy: toBool(form.bankruptcy),
        liens: toBool(form.liens), mortgageArrears: toBool(form.mortgageArrears)
      });
      setMessage("חיווי האשראי נשמר בהצלחה."); onUpdated();
    } catch (caught) { setError(caught instanceof ApiError ? caught.publicMessage ?? "השמירה נכשלה." : "השמירה נכשלה."); }
    finally { setBusy(false); }
  };

  return <div className="detail-section credit-indication-section">
    <div className="section-heading compact"><h2>חיווי אשראי</h2></div>
    <p className="credit-indication-intro">האם היו ב-3 השנים האחרונות:</p>
    <div className="credit-indication-grid">
      <YesNoField label="החזרי צ'קים" value={form.bouncedChecks} onChange={(value) => set("bouncedChecks", value)} countValue={form.bouncedChecksCount} onCountChange={(value) => set("bouncedChecksCount", value)} countLabel="כמה צ'קים?" />
      <YesNoField label="החזרי הוראות קבע" value={form.bouncedDirectDebits} onChange={(value) => set("bouncedDirectDebits", value)} countValue={form.bouncedDirectDebitsCount} onCountChange={(value) => set("bouncedDirectDebitsCount", value)} countLabel="כמה הוראות קבע?" />
      <YesNoField label="הוצאה לפועל" value={form.collectionProceedings} onChange={(value) => set("collectionProceedings", value)} />
      <YesNoField label="פשיטת רגל" value={form.bankruptcy} onChange={(value) => set("bankruptcy", value)} />
      <YesNoField label="עיקולים" value={form.liens} onChange={(value) => set("liens", value)} />
      <YesNoField label="פיגורים במשכנתא" value={form.mortgageArrears} onChange={(value) => set("mortgageArrears", value)} />
    </div>
    {message && <p className="form-message success" role="status">{message}</p>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    <div className="arena-actions"><button type="button" className="primary-action" disabled={busy} onClick={() => void save()}>{busy ? "שומר…" : "שמירת חיווי אשראי"}</button></div>
  </div>;
}
