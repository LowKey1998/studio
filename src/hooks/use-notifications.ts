"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Notification } from '@/lib/types';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';

export function useNotifications() {
  const { user } = useAuth();
  const [personalNotifications, setPersonalNotifications] = useState<Notification[]>([]);
  const [broadcasts, setBroadcasts] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setPersonalNotifications([]);
      setBroadcasts([]);
      return;
    }

    const notificationsRef = ref(db, `notifications/${user.uid}`);
    const broadcastsRef = ref(db, 'broadcasts');

    // Listen for personal notifications
    const unsubPersonal = onValue(notificationsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const list: Notification[] = Object.keys(data).map(key => ({ 
                id: key, 
                ...data[key],
                isRead: data[key].read 
            }));
            setPersonalNotifications(list);
        } else {
            setPersonalNotifications([]);
        }
    });

    // Listen for global broadcasts
    const unsubBroadcasts = onValue(broadcastsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const list: Notification[] = Object.keys(data).map(key => ({ 
                id: key, 
                ...data[key],
                isRead: true, // Broadcasts are usually treated as read/informational
                isBroadcast: true
            }));
            setBroadcasts(list);
        } else {
            setBroadcasts([]);
        }
    });

    return () => {
        unsubPersonal();
        unsubBroadcasts();
    };
  }, [user]);

  const notifications = useMemo(() => {
      return [...personalNotifications, ...broadcasts]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [personalNotifications, broadcasts]);

  const unreadCount = useMemo(() => {
    return personalNotifications.filter((n) => !n.isRead).length;
  }, [personalNotifications]);

  const markAsRead = useCallback((id: string) => {
    if (!user) return;
    const notificationRef = ref(db, `notifications/${user.uid}/${id}`);
    update(notificationRef, { read: true });
  }, [user]);

  const markAllAsRead = useCallback(() => {
    if (!user || unreadCount === 0) return;
    const updates: Record<string, boolean> = {};
    personalNotifications.forEach(n => {
      if (!n.isRead) {
        updates[`/notifications/${user.uid}/${n.id}/read`] = true;
      }
    });
    update(ref(db), updates);
  }, [user, personalNotifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
