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

          // Register the background worker and pass config
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          
          // Send config to the worker
          const config = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          };

          if (registration.active) {
            registration.active.postMessage({ type: 'SET_CONFIG', config });
          } else {
            registration.addEventListener('activate', () => {
              registration.active?.postMessage({ type: 'SET_CONFIG', config });
            });
          }

          const token = await getToken(messaging, { 
            vapidKey,
            serviceWorkerRegistration: registration
          });
          
          if (token) {
            const tokenRef = ref(db, `users/${user.uid}/fcmTokens/${token}`);
            await set(tokenRef, true);
            await subscribeToUserTopics(token, user.uid);
          }
        }
      } catch (error) {
        console.error('Failed to initialize FCM:', error);
      }
    };

    initializeFCM();

    const unsubscribeFCM = onMessage(messaging, (payload) => {
      toast({
        title: payload.notification?.title || 'System Alert',
        description: payload.notification?.body || 'You have a new update.',
      });
    });

    const notificationsRef = query(ref(db, `notifications/${user.uid}`), limitToLast(1));
    const unsubscribeDB = onChildAdded(notificationsRef, (snapshot) => {
        const data = snapshot.val();
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
