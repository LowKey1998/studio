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
  useSidebar,
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth, UserProfile } from '@/hooks/use-auth';
import { get, ref, onValue, update, serverTimestamp, onDisconnect } from 'firebase/database';
import { Skeleton } from '../ui/skeleton';
import { allMenuItems, studentMenuItems } from '@/lib/menu-items';
import Logo from '../logo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Badge } from '../ui/badge';

const hasStaffPermission = (item: any, profile: UserProfile) => {
    if (!profile) return false;

    const baseStaffHrefs = new Set([
        '/staff/profile',
        '/staff/leave',
        '/staff/onboarding',
        '/staff/calendar',
        '/staff/library',
    ]);

    if (baseStaffHrefs.has(item.href)) return true;
    if (profile.permissions?.[item.href]) return true;
    if (item.permission && profile.subRoleNames?.some(name => name.toLowerCase() === item.permission.toLowerCase())) {
        return true;
    }
    
    return false;
};

/**
 * Handles closing the mobile sidebar automatically when navigation occurs.
 */
function SidebarMobileManager() {
  const { setOpenMobile, isMobile, openMobile } = useSidebar();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile, openMobile]);

  return null;
}

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
  const [notificationCounts, setNotificationCounts] = React.useState<Record<string, number>>({
      pendingRegistrations: 0
  });
  
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
        setNotificationCounts(prev => ({ ...prev, pendingRegistrations: pendingCount }));
    });
    return () => unsub();
  }, []);

  const menuItems = React.useMemo(() => {
    if (!userProfile?.role) return [];

    switch (userProfile.role.toLowerCase()) {
      case 'admin':
        return allMenuItems;
      case 'student':
        return studentMenuItems;
      case 'staff': {
            return allMenuItems.map(category => {
                if (!category.items || category.isComingSoon) return null;
                const permittedItems = category.items.filter(item => hasStaffPermission(item, userProfile));
                if (permittedItems.length > 0) {
                    return { ...category, items: permittedItems };
                }
                return null;
            }).filter(Boolean) as typeof allMenuItems;
        }
      default:
        return [];
    }
  }, [userProfile]);

  React.useEffect(() => {
    if (loading || !menuItems.length) return;
    const activeCategory = menuItems.find(item => item.items?.some((sub: any) => pathname.startsWith(sub.href)))?.label;
    if(activeCategory && !openAccordion.includes(activeCategory)) {
        setOpenAccordion(prev => [...new Set([...prev, activeCategory!])]);
    }
  }, [pathname, menuItems, loading]);

  const renderMenu = () => {
    if (loading) {
        return <div className="space-y-2">{Array.from({length: 8}).map((_, i) => <SidebarMenuItem key={i}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)}</div>
    }

    const filteredItems = menuItems
      .map(category => {
        if (!category) return null;
        let categoryItems = category.items || [];
        if (search.trim()) {
             const searchLower = search.toLowerCase();
             if(category.label.toLowerCase().includes(searchLower)) {
             } else if (category.items) {
                 categoryItems = category.items.filter((subItem: any) =>
                    subItem.label.toLowerCase().includes(searchLower)
                 );
             } else {
                 return null;
             }
        }
        if (categoryItems.length === 0 && search.trim() && !category.label.toLowerCase().includes(search.toLowerCase())) return null;
        return {...category, items: categoryItems};
      })
      .filter(Boolean);

    const defaultOpen = search ? filteredItems.map(item => item?.label) : openAccordion;
    
    return (
        <Accordion type="multiple" value={defaultOpen as string[]} onValueChange={setOpenAccordion} className="w-full">
            {filteredItems.map((item) => {
                if (!item || !item.items) return null;
                const categoryTotalNotifications = item.items.reduce((sum, sub) => {
                    const key = sub.notificationKey;
                    return sum + (key ? (notificationCounts[key] || 0) : 0);
                }, 0);

                return (
                    <AccordionItem value={item.label} key={item.label} className="border-none">
                        <AccordionTrigger className="hover:no-underline hover:bg-sidebar-accent rounded-md px-2 py-1.5 text-sm">
                            <div className="flex items-center gap-2 w-full pr-2">
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="flex-1 text-left">{item.label}</span>
                                {categoryTotalNotifications > 0 && (
                                    <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold rounded-full">
                                        {categoryTotalNotifications}
                                    </Badge>
                                )}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                             <SidebarMenu>
                                {item.items.map((subItem: any) => {
                                    const subCount = subItem.notificationKey ? (notificationCounts[subItem.notificationKey] || 0) : 0;
                                    return (
                                        <SidebarMenuItem key={subItem.href}>
                                            <Link href={subItem.href}>
                                                <SidebarMenuButton isActive={pathname.startsWith(subItem.href)}>
                                                    {subItem.icon && <subItem.icon />}
                                                    <span className="flex-1">{subItem.label}</span>
                                                    {subCount > 0 && (
                                                        <Badge variant="destructive" className="h-4 min-w-4 flex items-center justify-center p-0 text-[9px] font-bold rounded-full">
                                                            {subCount}
                                                        </Badge>
                                                    )}
                                                </SidebarMenuButton>
                                            </Link>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
    )
  }

  return (
    <SidebarProvider>
      <SidebarMobileManager />
      <div className="flex h-screen w-full overflow-hidden">
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
        <div className='flex flex-1 flex-col overflow-hidden'>
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
