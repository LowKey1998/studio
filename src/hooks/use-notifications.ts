
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Notification } from '@/lib/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const notificationsRef = ref(db, `notifications/${user.uid}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const notificationsList: Notification[] = Object.keys(data)
                .map(key => ({ 
                    id: key, 
                    ...data[key],
                    isRead: data[key].read // handle camelCase mismatch
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            setNotifications(notificationsList);
        } else {
            setNotifications([]);
        }
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    if (!user) return;
    const notificationRef = ref(db, `notifications/${user.uid}/${id}`);
    update(notificationRef, { read: true });
  }, [user]);

  const markAllAsRead = useCallback(() => {
    if (!user || unreadCount === 0) return;
    const updates: Record<string, boolean> = {};
    notifications.forEach(n => {
      if (!n.isRead) {
        updates[`/notifications/${user.uid}/${n.id}/read`] = true;
      }
    });
    update(ref(db), updates);
  }, [user, notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
