import { useState, useEffect, useCallback, useRef } from 'react';
import type { NotificationItemDto, NotificationType } from '@booyah/shared';
import { fetchUserNotifications } from '../api/notifications.js';
import { playNotificationSound } from '../utils/pushNotifications.js';
import { showSystemNotification } from '../services/localNotifications.js';

export type { NotificationItemDto, NotificationType };
export type NotificationItem = NotificationItemDto;

const STORAGE_KEY = 'booyah_notifications_last_read';
const NOTIFICATION_EVENT = 'booyah_notifications_updated';

export const INITIAL_NOTIFICATIONS: NotificationItemDto[] = [];

function areNotificationsEqual(a: NotificationItemDto[], b: NotificationItemDto[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].createdAt !== b[i].createdAt || a[i].message !== b[i].message) {
      return false;
    }
  }
  return true;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItemDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const notificationsRef = useRef<NotificationItemDto[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const [hasUnread, setHasUnread] = useState<boolean>(false);

  const checkUnread = useCallback((items: NotificationItemDto[]) => {
    if (typeof window === 'undefined') return;
    try {
      if (!items || items.length === 0) {
        setHasUnread(false);
        return;
      }
      const lastRead = Number(localStorage.getItem(STORAGE_KEY) || 0);
      const latest = Math.max(...items.map((n) => n.createdAt), 0);
      setHasUnread(latest > lastRead);
    } catch {
      setHasUnread(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await fetchUserNotifications();
      if (!isMountedRef.current) return;

      const newItems = Array.isArray(items) ? items : [];
      if (!areNotificationsEqual(notificationsRef.current, newItems)) {
        const lastNotified = Number(localStorage.getItem('booyah_last_notified_ts') || 0);

        if (notificationsRef.current.length > 0 || lastNotified > 0) {
          const oldIds = new Set(notificationsRef.current.map((n) => n.id));
          const brandNew = newItems.filter((n) => !oldIds.has(n.id) && n.createdAt > lastNotified);
          if (brandNew.length > 0) {
            const topItem = brandNew[0];
            playNotificationSound();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('bw_inapp_notification', { detail: topItem }));
            }
            showSystemNotification({
              title: topItem.title,
              body: topItem.message,
              actionUrl: topItem.actionUrl,
            });
            const maxTs = Math.max(...brandNew.map((n) => n.createdAt));
            localStorage.setItem('booyah_last_notified_ts', String(maxTs));
          }
        } else if (newItems.length > 0) {
          const maxTs = Math.max(...newItems.map((n) => n.createdAt));
          localStorage.setItem('booyah_last_notified_ts', String(maxTs));
        }
        setNotifications(newItems);
      }
      checkUnread(newItems);
    } catch {
      if (isMountedRef.current) {
        if (!areNotificationsEqual(notificationsRef.current, [])) {
          setNotifications([]);
        }
        checkUnread([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [checkUnread]);

  useEffect(() => {
    isMountedRef.current = true;
    loadNotifications();

    // Poll every 25 seconds for automatic notification updates (room open, match live, deposit etc.)
    const timer = setInterval(() => {
      loadNotifications();
    }, 25000);

    const handleFocus = () => loadNotifications();
    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener(NOTIFICATION_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener(NOTIFICATION_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadNotifications]);

  const markAllAsRead = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setHasUnread(false);
      window.dispatchEvent(new Event(NOTIFICATION_EVENT));
    } catch {
      // storage unavailable
    }
  }, []);

  return {
    notifications,
    isLoading,
    hasUnread,
    markAllAsRead,
    refreshNotifications: loadNotifications,
  };
}
