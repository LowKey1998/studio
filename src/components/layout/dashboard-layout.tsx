
"use client";

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { get, ref } from 'firebase/database';
import { Skeleton } from '../ui/skeleton';
import { adminMenuItems, staffMenuItems, studentMenuItems } from '@/lib/menu-items';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchUserRole = async () => {
        if (user) {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const users = snapshot.val();
                const foundUser = Object.entries(users).find(([id, userData]: [string, any]) => userData.uid === user.uid);
                if(foundUser) {
                    const userRole = foundUser[1].role;
                    setRole(userRole);
                } else {
                    // If user is authenticated but not in DB, they might be mid-creation
                    // or it's an error state. For now, we wait.
                }
            }
        }
    };

    if (!loading && user) {
      fetchUserRole();
    }
  }, [user, loading]);



  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'An error occurred while logging out. Please try again.',
      });
    }
  };

  const renderMenu = () => {
    if (loading || !role) {
        return Array.from({length: 8}).map((_, i) => <SidebarMenuItem key={i}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)
    }

    const commonItems = [
        { href: '/profile', label: 'Profile', icon: User },
    ];
    
    let roleSpecificItems = [];
    switch(role) {
        case 'student':
            roleSpecificItems = studentMenuItems;
            break;
        case 'staff':
            roleSpecificItems = staffMenuItems;
            break;
        case 'admin':
            roleSpecificItems = adminMenuItems;
            break;
        default:
            roleSpecificItems = [];
    }


    return [...roleSpecificItems, ...commonItems].map((item) => (
      <SidebarMenuItem key={item.href}>
        <Link href={item.href}>
          <SidebarMenuButton isActive={pathname === item.href}>
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    ));
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <h1 className="text-2xl font-bold text-primary">EduTrack360</h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {renderMenu()}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                        <LogOut />
                        <span>Log out</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Header />
        <main className="p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
