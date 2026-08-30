import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/apiClient";
import SynCashLogo from "./SynCashLogo";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.forgotPassword(email);
      setMessage(result.message);
    } catch {
      // אותה הודעה כללית גם במקרה כשל — לא חושפים אם הכשל נובע מכתובת לא קיימת או משגיאה טכנית.
      setMessage("אם קיים חשבון המשויך לכתובת הזו, נשלח אליך קישור לאיפוס הסיסמה.");
    } finally {
      setBusy(false);
    }
  };
  return <main className="auth-shell" dir="rtl">
    <form className="panel auth-card" onSubmit={(event) => void submit(event)}>
      <SynCashLogo size="md" />
      <h1>שכחתי סיסמה</h1>
      {!message ? <>
        <p className="auth-hint">הזן את כתובת הדוא״ל המשויכת לחשבון, ונשלח אליך קישור לאיפוס הסיסמה.</p>
        <label>דואר אלקטרוני<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></label>
        <button disabled={busy}>{busy ? "שולח…" : "שליחת קישור לאיפוס"}</button>
      </> : <p className="form-message success" role="status">{message}</p>}
      <p className="auth-link"><Link to="/login">חזרה למסך הכניסה</Link></p>
    </form>
  </main>;
}
