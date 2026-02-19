'use client';

import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { ref, set, onChildAdded, query, limitToLast } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { subscribeToUserTopics } from '@/app/actions/notifications';

/**
 * Component responsible for managing Firebase Cloud Messaging (FCM) tokens
 * and subscribing users to their specific UID and broadcast topics.
 */
export function FCMManager() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined' || !user || !messaging) return;

    const initializeFCM = async () => {
      try {
        // Request browser permission for notifications
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          
          if (!vapidKey) {
            console.warn("FCM VAPID key not found. Push notifications will not work.");
            return;
          }

          const token = await getToken(messaging, { vapidKey });
          
          if (token) {
            // 1. Store token in DB for metadata (optional, but good for auditing)
            const tokenRef = ref(db, `users/${user.uid}/fcmTokens/${token}`);
            await set(tokenRef, true);

            // 2. Subscribe the token to topics via Server Action
            // This links the token to the user's UID topic and the 'broadcast' topic
            await subscribeToUserTopics(token, user.uid);
          }
        }
      } catch (error) {
        console.error('Failed to initialize FCM:', error);
      }
    };

    initializeFCM();

    // 1. Listen for real FCM messages (foreground)
    const unsubscribeFCM = onMessage(messaging, (payload) => {
      toast({
        title: payload.notification?.title || 'System Alert',
        description: payload.notification?.body || 'You have a new update.',
      });
    });

    // 2. Local fallback: Listen for new DB notifications while app is open
    const notificationsRef = query(ref(db, `notifications/${user.uid}`), limitToLast(1));
    const unsubscribeDB = onChildAdded(notificationsRef, (snapshot) => {
        const data = snapshot.val();
        // Only show if it's very recent (within last 10 seconds)
        if (data && Date.now() - data.timestamp < 10000) {
            toast({
                title: 'Edutrack360',
                description: data.message,
            });
        }
    });

    return () => {
        unsubscribeFCM();
        unsubscribeDB();
    };
  }, [user, toast]);

  return null;
}
