
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Notification } from '@/lib/types';
import { summarizeNotifications } from '@/ai/flows/summarize-notifications';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './use-auth';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const { toast } = useToast();

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

  const handleSummarize = useCallback(async () => {
    setIsLoadingSummary(true);
    setSummary(null);
    try {
      const unread = notifications.filter((n) => !n.isRead);
      if (unread.length === 0) {
        toast({
            title: "No new notifications",
            description: "You're all caught up!",
        });
        return;
      }
      
      const result = await summarizeNotifications({ notifications: unread.map(n => ({...n, timestamp: new Date(n.timestamp).toISOString()})) });
      setSummary(result.summary);
    } catch (error) {
      console.error('Failed to summarize notifications:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not generate summary. Please try again.',
      });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [notifications, toast]);

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
    setSummary(null);
  }, [user, notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    summary,
    isLoadingSummary,
    summarize: handleSummarize,
    markAsRead,
    markAllAsRead,
  };
}
