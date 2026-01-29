
"use client";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
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
  
  return <DashboardLayout>{children}</DashboardLayout>;
}
