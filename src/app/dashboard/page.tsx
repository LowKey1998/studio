'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();

  React.useEffect(() => {
    if (loading) {
      return; // Wait until auth state is resolved
    }

    if (!userProfile) {
      router.replace('/login');
      return;
    }

    const role = userProfile.role?.toLowerCase();

    switch (role) {
      case 'admin':
        router.replace('/admin/dashboard');
        break;
      case 'student':
        router.replace('/student/dashboard');
        break;
      case 'staff':
        // Check for dashboard access first, otherwise go to profile
        if (userProfile.permissions?.['/admin/dashboard']) {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/staff/profile');
        }
        break;
      default:
        router.replace('/login');
        break;
    }

  }, [userProfile, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="ml-4">Loading your dashboard...</p>
    </div>
  );
}
