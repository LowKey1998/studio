'use server';

import { adminApp } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Sends a notification to a specific user.
 * This function writes to the Realtime Database for the in-app notification list
 * and sends an FCM push notification to all registered device tokens for that user.
 */
export async function sendNotification(userId: string, message: string, link: string, type: string = 'info') {
  try {
    const db = getDatabase(adminApp);
    const messaging = getMessaging(adminApp);

    // 1. Add to Realtime Database for the in-app notification center
    const notificationRef = db.ref(`notifications/${userId}`).push();
    await notificationRef.set({
      message,
      link,
      type,
      timestamp: Date.now(),
      read: false,
    });

    // 2. Fetch FCM Tokens for the user
    const tokensSnap = await db.ref(`users/${userId}/fcmTokens`).get();
    
    if (tokensSnap.exists()) {
      const tokens = Object.keys(tokensSnap.val());
      
      if (tokens.length > 0) {
        // 3. Send Push Notification via FCM
        await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: 'Edutrack360',
            body: message,
          },
          webpush: {
            fcmOptions: {
              link: link,
            },
            notification: {
              icon: '/icons/icon-192x192.png', // Optional: link to your app icon
              badge: '/icons/badge-72x72.png',
            }
          },
        });
      }
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
