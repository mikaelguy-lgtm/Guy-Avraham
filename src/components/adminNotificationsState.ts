import {createContext, useContext} from "react";
import type {NotificationRecord} from "../types";

export interface AdminNotificationsState {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const AdminNotificationsContext = createContext<AdminNotificationsState | null>(null);

export function useAdminNotifications(): AdminNotificationsState {
  const context = useContext(AdminNotificationsContext);
  if (!context) throw new Error("ADMIN_NOTIFICATIONS_PROVIDER_REQUIRED");
  return context;
}
