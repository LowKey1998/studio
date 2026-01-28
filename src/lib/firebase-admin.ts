
import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  // Safely handle the private key formatting
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  const cert = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey,
  };

  // Check if essential credentials are provided
  if (!cert.projectId || !cert.clientEmail || !cert.privateKey) {
    console.error("Firebase Admin SDK credentials are not fully configured. Some server-side features may not work.");
  }

  return initializeApp({
    credential: credential.cert(cert),
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
}

export const adminApp = getAdminApp();
