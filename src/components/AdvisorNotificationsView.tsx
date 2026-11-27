import { Bell, CheckCheck, CheckCircle2 } from "lucide-react";
import { formatDate } from "../utils/formatters";
import {useAdvisorNotifications} from "./advisorNotificationsState";

export default function AdvisorNotificationsView() {
  const {notifications, unreadCount, loading, markRead, markAllRead} = useAdvisorNotifications();
  return <main className="advisor-page"><section className="page-title"><div><span className="eyebrow">עדכונים בזמן אמת</span><h1>התראות</h1><p>בקשות חשיפה, הצעות ועדכוני מערכת המחכים לטיפולך.</p></div>{unreadCount > 0 && <button type="button" className="secondary-action" onClick={() => void markAllRead()}><CheckCheck size={18} />סמן הכל כנקרא</button>}</section><section className="content-card">{loading ? <div className="empty-state">טוען התראות…</div> : notifications.length === 0 ? <div className="empty-state"><Bell size={34} /><h3>אין התראות חדשות</h3><p>עדכונים חדשים יופיעו כאן.</p></div> : <div className="notifications-list">{notifications.map((notification) => <article className={notification.readAt ? "notification-card read" : "notification-card"} key={notification.id}><span className="notification-icon"><Bell /></span><div><h3>{notification.title}</h3><p>{notification.body}</p><small>{formatDate(notification.createdAt)}</small></div>{!notification.readAt && <button type="button" className="icon-text-button" onClick={() => void markRead(notification.id)}><CheckCircle2 size={17} />סימון כנקרא</button>}</article>)}</div>}</section></main>;
}
