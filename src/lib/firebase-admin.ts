import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

/**
 * Initializes and retrieves the Firebase Admin SDK app instance.
 * Returns null if the required environment variables are not configured.
 */
function getAdminApp(): App | null {
  try {
    if (getApps().length > 0) {
      return getApp();
    }

    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    // Return null if credentials are not provided to prevent module-level crashes
    if (!privateKey || !clientEmail || !projectId) {
      console.warn("Firebase Admin SDK credentials are not fully configured. Server-side push notifications are disabled.");
      return null;
    }

    return initializeApp({
      credential: credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

export const adminApp = getAdminApp();
