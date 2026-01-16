
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  role: 'Admin' | 'Staff' | 'Student';
  subRoles?: string[];
  permissions?: Record<string, boolean>; // Aggregated permissions
  isOnline?: boolean;
  lastSeen?: number;
} | null;

export type SubRole = {
  name: string;
  permissions: Record<string, boolean>;
};

// Firebase keys cannot contain '.', '#', '$', '[', ']', or '/'.
// We replace '/' with a safe character.
const desanitizeKey = (key: string) => key.replace(/\|/g, '/');


export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (authUser) {
        const userRef = ref(db, `users/${authUser.uid}`);
        const settingsRef = ref(db, 'settings/subRoles');
        
        onValue(userRef, async (userSnapshot) => {
            if(userSnapshot.exists()){
                const profileData = userSnapshot.val();
                let aggregatedPermissions: Record<string, boolean> = {};

                // If user is staff and has sub-roles, aggregate permissions
                if (profileData.role === 'Staff' && profileData.subRoles) {
                    const settingsSnapshot = await get(settingsRef);
                    if (settingsSnapshot.exists()) {
                        const allSubRoles: Record<string, SubRole> = settingsSnapshot.val();
                        const userSubRoleIds = profileData.subRoles || [];
                        
                        // Match user's sub-role IDs with the sub-roles in settings
                        userSubRoleIds.forEach((userSubRoleId: string) => {
                            const matchingRole = allSubRoles[userSubRoleId];
                            if (matchingRole && matchingRole.permissions) {
                                for(const key in matchingRole.permissions) {
                                   aggregatedPermissions[desanitizeKey(key)] = matchingRole.permissions[key];
                                }
                            }
                        });
                    }
                }

                setUserProfile({ uid: authUser.uid, ...profileData, permissions: aggregatedPermissions });
            } else {
                setUserProfile(null);
            }
             setLoading(false);
        }, (error) => {
            console.error(error);
            setUserProfile(null);
            setLoading(false);
        });

      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, loading };
}
