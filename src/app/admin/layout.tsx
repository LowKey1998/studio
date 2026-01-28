
"use client";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!userProfile) {
        router.replace('/login');
        return;
      }
      
      const role = userProfile.role?.toLowerCase();

      if (role === 'admin') {
        setIsAuthorized(true);
      } else if (role === 'staff' && userProfile.permissions?.[pathname]) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.replace('/dashboard');
      }
    }
  }, [userProfile, loading, router, pathname]);

  if (loading || isAuthorized === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!isAuthorized) {
    // While redirecting, show loader
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
}
