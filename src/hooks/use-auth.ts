
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  role: 'Admin' | 'Staff' | 'Student';
  subRoles?: string[];
} | null;


export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        try {
            const snapshot = await get(userRef);
            if(snapshot.exists()){
                setUserProfile({ uid: user.uid, ...snapshot.val() });
            } else {
                setUserProfile(null);
            }
        } catch (e) {
            console.error(e);
            setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, loading };
}
