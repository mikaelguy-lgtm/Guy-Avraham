import {useCallback, useEffect, useMemo, useState, type ReactNode} from "react";
import type {NotificationRecord} from "../types";
import {api, subscribeDeliveryEvents} from "../utils/apiClient";
import {AdminNotificationsContext} from "./adminNotificationsState";

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal.addEventListener("abort", () => {window.clearTimeout(timer); resolve();}, {once: true});
});

// Reuses the exact same generic /api/notifications* endpoints and the same
// SSE nudge-to-refetch pattern as AdvisorNotificationsProvider — the
// backend already scopes every read/write by request.user.id, so a
// SUPER_ADMIN here only ever sees/affects their own rows (see
// tests/integration/notificationAuthorization.test.ts for the explicit
// cross-role proof).
export function AdminNotificationsProvider({children}: {children: ReactNode}) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const records = await api.notifications();
    setNotifications(records);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh().catch(() => setLoading(false)); }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const listen = async () => {
      while (!controller.signal.aborted) {
        try { await subscribeDeliveryEvents(controller.signal, () => void refresh()); }
        catch (error) { if (!controller.signal.aborted && (error as {name?: string}).name !== "AbortError") await wait(3_000, controller.signal); }
      }
    };
    void listen();
    return () => controller.abort();
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    setNotifications((current) => current.map((item) => item.id === id && !item.readAt ? {...item, readAt: new Date().toISOString()} : item));
    try { await api.markNotificationRead(id); }
    catch (error) { await refresh(); throw error; }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.readAt ? item : {...item, readAt}));
    try { await api.markAllNotificationsRead(); }
    catch (error) { await refresh(); throw error; }
  }, [refresh]);

  const value = useMemo(() => ({notifications, unreadCount: notifications.filter((item) => !item.readAt).length, loading, refresh, markRead, markAllRead}), [notifications, loading, refresh, markRead, markAllRead]);
  return <AdminNotificationsContext.Provider value={value}>{children}</AdminNotificationsContext.Provider>;
}
