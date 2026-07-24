import { CheckCircle2, Circle, Eye, EyeOff, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { advisorRegistrationFormSchema, passwordRequirements, passwordStrength } from "../domain/advisorRegistration";
import { ApiError, api } from "../utils/apiClient";
import SynCashLogo from "./SynCashLogo";

type FormState = {firstName: string; lastName: string; email: string; phone: string; businessName: string; password: string; confirmPassword: string; acceptTerms: boolean};
const emptyForm: FormState = {firstName: "", lastName: "", email: "", phone: "", businessName: "", password: "", confirmPassword: "", acceptTerms: false};

export default function AdvisorRegistrationScreen() {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [busy, setBusy] = useState<"create" | "resend" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const requirements = passwordRequirements(form.password, form.confirmPassword);
  const strength = passwordStrength(form.password, form.confirmPassword);
  const formIsValid = advisorRegistrationFormSchema.safeParse(form).success;

  const validate = (fieldName?: keyof FormState) => {
    const parsed = advisorRegistrationFormSchema.safeParse(form);
    const nextErrors = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    if (fieldName) setErrors((current) => ({...current, [fieldName]: nextErrors[fieldName] ?? ""}));
    else setErrors(nextErrors);
    return parsed;
  };
  const touch = (fieldName: keyof FormState) => {
    setTouched((current) => ({...current, [fieldName]: true}));
    validate(fieldName);
  };
  const change = (fieldName: keyof FormState, value: string | boolean) => {
    setForm((current) => ({...current, [fieldName]: value}));
    setErrors((current) => ({...current, [fieldName]: ""}));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError("");
    setRequestId("");
    const parsed = validate();
    if (!parsed.success || busy) return;
    setBusy("create");
    try {
      await api.registerAdvisor({
        firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email,
        phone: parsed.data.phone, businessName: parsed.data.businessName, acceptTerms: parsed.data.acceptTerms,
        password: parsed.data.password
      });
      setForm(emptyForm);
      navigate("/verify-email", {replace: true, state: {registered: true, verificationEmailSent: true, lastSentAt: new Date().toISOString(), email: parsed.data.email}});
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const firebaseCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (apiError?.accountCreated) {
        setAccountCreated(true);
        setForm((current) => ({...current, password: "", confirmPassword: ""}));
        setServerError("החשבון נוצר, אך לא הצלחנו לשלוח את מייל האימות. ניתן לנסות לשלוח אותו מחדש.");
      } else {
        setServerError(apiError?.status === 429 ? `בוצעו יותר מדי ניסיונות. ניתן לנסות שוב בעוד ${apiError.retryAfterSeconds ?? 60} שניות.` :
          apiError?.code === "ADVISOR_ALREADY_REGISTERED" || firebaseCode === "auth/email-already-in-use" ? "כתובת הדוא״ל כבר רשומה במערכת" :
            "לא ניתן להשלים את ההרשמה כרגע. לא נשמרה סיסמה במערכת.");
      }
      setRequestId(apiError?.requestId ?? "");
    } finally {
      setBusy(null);
    }
  };

  const retryVerification = async () => {
    if (busy) return;
    setBusy("resend");
    setServerError("");
    setRequestId("");
    try {
      const result = await api.resendEmailVerification();
      navigate("/verify-email", {replace: true, state: {registered: true, verificationEmailSent: true, lastSentAt: result.lastSentAt, email: form.email}});
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setServerError(apiError?.status === 429 ? `השליחה מוגבלת זמנית. ניתן לנסות שוב בעוד ${apiError.retryAfterSeconds ?? 60} שניות.` : "שליחת מייל האימות נכשלה. ניתן לנסות שוב.");
      setRequestId(apiError?.requestId ?? "");
    } finally {
      setBusy(null);
    }
  };

  const field = (name: keyof Omit<FormState, "acceptTerms">, label: string, placeholder: string, type = "text") => {
    const errorId = `${name}-error`;
    return <label htmlFor={name}><span>{label} <b aria-hidden="true">*</b></span><input id={name} aria-label={label} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? errorId : undefined} type={type} value={String(form[name])} placeholder={placeholder} autoComplete={name === "email" ? "email" : name === "phone" ? "tel" : "off"} onChange={(event) => change(name, event.target.value)} onBlur={() => touch(name)} disabled={busy !== null || accountCreated} />{errors[name] && <small id={errorId} className="field-error" role="alert">{errors[name]}</small>}</label>;
  };

  return <main className="auth-shell registration-shell" dir="rtl">
    <form className="panel auth-card registration-card" onSubmit={submit} noValidate>
      <SynCashLogo size="md" />
      <div className="registration-heading"><span className="eyebrow">הצטרפות מאובטחת</span><h1>הרשמה ליועצי משכנתאות</h1><p>פתיחת חשבון מקצועי ב-SynCash. כל השדות בטופס הם שדות חובה.</p></div>
      <div className="registration-grid">
        {field("firstName", "שם פרטי", "הקלד את שמך הפרטי")}
        {field("lastName", "שם משפחה", "הקלד את שם המשפחה")}
        {field("email", "דוא״ל", "name@example.com", "email")}
        {field("phone", "טלפון", "0501234567", "tel")}
        <div className="registration-wide">{field("businessName", "שם החברה או המשרד", "הקלד את שם העסק")}</div>
        <label htmlFor="password"><span>סיסמה <b aria-hidden="true">*</b></span><span className="password-control"><input id="password" aria-label="סיסמה" aria-invalid={Boolean(errors.password)} aria-describedby="password-guidance password-error" type={showPassword ? "text" : "password"} value={form.password} autoComplete="new-password" onChange={(event) => change("password", event.target.value)} onBlur={() => touch("password")} disabled={busy !== null || accountCreated} /><button type="button" aria-label={showPassword ? "הסתרת סיסמה" : "הצגת סיסמה"} onClick={() => setShowPassword((value) => !value)} disabled={busy !== null || accountCreated}>{showPassword ? <EyeOff /> : <Eye />}</button></span>{errors.password && <small id="password-error" className="field-error" role="alert">{errors.password}</small>}</label>
        <label htmlFor="confirmPassword"><span>אימות סיסמה <b aria-hidden="true">*</b></span><input id="confirmPassword" aria-label="אימות סיסמה" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby="password-guidance confirmPassword-error" type={showPassword ? "text" : "password"} value={form.confirmPassword} autoComplete="new-password" onChange={(event) => change("confirmPassword", event.target.value)} onBlur={() => touch("confirmPassword")} disabled={busy !== null || accountCreated} />{errors.confirmPassword && <small id="confirmPassword-error" className="field-error" role="alert">{errors.confirmPassword}</small>}</label>
      </div>
      <section id="password-guidance" className="password-guidance" aria-live="polite" aria-label="דרישות הסיסמה">
        <h2>הסיסמה חייבת לכלול:</h2>
        <ul>{requirements.map((requirement) => {
          const failed = !requirement.met && touched[requirement.field];
          const Icon = requirement.met ? CheckCircle2 : failed ? XCircle : Circle;
          return <li key={requirement.key} className={requirement.met ? "met" : failed ? "failed" : "pending"}><Icon aria-hidden="true" /><span>{requirement.label}</span><span className="sr-only">{requirement.met ? "התנאי מתקיים" : failed ? "התנאי אינו מתקיים" : "טרם נבדק"}</span></li>;
        })}</ul>
        <div className={`password-strength strength-${strength.score}`}><span className="strength-track"><i style={{inlineSize: `${(strength.score / requirements.length) * 100}%`}} /></span><strong>חוזק סיסמה: {strength.label}</strong></div>
      </section>
      <label className="terms-field"><input type="checkbox" checked={form.acceptTerms} onChange={(event) => change("acceptTerms", event.target.checked)} onBlur={() => touch("acceptTerms")} disabled={busy !== null || accountCreated} /><span>קראתי ואני מאשר/ת את תנאי השימוש ומדיניות הפרטיות <b aria-hidden="true">*</b></span></label>
      {errors.acceptTerms && <small className="field-error" role="alert">{errors.acceptTerms}</small>}
      {serverError && <div className="toast error registration-toast" role="alert"><strong>{serverError}</strong>{requestId && <small>מזהה בקשה: {requestId}</small>}{accountCreated && <button type="button" className="secondary-action" disabled={busy !== null} onClick={() => void retryVerification()}>{busy === "resend" ? "שולח מייל…" : "ניסיון חוזר לשליחת מייל"}</button>}</div>}
      <button className="primary-action large" disabled={busy !== null || accountCreated || !formIsValid}>{busy === "create" ? "יוצר חשבון ושולח מייל…" : "יצירת חשבון"}</button>
      <p className="auth-link">כבר יש לך חשבון? <Link to="/login">כניסה</Link></p>
      <p className="registration-security"><ShieldCheck size={18} />הסיסמה נשמרת ב-Firebase Authentication בלבד ואינה נשלחת לשרת SynCash.</p>
    </form>
  </main>;
}
