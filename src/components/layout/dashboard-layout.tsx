
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
import { allMenuItems, studentMenuItems } from '@/lib/menu-items';
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
    
    let itemsToRender: any[] = [];
    
    if (userProfile.role === 'Admin') {
      itemsToRender = allMenuItems;
    } else if (userProfile.role === 'Student') {
      itemsToRender = studentMenuItems;
    } else if (userProfile.role === 'Staff') {
        const staffBaseMenu = [
            { href: '/staff/courses', label: 'My Courses', icon: Library, roles: ['Lecturer'] },
            { href: '/staff/leave-approvals', label: 'Student Absences', icon: UserCheck, roles: ['Lecturer']},
            { href: '/staff/timetable', label: 'My Timetable', icon: Calendar, roles: ['Lecturer'] },
            { href: '/staff/leave', label: 'My Leave', icon: Calendar, roles: ['*'] },
        ];

        const accessibleAdminRoutes = new Set<string>();
        allMenuItems.forEach(item => {
            if (item.roles && userProfile.subRoles?.some(subRole => item.roles.includes(subRole))) {
                accessibleAdminRoutes.add(item.href);
            }
        });

        const additionalMenuItems = allMenuItems.filter(item => accessibleAdminRoutes.has(item.href));
        const userStaffMenu = staffBaseMenu.filter(item => userProfile.subRoles?.includes(item.roles[0]) || item.roles[0] === '*');

        itemsToRender = [...userStaffMenu, ...additionalMenuItems];

        // Remove duplicates
        itemsToRender = itemsToRender.filter((item, index, self) =>
            index === self.findIndex((t) => (
                t.href === item.href
            ))
        );
    }

    return itemsToRender.map((item) => (
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
