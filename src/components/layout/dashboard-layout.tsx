
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
import { allMenuItems, staffMenuItems, studentMenuItems } from '@/lib/menu-items';
import Logo from '../logo';

type UserData = {
    role: 'Admin' | 'Staff' | 'Student';
    subRoles?: string[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [userData, setUserData] = React.useState<UserData | null>(null);
  const [menuItems, setMenuItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
        if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                const data = snapshot.val() as UserData;
                setUserData(data);

                if (data.role === 'Admin') {
                    setMenuItems(allMenuItems);
                } else if (data.role === 'Student') {
                    setMenuItems(studentMenuItems);
                } else if (data.role === 'Staff') {
                     // Start with base staff items (e.g., leave application for everyone)
                    const baseItems = staffMenuItems.filter(item => item.roles.includes('*'));

                    // Add items specific to the user's sub-roles
                    const userSubRoles = data.subRoles || [];
                    const subRoleItems = staffMenuItems.filter(item => 
                        item.roles.some(role => userSubRoles.includes(role))
                    );
                    
                    // Also include items for the base "Lecturer" role if they have it
                     if(userSubRoles.includes('Lecturer')){
                        const lecturerItems = staffMenuItems.filter(item => item.roles.includes('Lecturer'));
                        subRoleItems.push(...lecturerItems);
                    }
                    
                    const finalItems = [...baseItems, ...subRoleItems];
                    const uniqueItems = Array.from(new Set(finalItems.map(item => item.href)))
                                          .map(href => finalItems.find(item => item.href === href));

                    setMenuItems(uniqueItems as any[]);
                }
            }
        }
    };

    if (!loading && user) {
      fetchUserRoleAndPermissions();
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
    if (loading || !userData) {
        return Array.from({length: 8}).map((_, i) => <SidebarMenuItem key={i}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)
    }

    return menuItems.map((item) => (
      <SidebarMenuItem key={item.href}>
        <Link href={item.href}>
          <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
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
          <Logo />
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
