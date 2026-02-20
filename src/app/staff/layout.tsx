
"use client";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !['staff', 'admin'].includes(userProfile?.role?.toLowerCase() ?? '')) {
      router.replace('/dashboard');
    }
  }, [userProfile, loading, router]);

  if (loading || !['staff', 'admin'].includes(userProfile?.role?.toLowerCase() ?? '')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Using user.uid as a key ensures the entire layout and sub-tree 
  // is destroyed and recreated when switching accounts, clearing any stale cache.
  return <DashboardLayout key={user?.uid}>{children}</DashboardLayout>;
}
