import {useEffect, useRef, useState} from "react";
import {Bell, CheckCheck} from "lucide-react";
import {Link} from "react-router-dom";
import {formatDate} from "../utils/formatters";
import {useAdvisorNotifications} from "./advisorNotificationsState";

export default function AdvisorNotificationBell() {
  const {notifications, unreadCount, loading, markRead, markAllRead} = useAdvisorNotifications();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape);};
  }, []);

  return <div className="notification-bell" ref={container}>
    <button type="button" className="notification-bell-button" aria-label={`התראות${unreadCount ? `, ${unreadCount} לא נקראו` : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)}>
      <Bell aria-hidden="true" />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover content-card" role="dialog" aria-label="התראות אחרונות">
      <header><div><span className="eyebrow">עדכונים בזמן אמת</span><h2>התראות</h2></div>{unreadCount > 0 && <button type="button" className="icon-text-button" onClick={() => void markAllRead()}><CheckCheck size={17} />סמן הכל כנקרא</button>}</header>
      <div className="notification-popover-list">{loading ? <p className="notification-popover-empty">טוען התראות…</p> : notifications.length === 0 ? <p className="notification-popover-empty">אין התראות חדשות.</p> : notifications.slice(0, 6).map((notification) => <button type="button" className={`notification-popover-item${notification.readAt ? " read" : ""}`} key={notification.id} onClick={() => void markRead(notification.id)}><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.body}</small><time>{formatDate(notification.createdAt)}</time></span></button>)}</div>
      <Link className="notification-all-link" to="/advisor/notifications" onClick={() => setOpen(false)}>לכל ההתראות</Link>
    </section>}
  </div>;
}
