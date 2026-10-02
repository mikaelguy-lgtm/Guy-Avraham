// כלל ה-idle timeout המשותף לשרת וללקוח.
// "עוגן" הפעילות של סשן הוא המאוחר מבין: הפעילות האמיתית האחרונה שנרשמה בשרת
// (users.last_activity_at) ורגע ההתחברות של הטוקן (auth_time של Firebase).
// רענון טוקן שקט לא משנה את auth_time ולכן לעולם לא מאריך סשן.

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const IDLE_WARNING_BEFORE_MS = 30 * 1000;
export const IDLE_WARNING_AT_MS = IDLE_TIMEOUT_MS - IDLE_WARNING_BEFORE_MS;
// הלקוח שולח "פעילות" לשרת לכל היותר פעם ב-60 שניות, ורק בעקבות פעילות אמיתית.
export const ACTIVITY_REPORT_INTERVAL_MS = 60 * 1000;
export const IDLE_LOGOUT_MESSAGE = "החיבור נותק לאחר מספר דקות ללא פעילות. ניתן להתחבר מחדש.";

export function sessionAnchor(lastActivityAt: Date | null | undefined, authTime: Date | null | undefined): Date | null {
  const candidates = [lastActivityAt, authTime].filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((value) => value.getTime())));
}

export function isSessionFresh(lastActivityAt: Date | null | undefined, authTime: Date | null | undefined, now: Date = new Date()): boolean {
  const anchor = sessionAnchor(lastActivityAt, authTime);
  if (!anchor) return false;
  const elapsed = now.getTime() - anchor.getTime();
  return elapsed >= 0 ? elapsed <= IDLE_TIMEOUT_MS : true;
}
