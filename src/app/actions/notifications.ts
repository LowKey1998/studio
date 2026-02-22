'use server';

import { adminApp } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Helper to fetch the institution logo URL for notification icons.
 * Includes a safety timeout to prevent hanging the whole server action 
 * if there are connectivity issues with the database.
 */
async function getInstitutionLogo() {
  const fallback = 'https://picsum.photos/seed/edutrack/200';
  if (!adminApp) return fallback;

  try {
    const db = getDatabase(adminApp);
    const logoRef = db.ref('settings/institution/logoUrl');
    
    // 3-second timeout to prevent infinite spin in the UI
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    
    const snapshot: any = await Promise.race([
      logoRef.get(),
      timeout
    ]);

    if (!snapshot) {
      console.warn("[SERVER] Institution logo fetch timed out. Using fallback.");
      return fallback;
    }

    return snapshot.val() || fallback;
  } catch (e) {
    console.warn("[SERVER] Failed to fetch institution logo, using fallback:", e);
    return fallback;
  }
}

/**
 * Subscribes a device token to user-specific and broadcast topics.
 */
export async function subscribeToUserTopics(token: string, userId: string) {
  if (!adminApp) return { success: false, error: "Admin SDK not initialized" };
  
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
  if (!adminApp) {
    console.warn("[SERVER] Admin SDK not initialized. Recording notification to DB only.");
  }

  try {
    const userIds = Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds];
    const iconUrl = await getInstitutionLogo();

    const tasks = userIds.map(async (userId) => {
      // 1. ALWAYS Add to Realtime Database for the in-app notification center history
      if (adminApp) {
        const db = getDatabase(adminApp);
        const notificationRef = db.ref(`notifications/${userId}`).push();
        await notificationRef.set({
          message,
          link,
          type,
          category,
          timestamp: Date.now(),
          read: false,
        });

        // 2. Check system-wide notification rules for PUSH
        const rulesSnap = await db.ref('settings/notificationRules').get();
        const rules = rulesSnap.exists() ? rulesSnap.val() : {};
        const isPushEnabled = rules[category] !== false;

        if (isPushEnabled) {
          try {
            const messaging = getMessaging(adminApp);
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
            console.warn(`[SERVER] FCM Push failed for user ${userId}:`, fcmError);
          }
        }
      }
    });

    await Promise.all(tasks);
    return { success: true, count: userIds.length };
  } catch (error: any) {
    console.error("[SERVER] Failed to process notification(s):", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a push notification to the global 'broadcast' topic.
 * Also records the broadcast in the database for persistence.
 */
export async function sendBroadcastNotification(message: string, link: string) {
  console.log("[SERVER] Initiating broadcast notification send...");
  
  if (!adminApp) {
    console.error("[SERVER] Broadcast failed: Admin SDK not initialized.");
    return { 
      success: false, 
      error: "Firebase Admin SDK is not fully configured." 
    };
  }

  try {
    const db = getDatabase(adminApp);
    const messaging = getMessaging(adminApp);
    
    const iconUrl = await getInstitutionLogo();
    
    // 1. Record broadcast in database for history
    const broadcastRef = db.ref('broadcasts').push();
    await broadcastRef.set({
      message,
      link,
      timestamp: Date.now(),
      type: 'info',
      category: 'broadcast'
    });

    // 2. Send push notification to all subscribed devices
    const response = await messaging.send({
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
    console.error("[SERVER] Broadcast failed with error:", error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred while sending the broadcast." 
    };
  }
}
