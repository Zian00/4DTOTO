import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  listNotifications,
  markNotificationRead,
  type NotificationListItem,
} from '../services/api';

type NotificationContextValue = {
  entries: NotificationListItem[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<NotificationListItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await listNotifications();
      setEntries(data);
    } catch {
      // silently fail — bell just shows no notifications
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      // optimistic update
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)),
      );
      try {
        await markNotificationRead(id);
      } catch {
        // revert on failure
        await refresh();
      }
    },
    [refresh],
  );

  const unreadCount = entries.filter((e) => !e.is_read).length;

  return (
    <NotificationContext.Provider value={{ entries, unreadCount, markRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
