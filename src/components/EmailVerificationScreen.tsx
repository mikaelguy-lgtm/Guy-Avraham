import { MailCheck, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import type { CurrentUser } from "../types";
import { ApiError, api } from "../utils/apiClient";
import SynCashLogo from "./SynCashLogo";

type VerificationStatus = {email: string; emailVerified: boolean; status: "SENT" | "FAILED" | "NOT_SENT"; lastSentAt: string | null};
const formatSentAt = (value: string) => new Intl.DateTimeFormat("he-IL", {dateStyle: "short", timeStyle: "short"}).format(new Date(value));

export default function EmailVerificationScreen({onAuthenticated}: {onAuthenticated: (user: CurrentUser) => void}) {
  const locationState = useLocation().state as {registered?: boolean; verificationEmailSent?: boolean; lastSentAt?: string; email?: string} | null;
  const [status, setStatus] = useState<VerificationStatus>({
    email: locationState?.email ?? auth.currentUser?.email ?? "",
    emailVerified: false,
    status: locationState?.verificationEmailSent ? "SENT" : "NOT_SENT",
    lastSentAt: locationState?.lastSentAt ?? null
  });
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const [message, setMessage] = useState(locationState?.verificationEmailSent ? "מייל האימות התקבל בהצלחה אצל ספק הדואר." : "");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;
    void api.emailVerificationStatus().then(setStatus).catch(() => undefined);
  }, []);

  const check = async () => {
    setBusy("check"); setError(""); setMessage(""); setRequestId("");
    try {
      const user = await api.refreshMe();
      onAuthenticated(user);
      navigate("/advisor", {replace: true});
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setError(apiError?.code === "EMAIL_NOT_VERIFIED" ? "כתובת הדוא״ל עדיין לא אומתה. פתח את הקישור שקיבלת במייל ונסה שוב." : "לא ניתן לבדוק את האימות כרגע.");
      setRequestId(apiError?.requestId ?? "");
    } finally { setBusy(null); }
  };

  const resend = async () => {
    setBusy("resend"); setError(""); setMessage(""); setRequestId("");
    try {
      const result = await api.resendEmailVerification();
      setStatus((current) => ({...current, status: "SENT", lastSentAt: result.lastSentAt}));
      setMessage("מייל אימות חדש התקבל בהצלחה אצל ספק הדואר.");
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setError(apiError?.status === 429 ? `השליחה מוגבלת זמנית. ניתן לנסות שוב בעוד ${apiError.retryAfterSeconds ?? 60} שניות.` : "שליחת מייל האימות נכשלה. ניתן לנסות שוב.");
      setRequestId(apiError?.requestId ?? "");
      setStatus((current) => ({...current, status: "FAILED"}));
    } finally { setBusy(null); }
  };

  const back = async () => { await api.logout(); navigate("/login", {replace: true}); };
  const statusLabel = status.status === "SENT" ? "נשלח בהצלחה" : status.status === "FAILED" ? "השליחה נכשלה" : "טרם נשלח";

  return <main className="auth-shell" dir="rtl"><section className="panel auth-card verification-card">
    <SynCashLogo size="md" /><span className="verification-icon"><MailCheck /></span><h1>{locationState?.registered ? "ההרשמה הושלמה" : "אימות כתובת דוא״ל"}</h1>
    <p>{status.status === "SENT" ? "מייל אימות נשלח בפועל באמצעות ספק הדואר הפעיל." : "החשבון ממתין לאימות כתובת הדוא״ל."}</p>
    {status.email && <strong>{status.email}</strong>}
    <dl className="verification-status"><div><dt>סטטוס השליחה</dt><dd>{statusLabel}</dd></div><div><dt>זמן השליחה האחרון</dt><dd>{status.lastSentAt ? formatSentAt(status.lastSentAt) : "אין שליחה קודמת"}</dd></div></dl>
    <p>לאחר פתיחת קישור האימות, חזור למסך זה ובדוק את סטטוס החשבון.</p>
    {message && <div className="toast success verification-toast" role="status">{message}</div>}
    {error && <div className="toast error verification-toast" role="alert"><strong>{error}</strong>{requestId && <small>מזהה בקשה: {requestId}</small>}</div>}
    <button className="secondary-action" disabled={busy !== null || !auth.currentUser} onClick={() => void resend()}><RefreshCw size={17} />{busy === "resend" ? "שולח מייל…" : "שליחה מחדש של מייל האימות"}</button>
    <button className="primary-action large" disabled={busy !== null} onClick={() => void check()}>{busy === "check" ? "בודק אימות…" : "בדקתי, כתובת הדוא״ל אומתה"}</button>
    <button className="ghost-action" disabled={busy !== null} onClick={() => void back()}>חזרה למסך הכניסה</button>
  </section></main>;
}
