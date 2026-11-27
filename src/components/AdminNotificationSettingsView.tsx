import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminNotificationSettings } from "../types";
import { ApiError, api } from "../utils/apiClient";

const coreToggles: Array<{key: keyof AdminNotificationSettings; label: string}> = [
  {key: "notifyNewAdvisor", label: "מייל על יועץ חדש"},
  {key: "notifyNewCase", label: "מייל על תיק חדש"},
  {key: "notifyLenderInterested", label: "מייל על חברת מימון מעוניינת"}
];
const optionalToggles: Array<{key: keyof AdminNotificationSettings; label: string}> = [
  {key: "notifyEmailFailed", label: "כשל שליחת מייל"},
  {key: "notifyDeadlinePassed", label: "מועד תגובה שעבר"},
  {key: "notifyPrivacyRequest", label: "בקשת פרטיות חדשה"}
];

export default function AdminNotificationSettingsView() {
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{text: string; error: boolean} | null>(null);

  useEffect(() => { void api.adminNotificationSettings().then((result) => { setSettings(result); setEmail(result.email ?? ""); }); }, []);

  const toggle = async (key: keyof AdminNotificationSettings, value: boolean) => {
    if (!settings) return;
    setSettings({...settings, [key]: value});
    try { setSettings(await api.updateAdminNotificationSettings({[key]: value})); }
    catch { setMessage({text: "עדכון ההגדרה נכשל. נסה שוב.", error: true}); setSettings(await api.adminNotificationSettings()); }
  };

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const result = await api.updateAdminNotificationSettings({email: email.trim() || null});
      setSettings(result); setEmail(result.email ?? "");
      setMessage({text: "כתובת המייל לעדכוני מנהל עודכנה בהצלחה.", error: false});
    } catch (caught) {
      setMessage({text: caught instanceof ApiError ? "כתובת המייל אינה תקינה." : "השמירה נכשלה. נסה שוב.", error: true});
    } finally { setBusy(false); }
  };

  if (!settings) return <main className="admin-page"><div className="empty-state">טוען הגדרות…</div></main>;

  return <main className="admin-page">
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><Link to="/admin/settings">הגדרות מערכת</Link><span>›</span><span aria-current="page">התראות מנהל</span></nav>
    <section className="panel">
      <header className="section-heading compact"><div><h1>הגדרות מערכת &gt; התראות מנהל</h1><p>כתובת מייל אחת לקבלת עדכונים על אירועים מרכזיים. התראות בתוך המערכת (פעמון) פועלות תמיד עבור שלושת האירועים המרכזיים, ללא תלות בהגדרות המייל.</p></div></header>
      <form className="form-grid" onSubmit={(event) => void saveEmail(event)}>
        <label>כתובת מייל לקבלת התראות מנהל<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label>
        {message && <p className={message.error ? "form-message error" : "form-message success"} role="status">{message.text}</p>}
        <div className="form-actions"><button type="submit" className="primary-action" disabled={busy}>{busy ? "שומר…" : "שמירת כתובת"}</button></div>
      </form>
    </section>
    <section className="panel">
      <header className="section-heading compact"><div><h2>אירועי ליבה — מייל בברירת מחדל פעיל</h2><p>כיבוי הטוגל מכבה רק את המייל; ההתראה בתוך המערכת ממשיכה תמיד.</p></div></header>
      <div className="check-list">{coreToggles.map((item) => <label key={item.key}><input type="checkbox" checked={Boolean(settings[item.key])} onChange={(event) => void toggle(item.key, event.target.checked)} />{item.label}</label>)}</div>
    </section>
    <section className="panel">
      <header className="section-heading compact"><div><h2>אירועים אופציונליים — כבוי כברירת מחדל</h2><p>טוגל יחיד לכל אירוע, שולט גם בהתראה בתוך המערכת וגם במייל. ההגדרות נשמרות כבר עכשיו, אך האירועים עצמם (כשל מייל / מועד שעבר / בקשת פרטיות) עדיין אינם מקושרים לטריגר פעיל במערכת — יתווספו בעתיד.</p></div></header>
      <div className="check-list">{optionalToggles.map((item) => <label key={item.key}><input type="checkbox" checked={Boolean(settings[item.key])} onChange={(event) => void toggle(item.key, event.target.checked)} />{item.label}</label>)}</div>
    </section>
  </main>;
}
