
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
        // Check for dashboard access first
        if (userProfile.permissions?.['/admin/dashboard']) {
          router.replace('/admin/dashboard');
        } 
        // Then check if they are a lecturer
        else if (userProfile.permissions?.['canBeAssignedClass']) {
            router.replace('/staff/courses');
        }
        // Fallback for other staff roles (e.g., Accountant, HR)
        else {
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
