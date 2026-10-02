// סנכרון מצב ה-idle בין לשוניות של אותו דפדפן.
// עובר בין לשוניות רק חותמת זמן של פעילות ואות "יציאה" — לעולם לא טוקן או מידע רגיש.
// BroadcastChannel כשקיים, ו-localStorage (אירוע storage) כגיבוי.

export type IdleSyncMessage = {type: "activity"; at: number} | {type: "logout"};

const CHANNEL_NAME = "syncash-idle";
const ACTIVITY_KEY = "syncash:idle:last-activity";
const LOGOUT_KEY = "syncash:idle:logout";

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* מצב פרטי / אחסון חסום — הסנכרון בין לשוניות פשוט לא יפעל */ }
}

export function publishActivity(at: number): void {
  getChannel()?.postMessage({type: "activity", at} satisfies IdleSyncMessage);
  writeStorage(ACTIVITY_KEY, String(at));
}

export function publishLogout(): void {
  getChannel()?.postMessage({type: "logout"} satisfies IdleSyncMessage);
  writeStorage(LOGOUT_KEY, String(Date.now()));
}

export function readSharedActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const value = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

export function subscribeIdleSync(handler: (message: IdleSyncMessage) => void): () => void {
  const onMessage = (event: MessageEvent<IdleSyncMessage>) => { if (event.data && typeof event.data === "object") handler(event.data); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACTIVITY_KEY && event.newValue) {
      const at = Number(event.newValue);
      if (Number.isFinite(at)) handler({type: "activity", at});
    } else if (event.key === LOGOUT_KEY && event.newValue) {
      handler({type: "logout"});
    }
  };
  const current = getChannel();
  current?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  return () => {
    current?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}

export function clearIdleSyncState(): void {
  try { localStorage.removeItem(ACTIVITY_KEY); localStorage.removeItem(LOGOUT_KEY); } catch { /* ignore */ }
}
