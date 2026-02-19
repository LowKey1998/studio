'use server';

import { adminApp } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Helper to fetch the institution logo URL for notification icons.
 */
async function getInstitutionLogo() {
  try {
    const db = getDatabase(adminApp);
    const snap = await db.ref('settings/institution/logoUrl').get();
    // Default system icon if no logo is configured
    return snap.val() || '/icons/icon-192x192.png';
  } catch (e) {
    return '/icons/icon-192x192.png';
  }
}

/**
 * Subscribes a device token to user-specific and broadcast topics.
 */
export async function subscribeToUserTopics(token: string, userId: string) {
  try {
    const messaging = getMessaging(adminApp);
    
    // Subscribe to personal UID topic for targeted notifications
    await messaging.subscribeToTopic(token, userId);
    
    // Subscribe to global broadcast topic for institution-wide alerts
    await messaging.subscribeToTopic(token, 'broadcast');
    
    return { success: true };
  } catch (error: any) {
    console.error("FCM Subscription Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a notification to one or more users via their UID topics.
 */
export async function sendNotification(userIdOrIds: string | string[], message: string, link: string, type: string = 'info', category: string = 'general') {
  try {
    const db = getDatabase(adminApp);
    const messaging = getMessaging(adminApp);
    const userIds = Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds];

    // Check system-wide notification rules
    const rulesSnap = await db.ref('settings/notificationRules').get();
    const rules = rulesSnap.exists() ? rulesSnap.val() : {};
    
    // Default to true if the rule isn't defined
    const isPushEnabled = rules[category] !== false;

    // Fetch the institution logo for the notification icon
    const iconUrl = await getInstitutionLogo();

    const tasks = userIds.map(async (userId) => {
      // 1. ALWAYS Add to Realtime Database for the in-app notification center history
      const notificationRef = db.ref(`notifications/${userId}`).push();
      await notificationRef.set({
        message,
        link,
        type,
        category,
        timestamp: Date.now(),
        read: false,
      });

      // 2. Conditionally Send Push Notification via Topic (UID) if category is enabled
      if (isPushEnabled) {
        try {
          await messaging.send({
            topic: userId,
            notification: {
              title: 'Edutrack360',
              body: message,
            },
            webpush: {
              fcmOptions: {
                link: link,
              },
              notification: {
                icon: iconUrl,
                badge: '/icons/badge-72x72.png',
              }
            },
          });
        } catch (fcmError) {
          console.warn(`FCM Push failed for user ${userId} (Category: ${category}):`, fcmError);
        }
      }
    });

    await Promise.all(tasks);
    return { success: true, count: userIds.length };
  } catch (error: any) {
    console.error("Failed to send notification(s):", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a push notification to the global 'broadcast' topic.
 */
export async function sendBroadcastNotification(message: string, link: string) {
  try {
    const messaging = getMessaging(adminApp);
    const iconUrl = await getInstitutionLogo();
    
    await messaging.send({
      topic: 'broadcast',
      notification: {
        title: 'Institutional Broadcast',
        body: message,
      },
      webpush: {
        fcmOptions: {
          link: link,
        },
        notification: {
          icon: iconUrl,
          badge: '/icons/badge-72x72.png',
        }
      },
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send broadcast:", error);
    return { success: false, error: error.message };
  }
}
