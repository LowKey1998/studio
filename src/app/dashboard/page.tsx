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

            if (role === 'Admin') {
              router.replace('/admin/dashboard');
            } else if (role === 'Staff') {
              router.replace('/staff/courses');
            } else if (role === 'Student') {
              router.replace('/student/classes');
            } else {
              router.replace('/login');
            }
          } else {
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
