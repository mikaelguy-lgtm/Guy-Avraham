import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ACTIVITY_REPORT_INTERVAL_MS, IDLE_LOGOUT_MESSAGE, IDLE_TIMEOUT_MS, IDLE_WARNING_AT_MS } from "../domain/idleSession";
import { api, setAuthNotice } from "../utils/apiClient";
import { publishActivity, publishLogout, readSharedActivity, subscribeIdleSync } from "../utils/idleSync";

// ניתוק אוטומטי אחרי 5 דקות ללא פעילות אמיתית, לכל התפקידים המחוברים.
// "פעילות אמיתית" = עכבר/מקלדת/מגע/גלילה/ניווט/אינטראקציה עם טופס של המשתמש בלשונית זו,
// או פעילות כזו בלשונית אחרת (סנכרון). SSE, polling, רענון טוקן ורינדורים אינם פעילות.
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "input", "change"];
const SCROLL_THROTTLE_MS = 1000;

export default function IdleSessionProvider({children}: {children: ReactNode}) {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef<number>(Date.now());
  const lastReportRef = useRef<number>(0);
  const lastScrollRef = useRef<number>(0);
  const loggingOutRef = useRef(false);
  const warningRef = useRef(false);
  const [warning, setWarning] = useState<{secondsLeft: number} | null>(null);

  const logout = useCallback(async (reason: "IDLE" | "MANUAL", options: {broadcast: boolean} = {broadcast: true}) => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setWarning(null);
    if (reason === "IDLE") setAuthNotice(IDLE_LOGOUT_MESSAGE);
    if (options.broadcast) publishLogout();
    try { await api.logout(reason, {broadcast: false}); } catch { /* ה-signOut המקומי כבר בוצע בתוך api.logout; אין מה לעשות מעבר לזה */ }
    navigate("/login", {replace: true});
  }, [navigate]);

  // דיווח לשרת רק בעקבות פעילות אמיתית, ולכל היותר פעם בדקה (או מיד כשמבקשים במפורש).
  const reportActivity = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastReportRef.current < ACTIVITY_REPORT_INTERVAL_MS) return;
    lastReportRef.current = now;
    void api.reportActivity().catch(() => undefined); // 401 IDLE_EXPIRED מטופל דרך האירוע הגלובלי
  }, []);

  const markActivity = useCallback((options: {fromOtherTab?: boolean; force?: boolean; at?: number} = {}) => {
    if (loggingOutRef.current) return;
    // בזמן שמוצגת האזהרה, פעילות רגילה בלשונית זו לא מאריכה את הסשן — רק "המשך עבודה" (force)
    // או פעילות אמיתית בלשונית אחרת (שם המשתמש באמת עובד).
    if (warningRef.current && !options.force && !options.fromOtherTab) return;
    const at = options.at ?? Date.now();
    if (at <= lastActivityRef.current && !options.force) return;
    lastActivityRef.current = at;
    if (warningRef.current) { warningRef.current = false; setWarning(null); }
    if (!options.fromOtherTab) {
      publishActivity(at);
      reportActivity(options.force === true);
    }
  }, [reportActivity]);

  // מאזיני פעילות בלשונית הנוכחית
  useEffect(() => {
    const handler = (event: Event) => {
      if (event.type === "scroll" || event.type === "wheel") {
        const now = Date.now();
        if (now - lastScrollRef.current < SCROLL_THROTTLE_MS) return;
        lastScrollRef.current = now;
      }
      markActivity();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, handler, {passive: true, capture: true});
    return () => { for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, handler, {capture: true}); };
  }, [markActivity]);

  // ניווט בתוך האפליקציה הוא פעולת משתמש
  useEffect(() => { markActivity(); }, [location.key, markActivity]);

  // סנכרון בין לשוניות + פקיעה שהשרת החזיר (401 IDLE_EXPIRED)
  useEffect(() => {
    const shared = readSharedActivity();
    if (shared && shared > lastActivityRef.current) lastActivityRef.current = shared;
    const unsubscribe = subscribeIdleSync((message) => {
      if (message.type === "activity") markActivity({fromOtherTab: true, at: message.at});
      // יציאה שהתחילה בלשונית אחרת (ידנית או בגלל חוסר פעילות): מתנתקים כאן בלי לשדר שוב ובלי הודעת idle
      else void logout("MANUAL", {broadcast: false});
    });
    const onExpired = () => { void logout("IDLE"); };
    window.addEventListener("syncash:idle-expired", onExpired);
    return () => { unsubscribe(); window.removeEventListener("syncash:idle-expired", onExpired); };
  }, [logout, markActivity]);

  // הטיימר עצמו: בדיקה כל שנייה מול חותמת הפעילות (לא מאריך כלום בעצמו)
  useEffect(() => {
    const tick = () => {
      if (loggingOutRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) { void logout("IDLE"); return; }
      if (idle >= IDLE_WARNING_AT_MS) {
        warningRef.current = true;
        setWarning({secondsLeft: Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000))});
      }
    };
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [logout]);

  // פוקוס על כפתור ההמשך כשהאזהרה נפתחת (נגישות מקלדת)
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (warning) continueButtonRef.current?.focus(); }, [warning !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>
    {children}
    {warning && <div className="modal-backdrop idle-warning-backdrop" role="presentation">
      <section className="panel modal idle-warning-modal" role="alertdialog" aria-modal="true" aria-labelledby="idle-warning-title" aria-describedby="idle-warning-text" dir="rtl">
        <h2 id="idle-warning-title">עדיין כאן?</h2>
        <p id="idle-warning-text">לא זיהינו פעילות במערכת. מטעמי אבטחה המערכת תתנתק בעוד <strong className="idle-countdown" aria-live="polite">{warning.secondsLeft}</strong> שניות.</p>
        <div className="modal-actions">
          <button ref={continueButtonRef} type="button" className="primary-action" onClick={() => markActivity({force: true})}>המשך עבודה</button>
        </div>
      </section>
    </div>}
  </>;
}
