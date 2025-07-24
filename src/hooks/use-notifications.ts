"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Notification } from '@/lib/types';
import { summarizeNotifications } from '@/ai/flows/summarize-notifications';
import { useToast } from '@/hooks/use-toast';
import { mockNotifications as initialNotifications } from '@/lib/mock-data';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching notifications. In a real app, this would be a Firebase listener.
    setNotifications(initialNotifications);
  }, []);

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
      
      const result = await summarizeNotifications({ notifications: unread });
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    // In a real app, you would also update this in Firebase.
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
    setSummary(null);
    // In a real app, you would also update this in Firebase.
  }, []);

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
