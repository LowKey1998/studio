
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
  SidebarInput,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { get, ref, onValue, update, serverTimestamp, onDisconnect } from 'firebase/database';
import { Skeleton } from '../ui/skeleton';
import { allMenuItems, staffBaseMenuItems, studentMenuItems } from '@/lib/menu-items';
import Logo from '../logo';
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
  const [search, setSearch] = React.useState('');
  const [openAccordion, setOpenAccordion] = React.useState<string[]>([]);
  const [notificationCounts, setNotificationCounts] = React.useState<Record<string, number>>({});
  
  const handleLogout = async () => {
    try {
      if (user) {
        await update(ref(db, `users/${user.uid}`), { isOnline: false, lastSeen: serverTimestamp() });
      }
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

  // Set up Firebase presence
  React.useEffect(() => {
    if (!user) return;

    const userStatusRef = ref(db, `users/${user.uid}`);
    const isOfflineForDatabase = {
      isOnline: false,
      lastSeen: serverTimestamp(),
    };
    const isOnlineForDatabase = {
      isOnline: true,
      lastSeen: serverTimestamp(),
    };

    const connectedRef = ref(db, '.info/connected');
    const unsub = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).update(isOfflineForDatabase).then(() => {
                update(userStatusRef, isOnlineForDatabase);
            });
        }
    });

    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    const registrationsRef = ref(db, 'registrations');
    const unsub = onValue(registrationsRef, (snapshot) => {
        let pendingCount = 0;
        if (snapshot.exists()) {
            const allRegistrations = snapshot.val();
            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    if (allRegistrations[userId][semesterId].status === 'Pending Approval') {
                        pendingCount++;
                    }
                }
            }
        }
        setNotificationCounts(prev => ({...prev, pendingRegistrations: pendingCount }));
    });
    return () => unsub();
  }, []);

  const menuItems = React.useMemo(() => {
    if (!userProfile || !userProfile.role) {
      return [];
    }
    if (userProfile.role.toLowerCase() === 'admin') {
      return allMenuItems;
    }
    if (userProfile.role.toLowerCase() === 'student') {
      return studentMenuItems;
    }
    if (userProfile.role.toLowerCase() === 'staff') {
      const staffPermissions = userProfile.permissions || {};
      const baseMenu = staffBaseMenuItems.map(category => {
        if (!category.items) return category;
        const filteredSubItems = category.items.filter(subItem => {
          if (!subItem.permission) return true;
          if (typeof subItem.permission === 'string' && subItem.permission.startsWith('/')) {
            return !!staffPermissions[subItem.permission];
          }
          return userProfile.subRoles?.includes(subItem.permission);
        });
        if (filteredSubItems.length > 0) {
          return { ...category, items: filteredSubItems };
        }
        return null;
      }).filter(Boolean) as any[];

      const additionalMenu = allMenuItems.map(category => {
        if (!category.items) return null;
        const permittedSubItems = category.items.filter(subItem => staffPermissions[subItem.href]);
        if (permittedSubItems.length > 0) {
          return { ...category, items: permittedSubItems };
        }
        return null;
      }).filter(Boolean);

      const combinedMenu = [...baseMenu];
      const baseCategories = new Set(baseMenu.map(c => c.label));
      additionalMenu.forEach(category => {
        if (category && !baseCategories.has(category.label)) {
          combinedMenu.push(category);
        }
      });
      return combinedMenu;
    }
    return [];
  }, [userProfile]);
  
  React.useEffect(() => {
    if (loading || !menuItems.length) return;

    const activeCategory = menuItems.find(item => item.items?.some((sub: any) => pathname.startsWith(sub.href)))?.label;
    if(activeCategory && !openAccordion.includes(activeCategory)) {
        setOpenAccordion(prev => [...new Set([...prev, activeCategory!])]);
    }
  // This dependency array is intentionally limited to avoid re-running on every accordion change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, menuItems, loading]);

  const renderMenu = () => {
    if (loading) {
        return <div className="space-y-2">{Array.from({length: 8}).map((_, i) => <SidebarMenuItem key={i}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)}</div>
    }

    const filteredItems = menuItems
      .map(category => {
        if (!search.trim()) {
          return category;
        }
        
        const searchLower = search.toLowerCase();

        const matchingSubItems = category.items?.filter((subItem: any) =>
          subItem.label.toLowerCase().includes(searchLower)
        );

        if (category.label.toLowerCase().includes(searchLower) || (matchingSubItems && matchingSubItems.length > 0)) {
            return {
                ...category,
                items: category.label.toLowerCase().includes(searchLower) ? category.items : matchingSubItems
            };
        }

        return null;
      })
      .filter(Boolean);

    const defaultOpen = search ? filteredItems.map(item => item?.label) : openAccordion;
    
    return (
        <Accordion type="multiple" value={defaultOpen as string[]} onValueChange={setOpenAccordion} className="w-full">
            {filteredItems.map((item) => {
                if (!item) return null;
                if (item.items && item.items.length > 0) {
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
                                            <Link href={subItem.href} onClick={() => setOpenAccordion([])}>
                                                <SidebarMenuButton 
                                                    isActive={pathname.startsWith(subItem.href)}
                                                >
                                                    {subItem.icon && <subItem.icon />}
                                                    <span>{subItem.label}</span>
                                                     {subItem.notificationKey && notificationCounts[subItem.notificationKey] > 0 && (
                                                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                                            {notificationCounts[subItem.notificationKey]}
                                                        </span>
                                                    )}
                                                </SidebarMenuButton>
                                            </Link>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </AccordionContent>
                        </AccordionItem>
                    )
                }
                 return null;
            })}
        </Accordion>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <div className="flex flex-col p-2">
              <SidebarInput placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
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
        <div className='flex flex-1 flex-col'>
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
