'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, UserCheck, Activity, DollarSign, BookOpenCheck, GanttChart, PiggyBank, AlertCircle, Calendar, Clock, ChevronRight } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { formatDistanceToNow, isAfter, parseISO, addDays, isToday } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ActivityLog = {
    user: string;
    userId: string;
    action: string;
    timestamp: number;
}

type ProgrammeDeadline = {
    programmeName: string;
    title: string;
    date: string;
    isUrgent: boolean;
};

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
    const [programmeDeadlines, setProgrammeDeadlines] = React.useState<ProgrammeDeadline[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [activitiesLoading, setActivitiesLoading] = React.useState(true);

    const [missingDeadlinesCount, setMissingDeadlinesCount] = React.useState(0);
    const [unassignedCoursesCount, setUnassignedCoursesCount] = React.useState(0);

    React.useEffect(() => {
        setLoading(true);
        setActivitiesLoading(true);
        
        const unsub = onValue(ref(db), (snapshot) => {
            if (!snapshot.exists()) { setLoading(false); return; }
            const data = snapshot.val();

            const allUsers = data.users || {};
            const allCourses = data.courses || {};
            const allProgrammes = data.programmes || {};
            const allRegistrations = data.registrations || {};
            const allInvoices = data.invoices || {};
            const allTransactions = data.transactions || {};
            const allSemesters = data.semesters || {};
            const allCalendarEvents = data.calendarEvents || {};
            const allPlans = data.settings?.paymentPlans || {};

            const usersList = Object.values(allUsers) as any[];
            setStudentCount(usersList.filter(u => u.role === 'Student').length);
            setStaffCount(usersList.filter(u => u.role === 'Staff').length);
            setProgrammeCount(Object.keys(allProgrammes).length);

            const activeCourses = Object.values(allCourses).filter((c: any) => c.status === 'active');
            setActiveCourseCount(activeCourses.length);
            setUnassignedCoursesCount(activeCourses.filter((c: any) => !c.lecturerId && (!c.lecturerIds || c.lecturerIds.length === 0)).length);

            let pendingCount = 0;
            let totalOutstanding = 0;
            for (const userId in allInvoices) {
                for (const invoiceId in allInvoices[userId]) {
                    const inv = allInvoices[userId][invoiceId];
                    const due = (Number(inv.totalTuition) || 0) + (Number(inv.totalMandatoryFees) || 0) + (Number(inv.totalOptionalFees) || 0) - (inv.applyScholarship ? (Number(inv.totalTuition) || 0) : 0);
                    const totalPaid = Object.values(allTransactions).filter((tx: any) => tx.userId === userId && tx.invoiceId === invoiceId && tx.status === 'successful').reduce((acc, tx: any) => acc + (Number(tx.amount) || 0), 0);
                    totalOutstanding += Math.max(0, due - totalPaid);
                }
            }
            for (const userId in allRegistrations) {
                for (const semId in allRegistrations[userId]) {
                    if (allRegistrations[userId][semId]?.status === 'Pending Approval') pendingCount++;
                }
            }
            setPendingRegistrations(pendingCount);
            setOutstandingBalance(totalOutstanding);

            let missing = 0;
            const progDeadlines: ProgrammeDeadline[] = [];
            
            Object.values(allSemesters).forEach((sem: any) => {
                if (sem.status === 'Archived') return;
                const linkedPlanIds = Object.keys(sem.paymentPlanIds || {});
                const intakeName = sem.name.split(' ')[0];
                
                linkedPlanIds.forEach(pid => {
                    const plan = allPlans[pid];
                    if (plan && !plan.archived) {
                        for (let i = 0; i < plan.installments; i++) {
                            const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${sem.name}`;
                            const event: any = Object.values(allCalendarEvents).find((e: any) => e.title?.trim() === title.trim());
                            
                            if (!event) {
                                missing++;
                            } else if (isAfter(parseISO(event.date), new Date())) {
                                const progName = sem.name.includes('Year') ? sem.name.split('Year')[0].replace(intakeName, '').trim() : 'General';
                                
                                progDeadlines.push({
                                    programmeName: progName,
                                    title: `${plan.name} ${getOrdinalSuffix(i+1)}`,
                                    date: event.date,
                                    isUrgent: isAfter(addDays(new Date(), 7), parseISO(event.date))
                                });
                            }
                        }
                    }
                });
            });
            setMissingDeadlinesCount(missing);
            setProgrammeDeadlines(progDeadlines.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5));

            const activitiesData = data.recentActivities || {};
            setRecentActivities(Object.values(activitiesData).sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 5) as any);

            setLoading(false);
            setActivitiesLoading(false);
        });

        return () => unsub();
    }, []);
    
    const highlightUserIds = (actionText: string) => {
        if (!actionText) return '';
        const idRegex = /\(\*\*([A-Z0-9-]+)\*\*\)/g;
        return actionText.split(idRegex).map((part, index) => {
            if (index % 2 === 1) return <span key={index} className="font-semibold text-primary">({part})</span>;
            return part;
        });
    };

    const stats = [
        { title: "Students", value: studentCount, icon: Users },
        { title: "Staff", value: staffCount, icon: UserCheck },
        { title: "Programmes", value: programmeCount, icon: GanttChart },
        { title: "Active Courses", value: activeCourseCount, icon: BookOpen },
        { title: "Pending Regs", value: pendingRegistrations, icon: BookOpenCheck },
        { title: "Revenue Due", value: `ZMW ${outstandingBalance.toFixed(0)}`, icon: DollarSign },
    ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat, index) => (
          <Card key={index} className="shadow-sm border-0 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider opacity-60">{stat.title}</CardTitle>
              <stat.icon className="h-3 w-3 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black">{loading ? <Skeleton className="h-6 w-16" /> : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {(missingDeadlinesCount > 0 || unassignedCoursesCount > 0) && !loading && (
                <Card className="border-orange-200 bg-orange-50/20">
                    <CardHeader className="pb-3 border-b border-orange-100">
                        <div className="flex items-center gap-2 text-orange-800">
                            <AlertCircle className="h-5 w-5" />
                            <CardTitle className="text-lg font-bold">System Health Alerts</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                        {missingDeadlinesCount > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-md bg-white border border-orange-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm"><strong>{missingDeadlinesCount}</strong> semester(s) missing installment deadlines</span>
                                </div>
                                <Button size="sm" variant="outline" asChild className="h-8 border-orange-200 hover:bg-orange-100">
                                    <Link href="/admin/registration-management">Fix Configuration</Link>
                                </Button>
                            </div>
                        )}
                        {unassignedCoursesCount > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-md bg-white border border-orange-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <UserCheck className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm"><strong>{unassignedCoursesCount}</strong> courses have no lecturer assigned</span>
                                </div>
                                <Button size="sm" variant="outline" asChild className="h-8 border-orange-200 hover:bg-orange-100">
                                    <Link href="/admin/academics/lecturer-allocation">Assign Instructors</Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <CardTitle className="font-headline text-xl">Programme Payment Deadlines</CardTitle>
                    <CardDescription>Upcoming installment dates across academic programmes.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {programmeDeadlines.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {programmeDeadlines.map((d, i) => (
                                <div key={i} className={cn(
                                    "p-3 rounded-lg border flex items-center justify-between gap-4",
                                    d.isUrgent ? "bg-red-50 border-red-200" : "bg-muted/30 border-muted"
                                )}>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-primary leading-none">{d.programmeName}</p>
                                        <p className="text-sm font-bold leading-tight">{d.title}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>{format(parseISO(d.date), 'dd MMM yyyy')}</span>
                                        </div>
                                    </div>
                                    {d.isUrgent && <Badge variant="destructive" className="text-[8px] h-4 uppercase font-black">Urgent</Badge>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Calendar className="mx-auto h-12 w-12 opacity-10 mb-2"/>
                            <p>No upcoming programme deadlines scheduled.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="border-t bg-muted/5">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest" asChild>
                        <Link href="/admin/calendar">View Academic Calendar <ChevronRight className="h-3 w-3 ml-1"/></Link>
                    </Button>
                </CardFooter>
            </Card>
          </div>

          <Card className="shadow-md h-fit">
            <CardHeader className="border-b">
              <CardTitle className="font-headline">Live Feed</CardTitle>
              <CardDescription>Recent system activity.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-6">
                {activitiesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="flex gap-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></li>
                    ))
                ) : recentActivities.length > 0 ? (
                    recentActivities.map((activity, index) => (
                        <li key={index} className="flex items-start gap-3">
                            <div className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground leading-snug">
                                    <span className="font-bold text-foreground">{activity.user}</span> {highlightUserIds(activity.action)}
                                </p>
                                 <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                                    {activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Recently'}
                                 </p>
                            </div>
                        </li>
                    ))
                ) : (
                     <li className="text-center text-sm text-muted-foreground py-4">No recent activity.</li>
                )}
              </ul>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}