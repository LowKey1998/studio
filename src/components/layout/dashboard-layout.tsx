
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
  SidebarInput,
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
import { allMenuItems, staffBaseMenuItems, studentMenuItems } from '@/lib/menu-items';
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
  const [search, setSearch] = React.useState('');
  const [openAccordion, setOpenAccordion] = React.useState<string[]>([]);
  
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
  
  React.useEffect(() => {
    if (loading || !userProfile) return;
    
    let menu;
    if (userProfile.role.toLowerCase() === 'admin') {
      menu = allMenuItems;
    } else if (userProfile.role.toLowerCase() === 'student') {
      menu = studentMenuItems;
    } else if (userProfile.role.toLowerCase() === 'staff') {
        const staffPermissions = userProfile.permissions || {};
        
        const baseMenu = staffBaseMenuItems.map(category => {
            if (!category.items) return category;
            const filteredSubItems = category.items.filter(subItem => {
                 if (!subItem.permission) return true;
                 if(typeof subItem.permission === 'string' && subItem.permission.startsWith('/')) {
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
            if (!baseCategories.has(category.label)) {
                combinedMenu.push(category);
            }
        });

        menu = combinedMenu;
    } else {
        menu = [];
    }

    const activeCategory = menu.find(item => item.items?.some((sub: any) => pathname.startsWith(sub.href)))?.label;
    if(activeCategory) {
        setOpenAccordion([activeCategory]);
    }
  }, [pathname, loading, userProfile]);

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
        
        const baseMenu = staffBaseMenuItems.map(category => {
            if (!category.items) return category;
            const filteredSubItems = category.items.filter(subItem => {
                 if (!subItem.permission) return true;
                 if(typeof subItem.permission === 'string' && subItem.permission.startsWith('/')) {
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
            if (!baseCategories.has(category.label)) {
                combinedMenu.push(category);
            }
        });

        itemsToRender = combinedMenu;
    }

    const filteredItems = itemsToRender
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
                if (item.isComingSoon) {
                    return (
                        <div key={item.label} className="px-2 py-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                                <span className="ml-auto text-xs font-medium text-muted-foreground/70">Soon</span>
                            </div>
                        </div>
                    )
                }
                if(item.items && item.items.length > 0) {
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
                                            <Link href={subItem.isPremium ? '#' : subItem.href} onClick={() => setOpenAccordion([])}>
                                                <SidebarMenuButton 
                                                    isActive={pathname.startsWith(subItem.href)}
                                                    disabled={subItem.isPremium}
                                                >
                                                    {subItem.icon && <subItem.icon />}
                                                    <span>{subItem.label}</span>
                                                    {subItem.isPremium && <span className="ml-auto text-xs font-bold text-yellow-500 bg-yellow-500/20 px-1.5 py-0.5 rounded-full">Premium</span>}
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
      <div className="flex min-h-screen w-full">
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
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="p-4 sm:p-6 flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

    