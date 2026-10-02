import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildWhatsAppLink, isPlaceholderNumber, isWhatsAppAvailable, MAX_WHATSAPP_MESSAGE_LENGTH, type PublicSiteSettings, type SocialNetwork } from "../domain/publicSite";
import { ApiError, api } from "../utils/apiClient";

const socialFields: Array<{key: SocialNetwork; label: string; placeholder: string}> = [
  {key: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/..."},
  {key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/..."},
  {key: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/..."},
  {key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@..."}
];

// הגדרות האתר הציבורי (syncash.co.il). התוכן וה-SEO של האתר נשארים בקוד; כאן רק
// כפתור WhatsApp, כפתורי CTA וקישורי רשתות — שינויים נכנסים לתוקף מיד, ללא פריסה.
export default function AdminPublicSiteSettingsView() {
  const [settings, setSettings] = useState<PublicSiteSettings | null>(null);
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [social, setSocial] = useState<Record<SocialNetwork, string>>({facebook: "", linkedin: "", instagram: "", youtube: ""});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{text: string; error: boolean} | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = (result: PublicSiteSettings) => {
    setSettings(result);
    setNumber(result.whatsappNumber);
    setMessage(result.whatsappMessage);
    setSocial({facebook: result.socialLinks.facebook ?? "", linkedin: result.socialLinks.linkedin ?? "", instagram: result.socialLinks.instagram ?? "", youtube: result.socialLinks.youtube ?? ""});
  };
  useEffect(() => { void api.adminPublicSiteSettings().then(load); }, []);

  const toggle = async (key: "whatsappEnabled" | "registrationEnabled" | "loginEnabled", value: boolean) => {
    if (!settings) return;
    setSettings({...settings, [key]: value});
    try { load(await api.updateAdminPublicSiteSettings({[key]: value})); setFeedback({text: "ההגדרה עודכנה.", error: false}); }
    catch { setFeedback({text: "עדכון ההגדרה נכשל. נסה שוב.", error: true}); load(await api.adminPublicSiteSettings()); }
  };

  const submit = async (event: React.FormEvent, patch: Parameters<typeof api.updateAdminPublicSiteSettings>[0], successText: string) => {
    event.preventDefault();
    setBusy(true); setFeedback(null); setFieldErrors({});
    try { load(await api.updateAdminPublicSiteSettings(patch)); setFeedback({text: successText, error: false}); }
    catch (caught) {
      if (caught instanceof ApiError && caught.code === "VALIDATION_ERROR") { setFieldErrors(caught.fieldErrors); setFeedback({text: "יש לתקן את השדות המסומנים.", error: true}); }
      else setFeedback({text: "השמירה נכשלה. נסה שוב.", error: true});
    } finally { setBusy(false); }
  };

  if (!settings) return <main className="admin-page"><div className="empty-state">טוען הגדרות…</div></main>;

  const placeholder = isPlaceholderNumber(settings.whatsappNumber);
  const available = isWhatsAppAvailable(settings);

  return <main className="admin-page">
    <nav className="breadcrumbs" aria-label="פירורי לחם"><Link to="/admin">לוח הבקרה</Link><span>›</span><Link to="/admin/settings">הגדרות מערכת</Link><span>›</span><span aria-current="page">האתר הציבורי</span></nav>
    <section className="panel">
      <header className="section-heading compact"><div><h1>הגדרות מערכת &gt; האתר הציבורי</h1><p>השינויים באתר הציבורי נכנסים לתוקף ללא צורך בפריסה מחדש.</p></div></header>
      {feedback && <p className={feedback.error ? "form-message error" : "form-message success"} role="status">{feedback.text}</p>}
    </section>

    <section className="panel">
      <header className="section-heading compact"><div><h2>כפתור צור קשר ב-WhatsApp</h2><p>הכפתור מוצג באתר רק כשהוא מופעל וכשמוגדר מספר תקין. עד אז הוא מוסתר אוטומטית.</p></div></header>
      <p><span className={`public-site-status ${available ? "active" : "inactive"}`}>{available ? "כפתור WhatsApp פעיל באתר" : placeholder ? "מספר זמני — כפתור WhatsApp אינו פעיל באתר." : "כפתור WhatsApp אינו פעיל באתר"}</span></p>
      <div className="check-list"><label><input type="checkbox" checked={settings.whatsappEnabled} onChange={(event) => void toggle("whatsappEnabled", event.target.checked)} />הצגת כפתור WhatsApp באתר</label></div>
      <form className="form-grid" onSubmit={(event) => void submit(event, {whatsappNumber: number, whatsappMessage: message}, "פרטי ה-WhatsApp נשמרו.")}>
        <label>מספר WhatsApp עסקי
          <input type="tel" inputMode="numeric" dir="ltr" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="0501234567" aria-invalid={Boolean(fieldErrors.whatsappNumber)} aria-describedby="whatsapp-number-hint" />
          <span id="whatsapp-number-hint" className="public-site-hint">מזינים מספר ישראלי (למשל 0501234567); המערכת שומרת אותו בפורמט בינלאומי. ספרות בלבד.</span>
          {fieldErrors.whatsappNumber && <span className="error" role="alert">{fieldErrors.whatsappNumber}</span>}
        </label>
        <label>הודעה מוכנה מראש
          <textarea rows={3} maxLength={MAX_WHATSAPP_MESSAGE_LENGTH} value={message} onChange={(event) => setMessage(event.target.value)} aria-invalid={Boolean(fieldErrors.whatsappMessage)} />
          {fieldErrors.whatsappMessage && <span className="error" role="alert">{fieldErrors.whatsappMessage}</span>}
        </label>
        {available && <p className="public-site-preview">{buildWhatsAppLink(settings.whatsappNumber, settings.whatsappMessage)}</p>}
        <div className="form-actions"><button type="submit" className="primary-action" disabled={busy}>{busy ? "שומר…" : "שמירת פרטי WhatsApp"}</button></div>
      </form>
    </section>

    <section className="panel">
      <header className="section-heading compact"><div><h2>כפתורי פעולה באתר</h2><p>כיבוי מסתיר את הכפתור באתר הציבורי בלבד; הוא לא משנה את ההרשאות באפליקציה.</p></div></header>
      <div className="check-list">
        <label><input type="checkbox" checked={settings.registrationEnabled} onChange={(event) => void toggle("registrationEnabled", event.target.checked)} />הצגת "הרשמה חינם ליועצים"</label>
        <label><input type="checkbox" checked={settings.loginEnabled} onChange={(event) => void toggle("loginEnabled", event.target.checked)} />הצגת "כניסה למערכת"</label>
      </div>
    </section>

    <section className="panel">
      <header className="section-heading compact"><div><h2>קישורי רשתות חברתיות</h2><p>קישור ריק אינו מוצג באתר. מתקבלים רק קישורי https מלאים לרשת המתאימה.</p></div></header>
      <form className="form-grid" onSubmit={(event) => void submit(event, {socialLinks: {facebook: social.facebook || null, linkedin: social.linkedin || null, instagram: social.instagram || null, youtube: social.youtube || null}}, "קישורי הרשתות נשמרו.")}>
        {socialFields.map((field) => <label key={field.key}>{field.label}
          <input type="url" dir="ltr" value={social[field.key]} placeholder={field.placeholder} onChange={(event) => setSocial({...social, [field.key]: event.target.value})} aria-invalid={Boolean(fieldErrors[`socialLinks.${field.key}`])} />
          {fieldErrors[`socialLinks.${field.key}`] && <span className="error" role="alert">{fieldErrors[`socialLinks.${field.key}`]}</span>}
        </label>)}
        <div className="form-actions"><button type="submit" className="primary-action" disabled={busy}>{busy ? "שומר…" : "שמירת קישורים"}</button></div>
      </form>
    </section>
  </main>;
}
