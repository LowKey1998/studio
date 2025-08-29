
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Loader2 } from 'lucide-react';

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
            const role = userData.role;

            // Clear redirection logic
            switch (role) {
                case 'Admin':
                    router.replace('/admin/dashboard');
                    break;
                case 'Staff':
                    router.replace('/staff/courses');
                    break;
                case 'Student':
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
