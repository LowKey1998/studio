'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    BookOpen, 
    Info, 
    Hand, 
    Calendar as CalendarIcon, 
    Clock, 
    Banknote, 
    FileQuestion, 
    Library, 
    UserCheck, 
    ChevronRight, 
    ClipboardCheck, 
    CreditCard,
    Bell,
    TrendingUp,
    PlusCircle
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, isToday, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerNames: string;
};

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
    id: string;
};

type DeadlineEvent = {
    title: string;
    date: string;
    type: 'assignment' | 'quiz' | 'payment';
    link?: string;
};

export default function StudentDashboardPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [loading, setLoading] = React.useState(true);
    const [enrolledCourses, setEnrolledCourses] = React.useState<Course[]>([]);
    const [attendanceRate, setAttendanceRate] = React.useState(0);
    const [feeBalance, setFeeBalance] = React.useState(0);
    const [todaySchedule, setTodaySchedule] = React.useState<TimetableEntry[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = React.useState<DeadlineEvent[]>([]);
    const [recentGrades, setRecentGrades] = React.useState<any[]>([]);
    const { toast } = useToast();

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const fetchData = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [
                registrationsSnap,
                coursesSnap,
                attendanceSnap,
                timetablesSnap,
                calendarSnap,
                invoicesSnap,
                transactionsSnap,
                assessmentsSnap,
                quizzesSnap
            ] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'attendance')),
                get(ref(db, 'timetables')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, `invoices/${user.uid}`)),
                get(ref(db, 'transactions')),
                get(ref(db, 'assessments')),
                get(ref(db, 'quizzes'))
            ]);

            const allCourses = coursesSnap.val() || {};
            const allRegistrations = registrationsSnap.val() || {};
            const allAttendance = attendanceSnap.val() || {};
            const allTimetables = timetablesSnap.val() || {};
            const allCalendarEvents = calendarSnap.val() || {};
            const allInvoices = invoicesSnap.val() || {};
            const allTransactions = Object.values(transactionsSnap.val() || {}).filter((t: any) => t.userId === user.uid && t.status === 'successful');
            const allAssessments = assessmentsSnap.val() || {};
            const allQuizzes = quizzesSnap.val() || {};

            // 1. Enrolled Courses & Attendance
            const currentCourses: Course[] = [];
            let totalPresent = 0;
            let totalMarked = 0;
            const enrolledIds = new Set<string>();

            for (const semId in allRegistrations) {
                const reg = allRegistrations[semId];
                if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                    (reg.courses || []).forEach((cid: string) => {
                        enrolledIds.add(cid);
                        const c = allCourses[cid];
                        if (c) {
                            currentCourses.push({
                                id: cid,
                                name: c.name,
                                code: c.code,
                                lecturerNames: 'Assigned Faculty' // Simplified
                            });
                        }
                        
                        // Attendance calculation
                        const cAtt = allAttendance[cid];
                        if (cAtt) {
                            Object.values(cAtt).forEach((day: any) => {
                                if (day[user.uid]) {
                                    totalMarked++;
                                    if (['Present', 'Late', 'Excused Absence'].includes(day[user.uid])) totalPresent++;
                                }
                            });
                        }
                    });
                }
            }
            setEnrolledCourses(currentCourses);
            setAttendanceRate(totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 100);

            // 2. Financials
            let totalDue = 0;
            Object.values(allInvoices).forEach((inv: any) => {
                const due = (inv.totalTuition || 0) + (inv.totalMandatoryFees || 0) + (inv.totalOptionalFees || 0) - (inv.applyScholarship ? inv.totalTuition : 0);
                totalDue += due;
            });
            const totalPaid = allTransactions.reduce((acc, t: any) => acc + t.amount, 0);
            setFeeBalance(totalDue - totalPaid);

            // 3. Today's Schedule
            const todayName = daysOfWeek[new Date().getDay()];
            const schedule: TimetableEntry[] = [];
            for (const semId in allTimetables) {
                for (const cid in allTimetables[semId]) {
                    if (enrolledIds.has(cid)) {
                        Object.entries(allTimetables[semId][cid]).forEach(([entryId, entry]: [string, any]) => {
                            if (entry.day === todayName) {
                                schedule.push({ ...entry, courseCode: allCourses[cid]?.code, courseName: allCourses[cid]?.name, id: entryId });
                            }
                        });
                    }
                }
            }
            setTodaySchedule(schedule.sort((a,b) => a.startTime.localeCompare(b.startTime)));

            // 4. Deadlines
            const deadlines: DeadlineEvent[] = [];
            Object.values(allCalendarEvents).forEach((ev: any) => {
                if (ev.title.toLowerCase().includes('deadline') && new Date(ev.date) >= startOfDay(new Date())) {
                    deadlines.push({ title: ev.title, date: ev.date, type: 'payment' });
                }
            });
            // Quizzes as deadlines
            Object.entries(allQuizzes).forEach(([id, q]: [string, any]) => {
                if (q.startTime && new Date(q.startTime) >= startOfDay(new Date())) {
                    deadlines.push({ title: `Quiz: ${q.title}`, date: q.startTime, type: 'quiz', link: `/student/quizzes/${id}` });
                }
            });
            setUpcomingDeadlines(deadlines.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4));

            // 5. Recent Grades
            const grades: any[] = [];
            enrolledIds.forEach(cid => {
                const assessment = allAssessments[cid]?.[user.uid];
                if (assessment) {
                    Object.entries(assessment).forEach(([key, data]: [string, any]) => {
                        if (data.score !== undefined) {
                            grades.push({ 
                                courseCode: allCourses[cid]?.code, 
                                label: key === 'finalExam' ? 'Final Exam' : key,
                                score: data.score
                            });
                        }
                    });
                }
            });
            setRecentGrades(grades.slice(-3));

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user, daysOfWeek]);

    React.useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);

    if (authLoading || loading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Hero */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Hello, {userProfile?.name?.split(' ')[0]}!</h1>
                    <p className="text-muted-foreground">{userProfile?.programmeName || 'Welcome to your student portal.'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/student/registration"><PlusCircle className="mr-2 h-4 w-4"/>Registration</Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/student/payments"><CreditCard className="mr-2 h-4 w-4"/>Pay Fees</Link>
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="relative overflow-hidden border-primary/20 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{enrolledCourses.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Currently Enrolled</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                        <Hand className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-2xl font-bold">{attendanceRate.toFixed(0)}%</div>
                        <Progress value={attendanceRate} className="h-1.5" />
                    </CardContent>
                </Card>
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fee Balance</CardTitle>
                        <Banknote className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-bold", feeBalance > 0 ? "text-destructive" : "text-green-600")}>
                            ZMW {feeBalance.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Academic Status</CardTitle>
                        <UserCheck className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">In Good Standing</div>
                        <Badge variant="secondary" className="mt-1">Active Student</Badge>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Today's Schedule */}
                <Card className="lg:col-span-2 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Today's Schedule</CardTitle>
                            <CardDescription>{format(new Date(), 'EEEE, MMMM do')}</CardDescription>
                        </div>
                        <Link href="/student/timetable" className="text-sm text-primary hover:underline flex items-center gap-1">
                            Full Timetable <ChevronRight className="h-4 w-4"/>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {todaySchedule.length > 0 ? (
                            <div className="space-y-4">
                                {todaySchedule.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20 transition-colors hover:bg-muted/30">
                                        <div className="flex flex-col items-center justify-center min-w-[80px] py-1 border-r pr-4">
                                            <span className="text-sm font-bold text-primary">{entry.startTime}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{entry.endTime}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold">{entry.courseCode}: {entry.courseName}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <CalendarIcon className="h-3 w-3" /> Classroom: {entry.venue}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" asChild><Link href={`/student/courses/${entry.id}`}><ChevronRight className="h-4 w-4"/></Link></Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                                <Clock className="mx-auto h-12 w-12 opacity-20 mb-2" />
                                <p>No classes scheduled for today.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Deadlines & Activity */}
                <div className="space-y-6">
                    <Card className="shadow-lg border-l-4 border-l-primary">
                        <CardHeader>
                            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((deadline, i) => (
                                <div key={i} className="flex flex-col gap-1 p-2 rounded-md hover:bg-muted/50 transition-colors border">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-semibold uppercase text-primary tracking-wider">{deadline.type}</span>
                                        <span className="text-xs text-muted-foreground">{format(parseISO(deadline.date), 'MMM dd')}</span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-1">{deadline.title}</p>
                                    {deadline.link && (
                                        <Link href={deadline.link} className="text-[10px] text-primary hover:underline mt-1">Open Task</Link>
                                    )}
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center py-4">All caught up! No major deadlines.</p>}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-l-4 border-l-green-500">
                        <CardHeader>
                            <CardTitle className="text-lg">Recent Results</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {recentGrades.length > 0 ? recentGrades.map((grade, i) => (
                                <div key={i} className="flex justify-between items-center p-2 rounded-md border bg-green-50/30">
                                    <div>
                                        <p className="text-xs font-bold text-green-700">{grade.courseCode}</p>
                                        <p className="text-[10px] text-muted-foreground">{grade.label}</p>
                                    </div>
                                    <Badge variant={grade.score >= 50 ? 'default' : 'destructive'}>{grade.score}%</Badge>
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center py-4">No recent grades posted.</p>}
                        </CardContent>
                        <CardFooter>
                            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                                <Link href="/student/courses">View All Results</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}