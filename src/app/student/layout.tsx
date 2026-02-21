"use client";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ArrowRight, Wallet, ShieldX } from "lucide-react";
import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { calculateAcademicState, parseIntakeDate } from "@/lib/semester-utils";
import { addDays, isAfter, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { studentMenuItems } from "@/lib/menu-items";
import { Badge } from "@/components/ui/badge";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isDefaulter, setIsDefaulter] = useState(false);
  const [isRestrictedRoute, setIsRestrictedRoute] = useState(false);
  const [checkingStanding, setCheckingStanding] = useState(true);

  useEffect(() => {
    // 1. Wait for Auth to finish loading
    if (loading) return;

    // 2. Redirect if not a student
    if (!userProfile || userProfile.role?.toLowerCase() !== 'student') {
      setCheckingStanding(false);
      if (userProfile) router.replace('/dashboard');
      return;
    }

    // 3. Perform Standing Check
    const checkStanding = async () => {
        setCheckingStanding(true);
        // Safety timeout to prevent permanent hang
        const safetyTimer = setTimeout(() => {
            console.warn("[GUARD] Standing check timed out. Proceeding with caution.");
            setCheckingStanding(false);
        }, 8000);

        try {
            if (!user) {
                setCheckingStanding(false);
                return;
            }

            // Check for missing intake assignment
            if (!userProfile.intakeId) {
                console.warn("[GUARD] No intake assigned to student profile.");
                setIsDefaulter(false);
                setIsRestrictedRoute(false);
                setCheckingStanding(false);
                return;
            }

            const [regSnap, txSnap, invSnap, semSnap, calSnap, eventsSnap, intakeSnap, finSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'transactions')),
                get(ref(db, `invoices/${user.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/financialSettings'))
            ]);

            // If critical data is missing, we can't accurately flag a defaulter, so we allow access
            if (!regSnap.exists() || !calSnap.exists() || !intakeSnap.exists()) {
                setCheckingStanding(false);
                return;
            }

            const intake = intakeSnap.val()[userProfile.intakeId];
            const intakeStart = parseIntakeDate(intake?.name);
            if (!intakeStart) {
                setCheckingStanding(false);
                return;
            }

            const standing = calculateAcademicState(
                intakeStart,
                new Date(),
                calSnap.val().standardCycles,
                Object.values(calSnap.val().anomalies || {})
            );

            const activeSemesterEntry = Object.entries(semSnap.val() || {}).find(([_, s]: [string, any]) => 
                s.intakeId === userProfile.intakeId && s.year === standing.year && s.semesterInYear === standing.semester
            );

            if (!activeSemesterEntry) {
                setCheckingStanding(false);
                return;
            }

            const [semId, semData] = activeSemesterEntry as [string, any];
            const reg = regSnap.val()[semId];
            const invoice = invSnap.val()?.[reg?.invoiceId];

            if (!reg || !invoice) {
                setCheckingStanding(false);
                return;
            }

            const totalDue = (Number(invoice.totalTuition) || 0) + (Number(invoice.totalMandatoryFees) || 0) + (Number(invoice.totalOptionalFees) || 0) + (invoice.lateFee || 0) - (invoice.applyScholarship ? (Number(invoice.totalTuition) || 0) : 0);
            const totalPaid = Object.values(txSnap.val() || {}).filter((t: any) => t.userId === user.uid && t.invoiceId === reg.invoiceId && t.status === 'successful').reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
            
            const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;
            const fSettings = finSnap.val() || { paymentThreshold: 75, defaulterRestrictions: { sidebar: {} } };
            const threshold = semData.paymentThreshold || fSettings.paymentThreshold;
            const grace = semData.gracePeriodDays || 0;

            const calendarEvents = Object.values(eventsSnap.val() || {}) as any[];
            const semDeadlines = calendarEvents.filter(ev => ev.semester === semData.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
            const passedDeadlines = semDeadlines.filter(ev => isAfter(new Date(), addDays(parseISO(ev.date), grace)));
            
            const defaulterStatus = passedDeadlines.length > 0 && paidPercentage < threshold;
            setIsDefaulter(defaulterStatus);

            if (defaulterStatus) {
                const restrictedFuncs = fSettings.defaulterRestrictions || {};
                const restrictedCategories = restrictedFuncs.sidebar || {};
                
                let isPathBlocked = false;

                // Functional block checks
                if (restrictedFuncs.results && (pathname.includes('/results') || pathname.includes('/transcript'))) {
                    isPathBlocked = true;
                }
                if (restrictedFuncs.registration && pathname.startsWith('/student/registration/')) {
                    isPathBlocked = true;
                }
                if (restrictedFuncs.library && pathname.startsWith('/student/library')) {
                    isPathBlocked = true;
                }

                // Sidebar category checks
                const currentCategory = studentMenuItems.find(cat => cat.items.some(item => pathname.startsWith(item.href)));
                if (currentCategory && restrictedCategories[currentCategory.label]) {
                    isPathBlocked = true;
                }

                // Essential pages whitelist
                const isEssential = pathname === '/student/dashboard' || pathname === '/student/payments' || pathname === '/student/notifications';
                if (isPathBlocked && !isEssential) {
                    setIsRestrictedRoute(true);
                } else {
                    setIsRestrictedRoute(false);
                }
            } else {
                setIsRestrictedRoute(false);
            }

        } catch (error) {
            console.error("Standing guard error:", error);
        } finally {
            clearTimeout(safetyTimer);
            setCheckingStanding(false);
        }
    };

    checkStanding();
  }, [user, userProfile, loading, router, pathname]);

  if (loading || checkingStanding) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Portal standing...</p>
      </div>
    );
  }

  if (isRestrictedRoute) {
      return (
          <DashboardLayout>
              <div className="flex items-center justify-center min-h-[70vh]">
                  <Card className="max-w-md w-full border-2 border-destructive/20 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                      <CardHeader className="bg-destructive/5 border-b border-destructive/10 text-center pb-8">
                          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <ShieldX className="h-10 w-10 text-destructive" />
                          </div>
                          <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight text-destructive">Access Restricted</CardTitle>
                          <CardDescription className="font-medium text-destructive/80">Institutional Payment Compliance Required</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-8 space-y-4">
                          <p className="text-sm text-center text-muted-foreground leading-relaxed">
                              This section of the portal has been locked because your account has not met the minimum required payment threshold for the current academic cycle.
                          </p>
                          <div className="bg-muted/50 p-4 rounded-xl border border-dashed text-xs space-y-2">
                              <div className="flex justify-between items-center">
                                  <span className="font-bold opacity-60">Status:</span>
                                  <Badge variant="destructive" className="font-black uppercase tracking-tighter text-[9px]">Arrears</Badge>
                              </div>
                              <p className="italic opacity-70 leading-snug">Access to restricted modules is suspended until standing is restored.</p>
                          </div>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2 p-6 bg-muted/5">
                          <Button className="w-full h-12 font-bold shadow-md bg-primary hover:bg-primary/90" asChild>
                              <Link href="/student/payments">
                                  <Wallet className="mr-2 h-4 w-4"/> Make Payment <ArrowRight className="ml-2 h-4 w-4"/>
                              </Link>
                          </Button>
                          <Button variant="ghost" className="w-full text-xs font-bold" asChild>
                              <Link href="/student/dashboard">Return to Dashboard</Link>
                          </Button>
                      </CardFooter>
                  </Card>
              </div>
          </DashboardLayout>
      );
  }
  
  return <DashboardLayout key={user?.uid}>{children}</DashboardLayout>;
}
