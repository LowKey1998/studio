'use client';

import { useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { ref, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

/**
 * Component responsible for managing Firebase Cloud Messaging (FCM) tokens
 * and listening for foreground notifications.
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
          // Retrieve the VAPID key from environment variables
          const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
          
          if (!vapidKey) {
            console.warn("FCM VAPID key not found in environment variables. Set NEXT_PUBLIC_FIREBASE_VAPID_KEY to enable push notifications.");
            return;
          }

          // Get the registration token for this device/browser
          const token = await getToken(messaging, { vapidKey });
          
          if (token) {
            // Store the token in the user's database record so the backend knows where to send messages
            const tokenRef = ref(db, `users/${user.uid}/fcmTokens/${token}`);
            await set(tokenRef, true);
          }
        }
      } catch (error) {
        console.error('Failed to initialize FCM or retrieve token:', error);
      }
    };

    initializeFCM();

    // Listen for incoming messages while the app is in the foreground
    const unsubscribe = onMessage(messaging, (payload) => {
      toast({
        title: payload.notification?.title || 'System Notification',
        description: payload.notification?.body || 'You have a new update.',
      });
    });

    return () => unsubscribe();
  }, [user, toast]);

  return null;
}
