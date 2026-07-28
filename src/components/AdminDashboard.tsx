import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ApiError,
  api,
  type EmailConfigurationStatus,
  type EmailConfigurationView,
  type EmailProvider,
  type EmailSecurityMode,
  type EmailSettingsResponse
} from "../utils/apiClient";

type SmtpForm = {
  provider: EmailProvider;
  host: string;
  port: string;
  securityMode: EmailSecurityMode;
  username: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  smtpCredential: string;
};

type Toast = {kind: "success" | "error"; message: string; requestId?: string};
type BusyAction = "load" | "save" | "test" | "activate" | "rollback" | "clear";

const emptyForm: SmtpForm = {
  provider: "CUSTOM",
  host: "",
  port: "587",
  securityMode: "STARTTLS",
  username: "",
  fromEmail: "",
  fromName: "SynCash",
  replyTo: "",
  smtpCredential: ""
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const providerLabels: Record<EmailProvider, string> = {GMAIL: "Gmail", BREVO: "Brevo", CUSTOM: "SMTP מותאם אישית"};
const statusLabels: Record<EmailConfigurationStatus, string> = {DRAFT: "טיוטה", TESTED: "נבדקה", ACTIVE: "פעילה", FAILED: "נכשלה", SUPERSEDED: "הוחלפה"};
const securityLabels: Record<EmailSecurityMode, string> = {NONE: "ללא הצפנה", STARTTLS: "STARTTLS", TLS: "TLS ישיר"};

function configurationForm(configuration: EmailConfigurationView | EmailSettingsResponse["bootstrap"]): SmtpForm {
  return {
    provider: configuration.provider,
    host: configuration.host,
    port: String(configuration.port),
    securityMode: configuration.securityMode,
    username: configuration.username,
    fromEmail: configuration.fromEmail,
    fromName: configuration.fromName,
    replyTo: configuration.replyTo,
    smtpCredential: ""
  };
}

function errorToast(error: unknown, fallback: string): Toast {
  if (!(error instanceof ApiError)) return {kind: "error", message: fallback};
  const messages: Record<string, string> = {
    SECRET_PROVIDER_READ_ONLY: "מנגנון הסודות הפעיל אינו מאפשר עדכון סיסמה.",
    SMTP_SECRET_WRITE_FORBIDDEN: "לשירות אין הרשאה ליצור גרסת סוד חדשה. יש לעדכן את הרשאות Secret Manager.",
    SMTP_SECRET_WRITE_FAILED: "שמירת סיסמת ה-SMTP במנגנון הסודות נכשלה.",
    SMTP_CREDENTIAL_NOT_CONFIGURED: "לא הוגדרה סיסמת SMTP.",
    SMTP_AUTH_FAILED: "שם המשתמש או סיסמת ה-SMTP שגויים.",
    SMTP_CONNECTION_FAILED: "החיבור לשרת הדוא״ל נכשל.",
    SMTP_TLS_FAILED: "החיבור המאובטח לשרת הדוא״ל נכשל.",
    SMTP_SENDER_REJECTED: "כתובת השולח נדחתה על ידי ספק הדוא״ל.",
    SMTP_TEST_FAILED: "בדיקת ה-SMTP נכשלה.",
    SMTP_HOST_NOT_ALLOWED: "כתובת השרת חסומה מטעמי אבטחה.",
    SMTP_PORT_NOT_ALLOWED: "הפורט שנבחר אינו מורשה בסביבת Production.",
    SMTP_PROVIDER_PRESET_INVALID: "הגדרת הספק אינה תואמת לערכים המאושרים.",
    SMTP_CONFIGURATION_NOT_TESTED: "ניתן להפעיל רק הגדרה שנבדקה בהצלחה.",
    SMTP_ROLLBACK_UNAVAILABLE: "אין הגדרה קודמת זמינה לחזרה.",
    VALIDATION_ERROR: "יש לתקן את השדות המסומנים."
  };
  return {kind: "error", message: error.publicMessage || messages[error.code] || fallback, requestId: error.requestId};
}

function validateSettings(settings: SmtpForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!settings.host.trim()) errors.host = "יש להזין שרת SMTP.";
  const port = Number(settings.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) errors.port = "יש להזין פורט בין 1 ל־65535.";
  if ((settings.provider === "GMAIL" || settings.provider === "BREVO") && !settings.username.trim()) errors.username = "יש להזין שם משתמש SMTP.";
  if (settings.provider === "GMAIL" && settings.username.trim() && !emailPattern.test(settings.username)) errors.username = "כתובת Gmail אינה תקינה.";
  if (settings.provider === "GMAIL" && settings.smtpCredential && settings.smtpCredential.replace(/ /g, "").length !== 16) errors.smtpCredential = "יש להזין Google App Password תקינה בת 16 תווים.";
  if (!emailPattern.test(settings.fromEmail)) errors.fromEmail = "כתובת השולח אינה תקינה.";
  if (!settings.fromName.trim()) errors.fromName = "יש להזין שם שולח.";
  if (!emailPattern.test(settings.replyTo)) errors.replyTo = "כתובת המענה אינה תקינה.";
  return errors;
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("he-IL", {dateStyle: "short", timeStyle: "short"}).format(new Date(value)) : "טרם בוצע";
}

export default function AdminDashboard({userEmail}: {userEmail: string}) {
  const [data, setData] = useState<EmailSettingsResponse | null>(null);
  const [settings, setSettings] = useState<SmtpForm>(emptyForm);
  const [testRecipient, setTestRecipient] = useState(userEmail);
  const [busy, setBusy] = useState<BusyAction | null>("load");
  const [toast, setToast] = useState<Toast | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const result = await api.smtpSettings();
    setData(result);
    setSettings(configurationForm(result.draft ?? result.active ?? result.bootstrap));
    return result;
  }, []);

  useEffect(() => {
    void load().catch((error) => setToast(errorToast(error, "טעינת הגדרות הדוא״ל נכשלה."))).finally(() => setBusy(null));
  }, [load]);

  const change = (key: keyof SmtpForm, value: string) => {
    setSettings((current) => ({...current, [key]: value}));
    setFieldErrors((current) => ({...current, [key]: ""}));
  };

  const selectProvider = (provider: EmailProvider) => {
    setSettings((current) => {
      if (provider === "GMAIL") return {...current, provider, host: "smtp.gmail.com", port: "587", securityMode: "STARTTLS", fromEmail: current.username || current.fromEmail};
      if (provider === "BREVO") return {...current, provider, host: "smtp-relay.brevo.com", port: "587", securityMode: "STARTTLS", fromEmail: "notifications@syncash.co.il"};
      return {...current, provider};
    });
    setFieldErrors({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setToast(null);
    const errors = validateSettings(settings);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy("save");
    try {
      await api.updateSmtpSettings({
        provider: settings.provider,
        host: settings.host,
        port: Number(settings.port),
        securityMode: settings.securityMode,
        username: settings.username || null,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        replyTo: settings.replyTo,
        ...(data?.draft?.id || data?.active?.id ? {baseConfigurationId: data?.draft?.id ?? data?.active?.id} : {}),
        ...(settings.smtpCredential ? {smtpPassword: settings.smtpCredential} : {})
      });
      setSettings((current) => ({...current, smtpCredential: ""}));
      await load();
      setToast({kind: "success", message: "הטיוטה נשמרה בהצלחה"});
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.smtpPassword) {
        setFieldErrors((current) => ({...current, smtpCredential: error.fieldErrors.smtpPassword}));
      }
      setToast(errorToast(error, "שמירת הגדרות ה-SMTP נכשלה."));
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    if (!data?.draft) return;
    if (!emailPattern.test(testRecipient)) { setFieldErrors((current) => ({...current, testRecipient: "כתובת היעד אינה תקינה."})); return; }
    setBusy("test"); setToast(null);
    try {
      await api.testSmtp(data.draft.id, testRecipient);
      await load();
      setToast({kind: "success", message: "הודעת הבדיקה נשלחה בהצלחה. ניתן להפעיל את ההגדרה."});
    } catch (error) {
      await load().catch(() => undefined);
      setToast(errorToast(error, "בדיקת ה-SMTP נכשלה."));
    } finally { setBusy(null); }
  };

  const activate = async () => {
    if (!data?.draft) return;
    setBusy("activate"); setToast(null);
    try {
      await api.activateSmtp(data.draft.id);
      await load();
      setToast({kind: "success", message: "הגדרת הדוא״ל הופעלה בהצלחה וללא הפעלה מחדש."});
    } catch (error) { setToast(errorToast(error, "הפעלת הגדרת הדוא״ל נכשלה.")); }
    finally { setBusy(null); }
  };

  const rollback = async () => {
    setBusy("rollback"); setToast(null);
    try {
      await api.rollbackSmtp();
      await load();
      setToast({kind: "success", message: "ההגדרה הקודמת הופעלה מחדש."});
    } catch (error) { setToast(errorToast(error, "החזרה להגדרה הקודמת נכשלה.")); }
    finally { setBusy(null); }
  };

  const clearPassword = async () => {
    if (!data?.draft || !window.confirm("למחוק את סיסמת ה-SMTP מהטיוטה? ההגדרה הפעילה לא תשתנה.")) return;
    setBusy("clear"); setToast(null);
    try {
      await api.clearSmtpPassword(data.draft.id);
      await load();
      setToast({kind: "success", message: "סיסמת ה-SMTP הוסרה מהטיוטה."});
    } catch (error) { setToast(errorToast(error, "מחיקת סיסמת ה-SMTP נכשלה.")); }
    finally { setBusy(null); }
  };

  const passwordLabel = settings.provider === "GMAIL" ? "Google App Password" : settings.provider === "BREVO" ? "Brevo SMTP Key" : "סיסמת SMTP";
  const usernameLabel = settings.provider === "GMAIL" ? "כתובת Gmail" : settings.provider === "BREVO" ? "SMTP Login" : "שם משתמש SMTP";
  const fieldsLocked = settings.provider !== "CUSTOM";
  const draftSaved = Boolean(data?.draft);
  const smtpTested = data?.draft?.status === "TESTED" || Boolean(data?.active);
  const smtpActive = Boolean(data?.active);
  const saveDisabled = busy !== null || Object.keys(validateSettings(settings)).length > 0;

  return <main className="admin-page smtp-admin-page" dir="rtl">
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><Link to="/admin/settings">הגדרות מערכת</Link><span>›</span><span aria-current="page">דואר יוצא</span></nav>

    <section className="panel smtp-status-panel" aria-labelledby="smtp-status-title">
      <div><p className="eyebrow">שירות דוא״ל דינמי</p><h1 id="smtp-status-title">הגדרות דואר יוצא</h1><p>הגדרה חדשה נשמרת כטיוטה. ההגדרה הפעילה מתחלפת רק לאחר בדיקת שליחה מוצלחת והפעלה מפורשת.</p></div>
      <div className={`status-pill ${data?.active ? "active" : "inactive"}`}>{data?.active ? "פעיל" : "לא מוגדר"}</div>
      <dl className="smtp-status-grid">
        <div><dt>ספק פעיל</dt><dd>{data?.active ? providerLabels[data.active.provider] : "אין"}</dd></div>
        <div><dt>כתובת שולח פעילה</dt><dd>{data?.active?.fromEmail || "לא הוגדרה"}</dd></div>
        <div><dt>בדיקה אחרונה</dt><dd>{formatDate(data?.active?.lastTestedAt ?? data?.draft?.lastTestedAt ?? null)}</dd></div>
        <div><dt>הפעלה אחרונה</dt><dd>{formatDate(data?.active?.activatedAt ?? null)}</dd></div>
      </dl>
      {data?.canRollback && <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void rollback()}>{busy === "rollback" ? "מחזיר…" : "חזרה להגדרה הקודמת"}</button>}
    </section>

    <form className="panel smtp-configuration-form" onSubmit={save} noValidate>
      <header className="smtp-form-heading"><div><h2>טיוטת הגדרה</h2><p>שינויים כאן אינם משפיעים על השירות הפעיל עד להפעלה.</p></div>{data?.draft && <span className={`status-pill ${data.draft.status.toLowerCase()}`}>{statusLabels[data.draft.status]}</span>}</header>

      <ol className="smtp-stepper" aria-label="שלבי הגדרת שירות הדוא״ל">
        <li className={draftSaved ? "done" : "active"}><span>{draftSaved ? <Check size={17} /> : "1"}</span><strong>טיוטה</strong></li>
        <li className={smtpTested ? "done" : draftSaved ? "active" : "locked"}><span>{smtpTested ? <Check size={17} /> : "2"}</span><strong>נבדקה</strong></li>
        <li className={smtpActive ? "done active" : smtpTested ? "active" : "locked"}><span>{smtpActive ? <Check size={17} /> : "3"}</span><strong>פעילה</strong></li>
      </ol>

      <div className="smtp-form-grid">
        <label>ספק דוא״ל<select aria-label="ספק דוא״ל" value={settings.provider} onChange={(event) => selectProvider(event.target.value as EmailProvider)}><option value="GMAIL">Gmail</option><option value="BREVO">Brevo</option><option value="CUSTOM">SMTP מותאם אישית</option></select></label>
        <label>שרת SMTP<input aria-label="שרת SMTP" value={settings.host} disabled={fieldsLocked} onChange={(event) => change("host", event.target.value)} />{fieldErrors.host && <span className="field-error" role="alert">{fieldErrors.host}</span>}</label>
        <label>פורט<input aria-label="פורט" type="number" value={settings.port} disabled={fieldsLocked} onChange={(event) => change("port", event.target.value)} />{fieldErrors.port && <span className="field-error" role="alert">{fieldErrors.port}</span>}</label>
        <label>אבטחת חיבור<select aria-label="אבטחת חיבור" value={settings.securityMode} disabled={fieldsLocked} onChange={(event) => change("securityMode", event.target.value)}><option value="NONE">ללא הצפנה</option><option value="STARTTLS">STARTTLS</option><option value="TLS">TLS ישיר</option></select></label>
        <label>{usernameLabel}<input aria-label={usernameLabel} value={settings.username} onChange={(event) => {change("username", event.target.value); if (settings.provider === "GMAIL" && (!settings.fromEmail || settings.fromEmail === settings.username)) change("fromEmail", event.target.value);}} />{fieldErrors.username && <span className="field-error" role="alert">{fieldErrors.username}</span>}</label>
        <label>{passwordLabel}<input aria-label={passwordLabel} autoComplete="new-password" type="password" value={settings.smtpCredential} onChange={(event) => change("smtpCredential", event.target.value)} />{fieldErrors.smtpCredential && <span className="field-error" role="alert">{fieldErrors.smtpCredential}</span>}<span className="field-hint">השאר ריק כדי לשמור את הסיסמה הקיימת. ב-Gmail ניתן להדביק App Password עם או בלי רווחים. הערך לעולם אינו מוחזר למסך.</span></label>
        <label>כתובת שולח<input aria-label="כתובת שולח" type="email" value={settings.fromEmail} onChange={(event) => change("fromEmail", event.target.value)} />{fieldErrors.fromEmail && <span className="field-error" role="alert">{fieldErrors.fromEmail}</span>}</label>
        <label>שם השולח<input aria-label="שם השולח" value={settings.fromName} onChange={(event) => change("fromName", event.target.value)} />{fieldErrors.fromName && <span className="field-error" role="alert">{fieldErrors.fromName}</span>}</label>
        <label>כתובת למענה<input aria-label="כתובת למענה" type="email" value={settings.replyTo} onChange={(event) => change("replyTo", event.target.value)} />{fieldErrors.replyTo && <span className="field-error" role="alert">{fieldErrors.replyTo}</span>}</label>
        <label>כתובת יעד לבדיקת SMTP<input aria-label="כתובת יעד לבדיקת SMTP" type="email" value={testRecipient} onChange={(event) => {setTestRecipient(event.target.value); setFieldErrors((current) => ({...current, testRecipient: ""}));}} />{fieldErrors.testRecipient && <span className="field-error" role="alert">{fieldErrors.testRecipient}</span>}</label>
      </div>

      <div className="smtp-password-state"><span>סיסמת SMTP מוגדרת בטיוטה: <strong>{data?.draft?.passwordConfigured ? "כן" : "לא"}</strong></span>{data?.draft?.passwordConfigured && <button type="button" className="danger-button" disabled={busy !== null} onClick={() => void clearPassword()}>{busy === "clear" ? "מוחק…" : "מחיקת סיסמת SMTP"}</button>}</div>
      <div className="smtp-action-bar">
        <div className="smtp-action-step">
          <button type="submit" className="smtp-action-primary" disabled={saveDisabled} aria-busy={busy === "save"}>{busy === "save" && <LoaderCircle className="spin" size={18} />}{busy === "save" ? "שומר טיוטה…" : "1. שמירה כטיוטה"}</button>
          {saveDisabled && busy === null && <small>יש להשלים את כל שדות החובה בצורה תקינה</small>}
        </div>
        <div className="smtp-action-step">
          <button type="button" className="smtp-action-secondary" disabled={busy !== null || !data?.draft} aria-busy={busy === "test"} onClick={() => void runTest()}>{busy === "test" ? <LoaderCircle className="spin" size={18} /> : !data?.draft ? <LockKeyhole size={18} /> : null}{busy === "test" ? "בודק חיבור ושולח הודעת ניסיון..." : "2. בדיקת SMTP ושליחת מייל"}</button>
          {!data?.draft && <small><LockKeyhole size={14} />יש לשמור תחילה את ההגדרות כטיוטה</small>}
        </div>
        <div className="smtp-action-step">
          <button type="button" className="smtp-action-activate" disabled={busy !== null || data?.draft?.status !== "TESTED"} aria-busy={busy === "activate"} onClick={() => void activate()}>{busy === "activate" ? <LoaderCircle className="spin" size={18} /> : data?.draft?.status !== "TESTED" ? <LockKeyhole size={18} /> : null}{busy === "activate" ? "מפעיל…" : "3. הפעלת ההגדרה"}</button>
          {data?.draft?.status !== "TESTED" && <small><LockKeyhole size={14} />ניתן להפעיל רק לאחר בדיקת SMTP מוצלחת</small>}
        </div>
      </div>
      {data?.draft?.lastTestFailureCode && <p className="smtp-failure-summary" role="alert">הבדיקה האחרונה נכשלה: {errorToast(new ApiError(data.draft.lastTestFailureCode, 502), "בדיקת ה-SMTP נכשלה.").message}</p>}
    </form>

    {data?.history.length ? <section className="panel smtp-history"><h2>היסטוריית הגדרות</h2><div>{data.history.map((configuration) => <article key={configuration.id}><strong>{providerLabels[configuration.provider]}</strong><span>{statusLabels[configuration.status]}</span><small>{configuration.fromEmail} · {securityLabels[configuration.securityMode]} · {formatDate(configuration.updatedAt)}</small></article>)}</div></section> : null}
    {toast && <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} aria-live="polite"><strong>{toast.message}</strong>{toast.requestId && <small>מזהה בקשה: {toast.requestId}</small>}</div>}
  </main>;
}
