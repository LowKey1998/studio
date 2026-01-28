'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Loader2 } from 'lucide-react';
import type { SubRole } from '@/hooks/use-auth';

const desanitizeKey = (key: string) => key.replace(/\|/g, '/');

export default function DashboardRedirectPage() {
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const role = userData.role?.toLowerCase();

            switch (role) {
                case 'admin':
                    router.replace('/admin/dashboard');
                    break;
                case 'staff':
                    let hasDashboardAccess = false;
                    let isLecturer = false;

                    const settingsRef = ref(db, 'settings/subRoles');
                    const settingsSnapshot = await get(settingsRef);
                    const allSubRoles = settingsSnapshot.exists() ? settingsSnapshot.val() : {};

                    if (userData.subRoles) {
                        for (const subRoleId of userData.subRoles) {
                            const roleData = allSubRoles[subRoleId];
                            if (roleData) {
                                if (roleData.name === 'Lecturer') {
                                    isLecturer = true;
                                }
                                if (roleData.permissions) {
                                    for(const key in roleData.permissions) {
                                       const desanitizedKey = desanitizeKey(key);
                                       if (desanitizedKey === '/admin/dashboard' && roleData.permissions[key]) {
                                           hasDashboardAccess = true;
                                       }
                                    }
                                }
                            }
                        }
                    }
                    
                    if (hasDashboardAccess) {
                        router.replace('/admin/dashboard');
                    } else if (isLecturer) {
                        router.replace('/staff/courses');
                    } else {
                        router.replace('/staff/profile');
                    }
                    break;
                case 'student':
                    router.replace('/student/dashboard');
                    break;
                default:
                    router.replace('/login');
                    break;
            }
          } else {
            // If no user data in DB, sign out and redirect to login
            await auth.signOut();
            router.replace('/login');
          }
        } catch (error) {
            console.error("Failed to fetch user role, redirecting to login.", error);
            router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="ml-4">Loading your dashboard...</p>
    </div>
  );
}
