'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, UserCheck, Activity, DollarSign, BookOpenCheck, GanttChart, PiggyBank, AlertCircle, Calendar } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

type ActivityLog = {
    user: string;
    userId: string;
    action: string;
    timestamp: number;
}

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

export default function AdminDashboardPage() {
    const [studentCount, setStudentCount] = React.useState(0);
    const [staffCount, setStaffCount] = React.useState(0);
    const [activeCourseCount, setActiveCourseCount] = React.useState(0);
    const [programmeCount, setProgrammeCount] = React.useState(0);
    const [pendingRegistrations, setPendingRegistrations] = React.useState(0);
    const [outstandingBalance, setOutstandingBalance] = React.useState(0);
    const [recentActivities, setRecentActivities] = React.useState<ActivityLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activitiesLoading, setActivitiesLoading] = React.useState(true);

    // Warning states
    const [missingDeadlinesCount, setMissingDeadlinesCount] = React.useState(0);
    const [unassignedCoursesCount, setUnassignedCoursesCount] = React.useState(0);

    React.useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setActivitiesLoading(true);
            try {
                // Fetch counts and balances
                const [usersSnap, coursesSnap, programmesSnap, regsSnap, invoicesSnap, transactionsSnap, semsSnap, eventsSnap, plansSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'invoices')),
                    get(ref(db, 'transactions')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'calendarEvents')),
                    get(ref(db, 'settings/paymentPlans'))
                ]);

                // User Counts
                if (usersSnap.exists()) {
                    const usersData = usersSnap.val();
                    const usersList = Object.values(usersData) as { role: string }[];
                    setStudentCount(usersList.filter(user => user.role === 'Student').length);
                    setStaffCount(usersList.filter(user => user.role === 'Staff').length);
                }
                
                // Programme Count
                 if (programmesSnap.exists()) {
                    setProgrammeCount(Object.keys(programmesSnap.val()).length);
                }

                // Course Count & Unassigned Check
                if (coursesSnap.exists()) {
                    const allCourses = coursesSnap.val();
                    const activeCourses = Object.values(allCourses).filter((course: any) => course.status === 'active');
                    setActiveCourseCount(activeCourses.length);
                    
                    const unassigned = activeCourses.filter((c: any) => !c.lecturerId && (!c.lecturerIds || c.lecturerIds.length === 0));
                    setUnassignedCoursesCount(unassigned.length);
                }

                // Missing Deadlines Check
                if (semsSnap.exists() && plansSnap.exists()) {
                    const sems = semsSnap.val();
                    const events = eventsSnap.exists() ? Object.values(eventsSnap.val()) as any[] : [];
                    const plans = plansSnap.val();
                    let missing = 0;

                    Object.values(sems).forEach((sem: any) => {
                        if (sem.status === 'Archived') return;
                        const linkedPlanIds = Object.keys(sem.paymentPlanIds || {});
                        linkedPlanIds.forEach(pid => {
                            const plan = plans[pid];
                            if (plan && !plan.archived) {
                                for (let i = 0; i < plan.installments; i++) {
                                    const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${sem.name}`;
                                    if (!events.some(e => e.title?.trim() === title.trim())) {
                                        missing++;
                                        return;
                                    }
                                }
                            }
                        });
                    });
                    setMissingDeadlinesCount(missing);
                }

                // Financials and Registrations
                const registrations = regsSnap.exists() ? regsSnap.val() : {};
                const allInvoices = invoicesSnap.exists() ? invoicesSnap.val() : {};
                const allTransactions = transactionsSnap.exists() ? transactionsSnap.val() : {};

                let pendingCount = 0;
                let totalOutstanding = 0;

                // Process Invoices defensively
                for (const userId in allInvoices) {
                    const userInvoices = allInvoices[userId];
                    if (userInvoices && typeof userInvoices === 'object') {
                        for (const invoiceId in userInvoices) {
                            const invoice = userInvoices[invoiceId];
                            if (!invoice) continue;

                            const totalDue = 
                                (Number(invoice.totalTuition) || 0) + 
                                (Number(invoice.totalMandatoryFees) || 0) + 
                                (Number(invoice.totalOptionalFees) || 0) - 
                                (invoice.applyScholarship ? (Number(invoice.totalTuition) || 0) : 0);
                            
                            const totalPaid = Object.values(allTransactions)
                                .filter((tx: any) => tx && tx.userId === userId && tx.invoiceId === invoiceId)
                                .reduce((acc, tx: any) => acc + (Number(tx.amount) || 0), 0);
                                
                            const balance = totalDue - totalPaid;
                            if (balance > 0.01) {
                                totalOutstanding += balance;
                            }
                        }
                    }
                }
                
                // Process Registrations defensively
                for(const userId in registrations) {
                    const userRegs = registrations[userId];
                    if (userRegs && typeof userRegs === 'object') {
                        for (const semesterId in userRegs) {
                            if (userRegs[semesterId]?.status === 'Pending Approval') {
                                pendingCount++;
                            }
                        }
                    }
                }

                setPendingRegistrations(pendingCount);
                setOutstandingBalance(totalOutstanding);

                // Recent Activities
                const activitiesRef = ref(db, 'recentActivities');
                const activitySnapshot = await get(activitiesRef);
                if (activitySnapshot.exists()) {
                    const activitiesData: { [key: string]: ActivityLog } = activitySnapshot.val();
                    const activitiesList = Object.values(activitiesData)
                        .filter(a => a && typeof a === 'object')
                        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
                        .slice(0, 5);
                    setRecentActivities(activitiesList);
                }

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
                setActivitiesLoading(false);
            }
        };

        fetchDashboardData();
    }, []);
    
    // Function to find and wrap user IDs in a styled span
    const highlightUserIds = (actionText: string) => {
        if (!actionText) return '';
        const idRegex = /\(\*\*([A-Z0-9-]+)\*\*\)/g;
        return actionText.split(idRegex).map((part, index) => {
            if (index % 2 === 1) { // This part is the captured user ID
                return <span key={index} className="font-semibold text-primary">({part})</span>;
            }
            return part;
        });
    };

    const stats = [
        { title: "Total Students", value: loading ? <Skeleton className="h-8 w-24" /> : studentCount, icon: <Users className="h-6 w-6 text-muted-foreground" />},
        { title: "Total Staff", value: loading ? <Skeleton className="h-8 w-16" /> : staffCount, icon: <UserCheck className="h-6 w-6 text-muted-foreground" />},
        { title: "Total Programmes", value: loading ? <Skeleton className="h-8 w-16" /> : programmeCount, icon: <GanttChart className="h-6 w-6 text-muted-foreground" />},
        { title: "Active Courses", value: loading ? <Skeleton className="h-8 w-12" /> : activeCourseCount, icon: <BookOpen className="h-6 w-6 text-muted-foreground" />},
        { title: "Pending Registrations", value: loading ? <Skeleton className="h-8 w-16" /> : pendingRegistrations, icon: <BookOpenCheck className="h-6 w-6 text-muted-foreground" />, notificationKey: 'pendingRegistrations' },
        { title: "Outstanding Balance", value: loading ? <Skeleton className="h-8 w-32" /> : `ZMW ${outstandingBalance.toFixed(2)}`, icon: <PiggyBank className="h-6 w-6 text-muted-foreground" />},
    ];


  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(missingDeadlinesCount > 0 || unassignedCoursesCount > 0) && !loading && (
          <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-orange-800">
                      <AlertCircle className="h-5 w-5" />
                      <CardTitle className="text-lg font-bold">System Alerts</CardTitle>
                  </div>
                  <CardDescription className="text-orange-700">Configuration gaps that require administrative attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                  {missingDeadlinesCount > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-md bg-white/80 border border-orange-200 shadow-sm">
                          <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-orange-600" />
                              <span className="text-sm font-medium"><strong>{missingDeadlinesCount}</strong> semester(s) missing payment deadlines</span>
                          </div>
                          <Button size="sm" variant="outline" asChild className="h-8 border-orange-200 hover:bg-orange-100">
                              <Link href="/admin/registration-management">Fix Now</Link>
                          </Button>
                      </div>
                  )}
                  {unassignedCoursesCount > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-md bg-white/80 border border-orange-200 shadow-sm">
                          <div className="flex items-center gap-3">
                              <UserCheck className="h-4 w-4 text-orange-600" />
                              <span className="text-sm font-medium"><strong>{unassignedCoursesCount}</strong> active course(s) with no lecturer assigned</span>
                          </div>
                          <Button size="sm" variant="outline" asChild className="h-8 border-orange-200 hover:bg-orange-100">
                              <Link href="/admin/academics/lecturer-allocation">Assign Now</Link>
                          </Button>
                      </div>
                  )}
              </CardContent>
          </Card>
      )}
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline">Recent Activity</CardTitle>
          <CardDescription>A log of recent important actions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {activitiesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="flex items-start gap-4">
                         <div className="mt-1.5 flex h-3 w-3 items-center justify-center">
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground"></span>
                        </div>
                        <div className="space-y-1 w-full">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                    </li>
                ))
            ) : recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                    <li key={index} className="flex items-start gap-4">
                        <div className="mt-1.5 flex h-3 w-3 items-center justify-center">
                            <span className="absolute h-3 w-3 animate-ping rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{activity.user} ({activity.userId})</span> {highlightUserIds(activity.action)}
                            </p>
                             <p className="text-xs text-muted-foreground">
                                {activity.timestamp ? (
                                    (() => {
                                        try {
                                            return formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
                                        } catch (e) {
                                            return 'Recently';
                                        }
                                    })()
                                ) : 'Recently'}
                             </p>
                        </div>
                    </li>
                ))
            ) : (
                 <li className="text-center text-sm text-muted-foreground py-4">No recent activity to display.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
