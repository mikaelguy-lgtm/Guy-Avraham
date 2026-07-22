import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/apiClient";
import { ApiError } from "../utils/apiClient";
import type { CurrentUser } from "../types";
import SynCashLogo from "./SynCashLogo";

export default function AuthScreen({onAuthenticated}: {onAuthenticated: (user: CurrentUser) => void}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { onAuthenticated(await api.login(email, password)); }
    catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      if (apiError?.code === "EMAIL_NOT_VERIFIED") { navigate("/verify-email"); return; }
      setError(apiError?.status === 429 ? "בוצעו יותר מדי ניסיונות התחברות. יש להמתין ולנסות שוב." : "ההתחברות נכשלה. בדוק את כתובת הדוא״ל והסיסמה ונסה שוב.");
    }
    finally { setBusy(false); }
  };
  return <main className="auth-shell" dir="rtl">
    <form className="panel auth-card" onSubmit={submit}>
      <SynCashLogo size="md" />
      <h1>כניסה מאובטחת</h1>
      <label>דואר אלקטרוני<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>סיסמה<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "מתחבר…" : "כניסה"}</button>
      <p className="auth-link">עדיין אין לך חשבון? <Link to="/register/advisor">הרשמה ליועצים</Link></p>
    </form>
  </main>;
}
