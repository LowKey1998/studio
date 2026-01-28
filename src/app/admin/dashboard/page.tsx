
'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, UserCheck, Activity, DollarSign, BookOpenCheck, GanttChart, PiggyBank } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';

type ActivityLog = {
    user: string;
    userId: string;
    action: string;
    timestamp: number;
}

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

    React.useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setActivitiesLoading(true);
            try {
                // Fetch counts and balances
                const [usersSnap, coursesSnap, programmesSnap, regsSnap, invoicesSnap, transactionsSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'invoices')),
                    get(ref(db, 'transactions'))
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

                // Course Count
                if (coursesSnap.exists()) {
                    const activeCourses = Object.values(coursesSnap.val()).filter((course: any) => course.status === 'active');
                    setActiveCourseCount(activeCourses.length);
                }

                // Financials and Registrations
                const registrations = regsSnap.exists() ? regsSnap.val() : {};
                const allInvoices = invoicesSnap.exists() ? invoicesSnap.val() : {};
                const allTransactions = transactionsSnap.exists() ? transactionsSnap.val() : {};

                let pendingCount = 0;
                let totalOutstanding = 0;

                for (const userId in allInvoices) {
                    for (const invoiceId in allInvoices[userId]) {
                        const invoice = allInvoices[userId][invoiceId];
                        const totalDue = 
                            (Number(invoice.totalTuition) || 0) + 
                            (Number(invoice.totalMandatoryFees) || 0) + 
                            (Number(invoice.totalOptionalFees) || 0) - 
                            (invoice.applyScholarship ? (Number(invoice.totalTuition) || 0) : 0);
                        
                        const totalPaid = Object.values(allTransactions)
                            .filter((tx: any) => tx.userId === userId && tx.invoiceId === invoiceId)
                            .reduce((acc, tx: any) => acc + (Number(tx.amount) || 0), 0);
                            
                        const balance = totalDue - totalPaid;
                        if (balance > 0.01) {
                            totalOutstanding += balance;
                        }
                    }
                }
                
                for(const userId in registrations) {
                    for (const semesterId in registrations[userId]) {
                        if (registrations[userId][semesterId].status === 'Pending Approval') {
                            pendingCount++;
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
                        .sort((a, b) => b.timestamp - a.timestamp)
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
                             <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</p>
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
