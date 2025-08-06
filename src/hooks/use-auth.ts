
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
  permissions?: Record<string, boolean>; // Aggregated permissions
} | null;

export type SubRole = {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
};


export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
            const userRef = ref(db, `users/${user.uid}`);
            const settingsRef = ref(db, 'settings/subRoles');
            
            const [userSnapshot, settingsSnapshot] = await Promise.all([get(userRef), get(settingsRef)]);

            if(userSnapshot.exists()){
                const profileData = userSnapshot.val();
                let aggregatedPermissions: Record<string, boolean> = {};

                // If user is staff and has sub-roles, aggregate permissions
                if (profileData.role === 'Staff' && profileData.subRoles && settingsSnapshot.exists()) {
                    const allSubRoles: Record<string, SubRole> = settingsSnapshot.val();
                    const userSubRoleNames = profileData.subRoles || [];
                    
                    Object.values(allSubRoles).forEach(roleDetail => {
                        if (userSubRoleNames.includes(roleDetail.name)) {
                            aggregatedPermissions = { ...aggregatedPermissions, ...roleDetail.permissions };
                        }
                    });
                }

                setUserProfile({ uid: user.uid, ...profileData, permissions: aggregatedPermissions });
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
