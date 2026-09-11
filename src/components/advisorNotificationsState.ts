import {createContext, useContext} from "react";
import type {NotificationRecord} from "../types";

export interface AdvisorNotificationsState {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const AdvisorNotificationsContext = createContext<AdvisorNotificationsState | null>(null);

export function useAdvisorNotifications(): AdvisorNotificationsState {
  const context = useContext(AdvisorNotificationsContext);
  if (!context) throw new Error("ADVISOR_NOTIFICATIONS_PROVIDER_REQUIRED");
  return context;
}
