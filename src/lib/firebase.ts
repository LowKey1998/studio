
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, push, set, serverTimestamp, get } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

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
 */
export const createNotification = async (userId: string, message: string, link: string) => {
  const notificationRef = push(ref(db, `notifications/${userId}`));
  await set(notificationRef, {
    message,
    link,
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


export { app, auth, db, storage, messaging };
