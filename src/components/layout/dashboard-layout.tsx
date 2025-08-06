
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
import type { UserProfile } from '@/hooks/use-auth';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, loading } = useAuth();
  const [menuItems, setMenuItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchUserRoleAndPermissions = async () => {
        if (user && userProfile) {
            if (userProfile.role === 'Admin') {
                setMenuItems(allMenuItems);
            } else if (userProfile.role === 'Student') {
                setMenuItems(studentMenuItems);
            } else if (userProfile.role === 'Staff') {
                const settingsRef = ref(db, 'settings/subRoles');
                const settingsSnap = await get(settingsRef);
                const subRolePermissions: Record<string, Record<string, boolean>> = settingsSnap.exists() ? settingsSnap.val() : {};

                let accessibleRoutes = new Set<string>();
                
                // Add base staff items (e.g., leave application for everyone)
                staffMenuItems.filter(item => item.roles.includes('*')).forEach(item => accessibleRoutes.add(item.href));

                // Add items specific to the user's sub-roles
                const userSubRoles = userProfile.subRoles || [];
                userSubRoles.forEach(subRoleName => {
                    const roleId = Object.keys(subRolePermissions).find(id => subRolePermissions[id].name === subRoleName);
                    if (roleId && subRolePermissions[roleId].permissions) {
                        Object.entries(subRolePermissions[roleId].permissions).forEach(([path, hasAccess]) => {
                            if (hasAccess) {
                                accessibleRoutes.add(path);
                            }
                        });
                    }
                });
                
                // Add items for the base "Lecturer" role if they have it
                 if(userSubRoles.includes('Lecturer')){
                    staffMenuItems.filter(item => item.roles.includes('Lecturer')).forEach(item => accessibleRoutes.add(item.href));
                }
                
                const finalItems = allMenuItems.filter(item => accessibleRoutes.has(item.href));
                setMenuItems(finalItems);
            }
        }
    };

    if (!loading && user) {
      fetchUserRoleAndPermissions();
    }
  }, [user, userProfile, loading]);



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
    if (loading || !userProfile) {
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
