import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../utils/apiClient";

type SmtpForm = {
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_SECURE: string;
  SMTP_USER: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  EMAIL_REPLY_TO: string;
  smtpCredential: string;
};

type Toast = {kind: "success" | "error"; message: string; requestId?: string};

const initialSettings: SmtpForm = {SMTP_HOST: "", SMTP_PORT: "", SMTP_SECURE: "false", SMTP_USER: "", EMAIL_FROM: "", EMAIL_FROM_NAME: "SynCash", EMAIL_REPLY_TO: "", smtpCredential: ""};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorToast(error: unknown, fallback: string): Toast {
  if (!(error instanceof ApiError)) return {kind: "error", message: fallback};
  const messages: Record<string, string> = {
    SECRET_PROVIDER_READ_ONLY: "ספק הסודות הפעיל אינו מאפשר עדכון סיסמה.",
    SMTP_CREDENTIAL_NOT_CONFIGURED: "לא הוגדרה סיסמת SMTP.",
    SMTP_AUTH_FAILED: "האימות מול שרת ה-SMTP נכשל. יש לבדוק את שם המשתמש וסיסמת האפליקציה.",
    SMTP_CONNECTION_FAILED: "לא ניתן להתחבר לשרת ה-SMTP.",
    SMTP_TLS_FAILED: "יצירת חיבור STARTTLS מאובטח נכשלה.",
    SMTP_TEST_FAILED: "בדיקת ה-SMTP נכשלה.",
    VALIDATION_ERROR: "חלק מהשדות אינם תקינים."
  };
  return {kind: "error", message: messages[error.code] ?? fallback, requestId: error.requestId};
}

function validateSettings(settings: SmtpForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!settings.SMTP_HOST.trim()) errors.SMTP_HOST = "יש להזין שרת SMTP.";
  const port = Number(settings.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) errors.SMTP_PORT = "יש להזין פורט בין 1 ל-65535.";
  if (!new Set(["true", "false"]).has(settings.SMTP_SECURE)) errors.SMTP_SECURE = "יש לבחור ערך תקין.";
  if (!emailPattern.test(settings.EMAIL_FROM)) errors.EMAIL_FROM = "כתובת השולח אינה תקינה.";
  if (!settings.EMAIL_FROM_NAME.trim()) errors.EMAIL_FROM_NAME = "יש להזין שם שולח.";
  if (!emailPattern.test(settings.EMAIL_REPLY_TO)) errors.EMAIL_REPLY_TO = "כתובת המענה אינה תקינה.";
  return errors;
}

export default function AdminDashboard({userEmail}: {userEmail: string}) {
  const [settings, setSettings] = useState<SmtpForm>(initialSettings);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(userEmail);
  const [testRecipientError, setTestRecipientError] = useState("");
  useEffect(() => { void api.smtpSettings().then((result) => {
    setPasswordConfigured(Boolean(result.passwordConfigured));
    setSettings((current) => ({...current, ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== "passwordConfigured").map(([key, value]) => [key, value === null ? "" : String(value)]))} as SmtpForm));
  }).catch((error) => setToast(errorToast(error, "טעינת הגדרות ה-SMTP נכשלה."))); }, []);
  const change = (key: keyof SmtpForm, value: string) => {
    setSettings((current) => ({...current, [key]: value}));
    setFieldErrors((current) => ({...current, [key]: ""}));
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setToast(null);
    const errors = validateSettings(settings);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy("save");
    try {
      const {smtpCredential, ...nonSecretSettings} = settings;
      const result = await api.updateSmtpSettings({...nonSecretSettings, smtpPassword: smtpCredential});
      setPasswordConfigured(result.passwordConfigured);
      setToast({kind: "success", message: "הגדרות ה-SMTP נשמרו בהצלחה."});
    } catch (error) {
      setToast(errorToast(error, "שמירת הגדרות ה-SMTP נכשלה."));
    } finally {
      setSettings((current) => ({...current, smtpCredential: ""}));
      setBusy(null);
    }
  };
  const openTestModal = () => { setTestRecipient(userEmail); setTestRecipientError(""); setToast(null); setTestModalOpen(true); };
  const runTest = async () => {
    if (!emailPattern.test(testRecipient)) { setTestRecipientError("כתובת היעד אינה תקינה."); return; }
    setBusy("test"); setToast(null); setTestRecipientError("");
    try {
      await api.testSmtp(testRecipient);
      setTestModalOpen(false);
      setToast({kind: "success", message: "בדיקת ה-SMTP נשלחה בהצלחה."});
    } catch (error) {
      setToast(errorToast(error, "בדיקת ה-SMTP נכשלה."));
    } finally { setBusy(null); }
  };
  const input = (key: keyof SmtpForm, type = "text") => <label>{key}<input aria-label={key} aria-invalid={Boolean(fieldErrors[key])} type={type} value={settings[key]} onChange={(event) => change(key, event.target.value)} />{fieldErrors[key] && <span className="field-error" role="alert">{fieldErrors[key]}</span>}</label>;
  return <main className="admin-page" dir="rtl"><nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><Link to="/admin/settings">הגדרות מערכת</Link><span>›</span><span aria-current="page">דואר יוצא</span></nav><form className="panel form-grid" onSubmit={save} noValidate><h1>הגדרות Super Admin</h1>
    {input("SMTP_HOST")}{input("SMTP_PORT", "number")}<label>SMTP_SECURE<select aria-label="SMTP_SECURE" value={settings.SMTP_SECURE} onChange={(event) => change("SMTP_SECURE", event.target.value)}><option value="false">false</option><option value="true">true</option></select>{fieldErrors.SMTP_SECURE && <span className="field-error" role="alert">{fieldErrors.SMTP_SECURE}</span>}</label>
    {input("SMTP_USER")}{input("EMAIL_FROM", "email")}{input("EMAIL_FROM_NAME")}{input("EMAIL_REPLY_TO", "email")}
    <label>סיסמת SMTP<input aria-label="סיסמת SMTP" autoComplete="new-password" type="password" value={settings.smtpCredential} onChange={(event) => change("smtpCredential", event.target.value)} /><span className="field-hint">ב-Gmail יש להשתמש בסיסמת אפליקציה. פורט 587 עם SMTP_SECURE=false מפעיל STARTTLS.</span></label>
    <p>סיסמת SMTP מוגדרת: {passwordConfigured ? "כן" : "לא"}</p>
    <div className="form-actions"><button type="submit" disabled={busy !== null}>{busy === "save" ? "שומר…" : "שמירה"}</button><button type="button" disabled={busy !== null} onClick={openTestModal}>{busy === "test" ? "בודק…" : "בדיקת SMTP"}</button></div>
    {toast && <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} aria-live="polite"><strong>{toast.message}</strong>{toast.requestId && <small>מזהה בקשה: {toast.requestId}</small>}</div>}
  </form>{testModalOpen && <div className="modal-backdrop"><section className="panel modal" role="dialog" aria-modal="true" aria-labelledby="smtp-test-title"><h2 id="smtp-test-title">בדיקת SMTP</h2><label>כתובת יעד<input type="email" value={testRecipient} onChange={(event) => {setTestRecipient(event.target.value); setTestRecipientError("");}} />{testRecipientError && <span className="field-error" role="alert">{testRecipientError}</span>}</label><div className="form-actions"><button type="button" disabled={busy !== null} onClick={() => void runTest()}>{busy === "test" ? "שולח…" : "שליחת בדיקה"}</button><button type="button" disabled={busy !== null} onClick={() => setTestModalOpen(false)}>ביטול</button></div></section></div>}</main>;
}
