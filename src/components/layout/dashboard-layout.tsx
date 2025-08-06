
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
import { LogOut, User, UserX } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { get, ref } from 'firebase/database';
import { Skeleton } from '../ui/skeleton';
import { allMenuItems, studentMenuItems, staffBaseMenuItems } from '@/lib/menu-items';
import Logo from '../logo';
import type { UserProfile } from '@/hooks/use-auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';


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
    
    if (userProfile.role.toLowerCase() === 'admin') {
      itemsToRender = allMenuItems;
    } else if (userProfile.role.toLowerCase() === 'student') {
      itemsToRender = studentMenuItems;
    } else if (userProfile.role.toLowerCase() === 'staff') {
        const staffPermissions = userProfile.permissions || {};
        const allowedHrefs = Object.keys(staffPermissions).filter(key => staffPermissions[key]);
        
        const filteredAdminItems = allMenuItems.map(category => {
            if (!category.items) {
                // This handles top-level items that might not be in a category
                return allowedHrefs.includes(category.href) ? category : null;
            }
            
            const filteredSubItems = category.items.filter(subItem => allowedHrefs.includes(subItem.href));
            
            if (filteredSubItems.length > 0) {
                return { ...category, items: filteredSubItems };
            }
            
            return null;
        }).filter(Boolean); // Ensure no null values are in the array

        itemsToRender = [...staffBaseMenuItems, ...filteredAdminItems];
    }
    
    const defaultOpen = itemsToRender.find(item => item.items?.some((sub: any) => pathname.startsWith(sub.href)))?.label;
    
    return (
        <Accordion type="single" collapsible defaultValue={defaultOpen} className="w-full">
            {itemsToRender.map((item) => {
                if(item.items) {
                    return (
                        <AccordionItem value={item.label} key={item.label} className="border-none">
                            <AccordionTrigger className="hover:no-underline hover:bg-sidebar-accent rounded-md px-2 py-1.5 text-sm">
                                <div className="flex items-center gap-2">
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pl-4">
                                 <SidebarMenu>
                                    {item.items.map((subItem: any) => (
                                        <SidebarMenuItem key={subItem.href}>
                                            <Link href={subItem.href}>
                                            <SidebarMenuButton isActive={pathname.startsWith(subItem.href)}>
                                                {subItem.icon && <subItem.icon />}
                                                <span>{subItem.label}</span>
                                            </SidebarMenuButton>
                                            </Link>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </AccordionContent>
                        </AccordionItem>
                    )
                }
                // Render base menu items for staff that are not in a category
                 return (
                    <SidebarMenuItem key={item.href || item.label}>
                         <Link href={item.href}>
                        <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                            <item.icon />
                            <span>{item.label}</span>
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                );
            })}
        </Accordion>
    )
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
