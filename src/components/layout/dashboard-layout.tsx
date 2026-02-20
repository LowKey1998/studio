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
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { LogOut, ShieldAlert, AlertTriangle, Info, Calendar, UserCheck, BookOpen, DollarSign, BookOpenCheck, GanttChart, Clock, ChevronRight, LayoutDashboard, Settings } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { addDays, isAfter, parseISO } from 'date-fns';

const warningKeys = new Set(['missingDeadlines', 'unassignedCourses']);

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

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

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
  const [isDefaulter, setIsDefaulter] = React.useState(false);
  const [financialSettings, setFinancialSettings] = React.useState<any>(null);
  const [notificationCounts, setNotificationCounts] = React.useState<Record<string, number>>({
      pendingRegistrations: 0,
      missingDeadlines: 0,
      unassignedCourses: 0
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
    if (!user || !userProfile) return;

    const refs = {
        regs: ref(db, 'registrations'),
        sems: ref(db, 'semesters'),
        events: ref(db, 'calendarEvents'),
        plans: ref(db, 'settings/paymentPlans'),
        courses: ref(db, 'courses'),
        fin: ref(db, 'settings/financialSettings'),
        cal: ref(db, 'settings/academicCalendar'),
        intakes: ref(db, 'intakes'),
        tx: ref(db, 'transactions'),
        inv: ref(db, `invoices/${user.uid}`)
    };

    const unsubRegs = onValue(refs.regs, (snapshot) => {
        let pendingCount = 0;
        if (snapshot.exists()) {
            const allRegistrations = snapshot.val();
            for (const uid in allRegistrations) {
                for (const semesterId in allRegistrations[uid]) {
                    if (allRegistrations[uid][semesterId].status === 'Pending Approval') {
                        pendingCount++;
                    }
                }
            }
        }
        setNotificationCounts(prev => ({ ...prev, pendingRegistrations: pendingCount }));
    });

    const unsubSems = onValue(refs.sems, (snapshot) => {
        get(refs.events).then(eSnap => {
            get(refs.plans).then(pSnap => {
                let missingCount = 0;
                if (snapshot.exists()) {
                    const sems = snapshot.val();
                    const events = Object.values(eSnap.val() || {}) as any[];
                    const plans = pSnap.val() || {};

                    Object.values(sems).forEach((sem: any) => {
                        if (sem.status === 'Archived') return;
                        
                        const linkedPlanIds = Object.keys(sem.paymentPlanIds || {});
                        linkedPlanIds.forEach(pid => {
                            const plan = plans[pid];
                            if (plan && !plan.archived) {
                                for (let i = 0; i < plan.installments; i++) {
                                    const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${sem.name}`;
                                    const eventExists = events.some(e => e.title?.trim() === title.trim());
                                    if (!eventExists) {
                                        missingCount++;
                                        return; 
                                    }
                                }
                            }
                        });
                    });
                }
                setNotificationCounts(prev => ({ ...prev, missingDeadlines: missingCount }));
            });
        });
    });

    const unsubCourses = onValue(refs.courses, (snapshot) => {
        let unassignedCount = 0;
        if (snapshot.exists()) {
            Object.values(snapshot.val()).forEach((c: any) => {
                if (c.status === 'active' && !c.lecturerId && (!c.lecturerIds || c.lecturerIds.length === 0)) {
                    unassignedCount++;
                }
            });
        }
        setNotificationCounts(prev => ({ ...prev, unassignedCourses: unassignedCount }));
    });

    const unsubFin = onValue(refs.fin, (snapshot) => {
        setFinancialSettings(snapshot.val());
    });

    if (userProfile.role === 'Student') {
        const checkFinancialStanding = async () => {
            const [regSnap, txSnap, invSnap, semSnap, calSnap, eventsSnap, plansSnap, intakeSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'transactions')),
                get(ref(db, `invoices/${user.uid}`)),
                get(refs.sems),
                get(refs.cal),
                get(refs.events),
                get(refs.plans),
                get(refs.intakes)
            ]);

            if (!regSnap.exists() || !calSnap.exists() || !intakeSnap.exists()) return;

            const intake = intakeSnap.val()[userProfile.intakeId];
            const intakeStart = parseIntakeDate(intake?.name);
            if (!intakeStart) return;

            const standing = calculateAcademicState(
                intakeStart,
                new Date(),
                calSnap.val().standardCycles,
                Object.values(calSnap.val().anomalies || {})
            );

            const activeSemesterEntry = Object.entries(semSnap.val() || {}).find(([_, s]: [string, any]) => 
                s.intakeId === userProfile.intakeId && s.year === standing.year && s.semesterInYear === standing.semester
            );

            if (!activeSemesterEntry) return;
            const [semId, semData] = activeSemesterEntry as [string, any];
            const reg = regSnap.val()[semId];
            const invoice = invSnap.val()?.[reg?.invoiceId];

            if (!reg || !invoice) return;

            const totalDue = (Number(invoice.totalTuition) || 0) + (Number(invoice.totalMandatoryFees) || 0) + (Number(invoice.totalOptionalFees) || 0) + (invoice.lateFee || 0) - (invoice.applyScholarship ? (Number(invoice.totalTuition) || 0) : 0);
            const totalPaid = Object.values(txSnap.val() || {}).filter((t: any) => t.userId === user.uid && t.invoiceId === reg.invoiceId && t.status === 'successful').reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
            
            const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;
            const globalThreshold = (await get(refs.fin)).val()?.paymentThreshold || 75;
            const threshold = semData.paymentThreshold || globalThreshold;
            const grace = semData.gracePeriodDays || 0;

            const calendarEvents = Object.values(eventsSnap.val() || {}) as any[];
            const semDeadlines = calendarEvents.filter(ev => ev.semester === semData.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
            const passedDeadlines = semDeadlines.filter(ev => isAfter(new Date(), addDays(parseISO(ev.date), grace)));
            
            if (passedDeadlines.length > 0 && paidPercentage < threshold) {
                setIsDefaulter(true);
            } else {
                setIsDefaulter(false);
            }
        };
        checkFinancialStanding();
    }

    return () => {
        unsubRegs();
        unsubSems();
        unsubCourses();
        unsubFin();
    };
  }, [user, userProfile]);

  const menuItems = React.useMemo(() => {
    if (!userProfile?.role) return [];

    switch (userProfile.role.toLowerCase()) {
      case 'admin':
        return allMenuItems;
      case 'student': {
        if (isDefaulter && financialSettings?.defaulterRestrictions?.sidebar) {
            const restrictedCategories = financialSettings.defaulterRestrictions.sidebar;
            return studentMenuItems.filter(category => {
                if (category.label === 'Finances' || category.label === 'Communications') return true;
                return !restrictedCategories[category.label];
            });
        }
        return studentMenuItems;
      }
      case 'staff': {
            return allMenuItems.map(category => {
                if (!category.items) return null;
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
  }, [userProfile, isDefaulter, financialSettings]);

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
                                    const isWarning = subItem.notificationKey && warningKeys.has(subItem.notificationKey);
                                    
                                    return (
                                        <SidebarMenuItem key={subItem.href}>
                                            <Link href={subItem.href}>
                                                <SidebarMenuButton isActive={pathname.startsWith(subItem.href)}>
                                                    {subItem.icon && <subItem.icon />}
                                                    <span className="flex-1">{subItem.label}</span>
                                                    {subCount > 0 && (
                                                        <Badge 
                                                            variant={isWarning ? "secondary" : "destructive"} 
                                                            className={cn(
                                                                "h-4 min-w-4 flex items-center justify-center p-0 text-[9px] font-bold rounded-full",
                                                                isWarning && "bg-orange-500 text-white hover:bg-orange-600"
                                                            )}
                                                        >
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
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar className="border-r shadow-xl">
          <SidebarHeader className="border-b pb-4 pt-6">
            <div className="flex items-center justify-between w-full">
                <Logo />
            </div>
          </SidebarHeader>
          <div className="flex flex-col p-4">
              <SidebarInput placeholder="Search navigation..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-muted/50 border-0" />
          </div>
          <SidebarContent className="px-2">
            {isDefaulter && (
                <div className="px-4 py-3 mb-2 bg-destructive/10 border-2 border-destructive/20 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 text-destructive mb-1">
                        <ShieldAlert className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Standing Alert</span>
                    </div>
                    <p className="text-[9px] text-destructive leading-tight font-bold opacity-80">Access restricted due to outstanding balance.</p>
                </div>
            )}
            <SidebarMenu>
              {renderMenu()}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t p-4 bg-muted/5">
              <SidebarMenu>
                  <SidebarMenuItem>
                      <SidebarMenuButton onClick={handleLogout} className="h-12 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all">
                          <LogOut className="h-5 w-5" />
                          <span className="font-bold">Log out</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className='flex flex-1 flex-col overflow-hidden bg-background'>
          <Header />
          <main className="flex-1 overflow-y-auto relative">
              <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                {children}
              </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
