'use client';
import { db, auth } from './firebase';
import { ref, push, serverTimestamp } from 'firebase/database';

/**
 * Logs an error to the institutional error log in Firebase.
 * Captures user context and detailed metadata for debugging.
 */
export const logError = (message: string, category: string = 'General', details?: any) => {
    if (typeof window === 'undefined') return;
    try {
        const user = auth.currentUser;
        const errorRef = ref(db, 'errorLogs');
        push(errorRef, {
            message,
            category,
            details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
            timestamp: serverTimestamp(),
            userId: user?.uid || 'anonymous',
            userName: user?.displayName || 'Unknown',
        });
    } catch (e) {
        console.error("Failed to log error to Firebase:", e);
    }
};
