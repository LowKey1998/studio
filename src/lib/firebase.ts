import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, get, query, orderByChild, equalTo } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { sendNotification } from "@/app/actions/notifications";
import type { Notification } from "./types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FACEBOOK_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

/**
 * Creates a notification for a specific user or group of users using the server-side action.
 * This handles both database persistence and FCM push.
 */
export const createNotification = async (userIdOrIds: string | string[], message: string, link: string, type: Notification['type'] = 'info') => {
  return await sendNotification(userIdOrIds, message, link, type);
};

/**
 * Retrieves all user IDs for students and staff.
 */
export const getAllStudentAndStaffIds = async (): Promise<string[]> => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
        const users = snapshot.val();
        return Object.keys(users).filter(uid => users[uid].role === 'Student' || users[uid].role === 'Staff');
    }
    return [];
};

/**
 * Retrieves all registrar user IDs.
 */
export const getRegistrarIds = async (): Promise<string[]> => {
    const snapshot = await get(ref(db, 'users'));
    if (snapshot.exists()) {
        const users = snapshot.val();
        return Object.keys(users).filter(uid => 
            (users[uid].role === 'Admin') || 
            (users[uid].role === 'Staff' && users[uid].subRoles?.includes('Registrar'))
        );
    }
    return [];
}

export { app, auth, db, storage, messaging };
