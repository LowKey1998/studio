

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, push, set, serverTimestamp, get, query, orderByChild, equalTo } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import type { Notification } from "./types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
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
 * Creates a notification for a specific user.
 * @param userId - The UID of the user to notify.
 * @param message - The notification message.
 * @param link - The URL the notification should link to.
 * @param type - The type of notification for styling.
 */
export const createNotification = async (userId: string, message: string, link: string, type: Notification['type'] = 'info') => {
  const notificationRef = push(ref(db, `notifications/${userId}`));
  await set(notificationRef, {
    message,
    link,
    type,
    timestamp: serverTimestamp(),
    read: false,
  });
};

/**
 * Retrieves all user IDs for students and staff.
 * @returns A promise that resolves to an array of user IDs.
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
 * @returns A promise that resolves to an array of user IDs.
 */
export const getRegistrarIds = async (): Promise<string[]> => {
    const usersRef = ref(db, 'users');
    const q = query(usersRef, orderByChild('subRoles/Registrar'), equalTo(true));
    
    // A more robust way would be to fetch all staff and filter,
    // as Realtime DB querying on arrays is limited.
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

