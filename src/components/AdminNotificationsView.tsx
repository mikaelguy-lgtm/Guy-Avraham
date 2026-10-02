import { Bell, CheckCheck, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminEntityLink } from "../utils/adminEntityLink";
import { formatDate } from "../utils/formatters";
import {useAdminNotifications} from "./adminNotificationsState";

export default function AdminNotificationsView() {
  const {notifications, unreadCount, loading, markRead, markAllRead} = useAdminNotifications();
  const navigate = useNavigate();
  return <main className="admin-page"><section className="page-title"><div><span className="eyebrow">מרכז התראות</span><h1>התראות</h1><p>יועצים חדשים, תיקים חדשים, וחברות מימון שהביעו עניין.</p></div>{unreadCount > 0 && <button type="button" className="secondary-action" onClick={() => void markAllRead()}><CheckCheck size={18} />סמן הכל כנקרא</button>}</section><section className="content-card">{loading ? <div className="empty-state">טוען התראות…</div> : notifications.length === 0 ? <div className="empty-state"><Bell size={34} /><h3>אין התראות חדשות</h3><p>עדכונים חדשים יופיעו כאן.</p></div> : <div className="notifications-list">{notifications.map((notification) => <article className={notification.readAt ? "notification-card read" : "notification-card"} key={notification.id}><span className="notification-icon"><Bell /></span><div><h3>{notification.title}</h3><p>{notification.body}</p><small>{formatDate(notification.createdAt)}</small></div><div className="toolbar">{!notification.readAt && <button type="button" className="icon-text-button" onClick={() => void markRead(notification.id)}><CheckCircle2 size={17} />סימון כנקרא</button>}<button type="button" className="icon-text-button" onClick={() => { void markRead(notification.id); navigate(adminEntityLink(notification.entityType, notification.entityId)); }}>מעבר לישות</button></div></article>)}</div>}</section></main>;
}
