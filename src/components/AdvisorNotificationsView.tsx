import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import type { NotificationRecord } from "../types";
import { api } from "../utils/apiClient";
import { formatDate } from "../utils/formatters";

export default function AdvisorNotificationsView() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const load = async () => setNotifications(await api.notifications());
  useEffect(() => { void load(); }, []);
  const markRead = async (id: number) => { await api.markNotificationRead(id); await load(); };
  return <main className="advisor-page"><section className="page-title"><div><span className="eyebrow">עדכונים בזמן אמת</span><h1>התראות</h1><p>בקשות חשיפה, הצעות ועדכוני מערכת המחכים לטיפולך.</p></div></section><section className="content-card">{notifications.length === 0 ? <div className="empty-state"><Bell size={34} /><h3>אין התראות חדשות</h3><p>עדכונים חדשים יופיעו כאן.</p></div> : <div className="notifications-list">{notifications.map((notification) => <article className={notification.readAt ? "notification-card read" : "notification-card"} key={notification.id}><span className="notification-icon"><Bell /></span><div><h3>{notification.title}</h3><p>{notification.body}</p><small>{formatDate(notification.createdAt)}</small></div>{!notification.readAt && <button type="button" className="icon-text-button" onClick={() => void markRead(notification.id)}><CheckCircle2 size={17} />סימון כנקרא</button>}</article>)}</div>}</section></main>;
}
