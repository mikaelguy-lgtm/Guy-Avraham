import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { advisorProfileSchema } from "../domain/advisorRegistration";
import type { CurrentUser } from "../types";
import { api } from "../utils/apiClient";
import { formatUserRole } from "../utils/formatters";

export default function AdvisorProfileView({user}: {user: CurrentUser}) {
  const [current, setCurrent] = useState(user);
  const [form, setForm] = useState({firstName: user.firstName, lastName: user.lastName, phone: user.phone, businessName: user.businessName});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (field: keyof typeof form, value: string) => { setForm((valueBefore) => ({...valueBefore, [field]: value})); setErrors((valueBefore) => ({...valueBefore, [field]: ""})); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage("");
    const parsed = advisorProfileSchema.safeParse(form);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setBusy(true);
    try { const updated = await api.updateAdvisorProfile(parsed.data); setCurrent(updated); setForm({firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, businessName: updated.businessName}); setMessage("פרטי הפרופיל נשמרו בהצלחה."); }
    catch { setMessage("שמירת פרטי הפרופיל נכשלה."); }
    finally { setBusy(false); }
  };
  const input = (name: keyof typeof form, label: string) => <label><span>{label} *</span><input aria-label={label} value={form[name]} onChange={(event) => change(name, event.target.value)} disabled={busy} />{errors[name] && <small className="field-error" role="alert">{errors[name]}</small>}</label>;
  return <main className="advisor-page"><section className="page-title"><div><span className="eyebrow">החשבון שלי</span><h1>פרופיל היועץ</h1><p>עריכת פרטי החשבון המקצועי. הרשאה וסטטוס מנוהלים על ידי המערכת בלבד.</p></div></section><section className="profile-grid"><article className="content-card profile-identity"><span className="client-avatar profile-avatar">{current.firstName.slice(0, 1)}{current.lastName.slice(0, 1)}</span><h2>{current.firstName} {current.lastName}</h2><p>{current.businessName}</p><span className="status-badge status-active">{current.emailVerified ? "דוא״ל מאומת" : "ממתין לאימות"}</span></article><form className="content-card profile-details profile-edit-form" onSubmit={save}><h2>פרטי חשבון</h2><div className="profile-form-grid">{input("firstName", "שם פרטי")}{input("lastName", "שם משפחה")}{input("phone", "טלפון")}{input("businessName", "שם החברה או המשרד")}</div><dl><div className="info-row"><dt><Mail size={17} />דוא״ל</dt><dd>{current.email}</dd></div><div className="info-row"><dt><ShieldCheck size={17} />הרשאה</dt><dd>{formatUserRole(current.role)}</dd></div><div className="info-row"><dt><UserRound size={17} />סטטוס אימות</dt><dd>{current.emailVerified ? "מאומת" : "טרם אומת"}</dd></div></dl>{message && <p className={message.includes("נכשלה") ? "form-message error" : "form-message success"} role="status">{message}</p>}<button className="primary-action" disabled={busy}>{busy ? "שומר…" : "שמירת שינויים"}</button></form></section></main>;
}
