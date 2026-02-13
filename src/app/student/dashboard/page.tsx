
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    BookOpen, 
    Hand, 
    Calendar as CalendarIcon, 
    Clock, 
    Banknote, 
    UserCheck, 
    ChevronRight, 
    CreditCard,
    PlusCircle,
    CalendarDays,
    AlertTriangle,
    ShieldAlert,
    Wallet,
    MapPin
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, startOfDay, isAfter, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PaymentCountdown } from '@/components/payment-countdown';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    const [paymentDeadline, setPaymentDeadline] = React.useState<{ title: string; date: string } | null>(null);
    const [recentGrades, setRecentGrades] = React.useState<any[]>([]);
    const [intakeName, setIntakeName] = React.useState('');
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const [financialWarning, setFinancialWarning] = React.useState<{ message: string; restriction: boolean } | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        if (!user) return;

        setLoading(true);
        
        const registrationsRef = ref(db, `registrations/${user.uid}`);
        const unsub = onValue(registrationsRef, async (regSnap) => {
            const allRegistrations = regSnap.val() || {};
            
            const [cSnap, uSnap, iSnap, aSnap, tSnap, calSnap, invSnap, txSnap, assSnap, qSnap, settingsSnap, fSnap, semSnap] = await Promise.all([
                get(ref(db, 'courses')), get(ref(db, 'users')), get(ref(db, 'intakes')), get(ref(db, 'attendance')), 
                get(ref(db, 'timetables')), get(ref(db, 'calendarEvents')), get(ref(db, `invoices/${user.uid}`)), 
                get(ref(db, 'transactions')), get(ref(db, 'assessments')), get(ref(db, 'quizzes')), get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'settings/financialSettings')), get(ref(db, 'semesters'))
            ]);

            const allCourses = cSnap.val() || {};
            const allUsers = uSnap.val() || {};
            const allIntakes = iSnap.val() || {};
            const allAttendance = aSnap.val() || {};
            const allTimetables = tSnap.val() || {};
            const allCalendarEvents = calSnap.val() || {};
            const allInvoices = invSnap.val() || {};
            const allTransactions = Object.values(txSnap.val() || {}).filter((t: any) => t.userId === user.uid && t.status === 'successful');
            const allAssessments = assSnap.val() || {};
            const allQuizzes = qSnap.val() || {};
            const calSettings = settingsSnap.val() || {};
            const fSettings = fSnap.val() || { paymentThreshold: 75 };
            const allSemesters = semSnap.val() || {};

            if (userProfile?.intakeId) {
                const iName = allIntakes[userProfile.intakeId]?.name || 'Your Intake';
                setIntakeName(iName);

                const intakeStartStr = parseIntakeDate(iName);
                if (intakeStartStr) {
                    const state = calculateAcademicState(
                        intakeStartStr, 
                        new Date(), 
                        calSettings.standardCycles, 
                        Object.values(calSettings.anomalies || {})
                    );
                    setAcademicStanding(`Year ${state.year}, Sem ${state.semester}`);
                }
            }

            const currentCourses: Course[] = [];
            let totalPresent = 0;
            let totalMarked = 0;
            const enrolledIds = new Set<string>();
            let activeSemesterId: string | null = null;
            let activeSemesterName = '';

            for (const semId in allRegistrations) {
                const reg = allRegistrations[semId];
                const semInfo = allSemesters[semId];
                if (!semInfo || semInfo.status === 'Archived') continue;

                if (reg.courses) {
                    if (semInfo.status === 'Open') {
                        activeSemesterId = semId;
                        activeSemesterName = semInfo.name;
                    }

                    reg.courses.forEach((cid: string) => {
                        enrolledIds.add(cid);
                        const c = allCourses[cid];
                        if (c) {
                            const lecturerNames = (c.lecturerIds || [])
                                .map((id: string) => allUsers[id]?.name)
                                .filter(Boolean)
                                .join(', ') || allUsers[c.lecturerId]?.name || 'N/A';

                            currentCourses.push({
                                id: cid,
                                name: c.name,
                                code: c.code,
                                lecturerNames
                            });
                        }
                        
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

            // --- Financial & Deadline Countdown ---
            let totalDue = 0;
            Object.values(allInvoices).forEach((inv: any) => {
                const due = (Number(inv.totalTuition) || 0) + (Number(inv.totalMandatoryFees) || 0) + (Number(inv.totalOptionalFees) || 0) - (inv.applyScholarship ? (Number(inv.totalTuition) || 0) : 0);
                totalDue += due;
            });
            const totalPaid = allTransactions.reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
            const currentBalance = Math.max(0, totalDue - totalPaid);
            setFeeBalance(currentBalance);

            if (activeSemesterId && currentBalance > 0) {
                const semester = allSemesters[activeSemesterId];
                const threshold = semester.paymentThreshold || fSettings.paymentThreshold || 75;
                const grace = semester.gracePeriodDays || 0;
                
                const semDeadlines = Object.values(allCalendarEvents)
                    .filter((ev: any) => ev.semester === semester.name && ev.title.includes('Deadline'))
                    .sort((a: any, b: any) => a.date.localeCompare(b.date));

                const nextDeadline: any = semDeadlines.find((ev: any) => isAfter(parseISO(ev.date), new Date()));
                if (nextDeadline) {
                    setPaymentDeadline({ title: nextDeadline.title.split(' - ')[0], date: nextDeadline.date });
                }

                const passedDeadlines = semDeadlines.filter((ev: any) => isAfter(new Date(), addDays(parseISO(ev.date), grace)));
                if (passedDeadlines.length > 0) {
                    const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;
                    if (paidPercentage < threshold) {
                        setFinancialWarning({
                            message: `Your current payment level (${paidPercentage.toFixed(0)}%) is below the required ${threshold}% threshold for ${semester.name}.`,
                            restriction: true
                        });
                    }
                }
            }

            const todayName = daysOfWeek[new Date().getDay()];
            const schedule: TimetableEntry[] = [];
            for (const semId in allTimetables) {
                for (const cid in allTimetables[semId]) {
                    if (enrolledIds.has(cid)) {
                        Object.entries(allTimetables[semId][cid]).forEach(([entryId, entry]: [string, any]) => {
                            if (entry.day === todayName) {
                                schedule.push({ ...entry, courseCode: allCourses[cid]?.code, courseName: allCourses[cid]?.name, id: cid });
                            }
                        });
                    }
                }
            }
            setTodaySchedule(schedule.sort((a,b) => a.startTime.localeCompare(b.startTime)));

            const deadlines: DeadlineEvent[] = [];
            Object.values(allCalendarEvents).forEach((ev: any) => {
                if (ev.title?.toLowerCase().includes('deadline') && new Date(ev.date) >= startOfDay(new Date())) {
                    deadlines.push({ title: ev.title, date: ev.date, type: 'payment' });
                }
            });
            Object.entries(allQuizzes).forEach(([id, q]: [string, any]) => {
                if (q.startTime && isAfter(parseISO(q.startTime), new Date())) {
                    deadlines.push({ title: `Quiz: ${q.title}`, date: q.startTime, type: 'quiz', link: `/student/quizzes/${id}` });
                }
            });
            setUpcomingDeadlines(deadlines.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4));

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
            setLoading(false);
        });

        return () => unsub();
    }, [user, userProfile, toast]);

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
                <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="lg:col-span-2 h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-primary">Hello, {userProfile?.name?.split(' ')[0]}!</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground border-primary/20 bg-primary/5">
                            {userProfile?.programmeName || 'Academic Portal'}
                        </Badge>
                        <Badge className="font-bold bg-primary text-primary-foreground">
                            Intake: {intakeName}
                        </Badge>
                        {academicStanding && (
                            <Badge variant="secondary" className="gap-1.5 font-bold">
                                <CalendarDays className="h-3 w-3" />
                                {academicStanding}
                            </Badge>
                        )}
                    </div>
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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {paymentDeadline && feeBalance > 0 && (
                    <Card className="shadow-lg border-2 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Clock className="h-4 w-4"/> Next Payment Due
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PaymentCountdown deadlineDate={paymentDeadline.date} title={paymentDeadline.title} />
                        </CardContent>
                    </Card>
                )}

                <Card className={cn("shadow-md", (!paymentDeadline || feeBalance <= 0) ? "lg:col-span-1" : "")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-black", feeBalance > 0 ? "text-destructive" : "text-green-600")}>
                            ZMW {feeBalance.toFixed(2)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">Outstanding Dues</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{enrolledCourses.length}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">Active Enrollment</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                        <Hand className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-2xl font-black">{attendanceRate.toFixed(0)}%</div>
                        <Progress value={attendanceRate} className="h-1.5" />
                    </CardContent>
                </Card>
            </div>

            {financialWarning && (
                <Alert variant="destructive" className="border-2 shadow-md animate-in slide-in-from-left-4">
                    <ShieldAlert className="h-5 w-5" />
                    <AlertTitle className="font-bold">Financial Standing Alert</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p>{financialWarning.message} To avoid academic restrictions, please pay online or contact the finance office.</p>
                        <Button variant="outline" size="sm" className="w-fit border-destructive text-destructive hover:bg-destructive/10" asChild>
                            <Link href="/student/payments">View Invoices & Pay</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 shadow-lg border-0 bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <div>
                            <CardTitle className="font-headline">Daily Schedule</CardTitle>
                            <CardDescription>{format(new Date(), 'EEEE, MMMM do')}</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
                            <Link href="/student/timetable" className="flex items-center gap-1">
                                Full View <ChevronRight className="h-4 w-4"/>
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {todaySchedule.length > 0 ? (
                            <div className="space-y-4">
                                {todaySchedule.map((entry, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex flex-col items-center justify-center min-w-[80px] py-1 border-r border-primary/10 pr-4">
                                            <span className="text-sm font-black text-primary">{entry.startTime}</span>
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase">{entry.endTime}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{entry.courseCode}: {entry.courseName}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                                <MapPin className="h-3 w-3 text-primary/60" /> {entry.venue}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" asChild>
                                            <Link href={`/student/courses/${entry.id}/assignments`}><ChevronRight className="h-4 w-4 text-primary"/></Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
                                <Clock className="mx-auto h-12 w-12 opacity-10 mb-2" />
                                <p className="font-medium">No classes scheduled for today.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-lg border-l-4 border-l-primary">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base font-bold">Upcoming Deadlines</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((deadline, i) => (
                                <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border bg-card shadow-sm transition-all hover:border-primary/30">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className={cn(
                                            "text-[8px] font-black uppercase tracking-widest px-1.5 h-4",
                                            deadline.type === 'payment' ? "text-orange-600 border-orange-200 bg-orange-50" : "text-blue-600 border-blue-200 bg-blue-50"
                                        )}>
                                            {deadline.type}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground">{format(parseISO(deadline.date), 'MMM dd')}</span>
                                    </div>
                                    <p className="text-xs font-bold mt-1 line-clamp-1">{deadline.title}</p>
                                    {deadline.link && (
                                        <Link href={deadline.link} className="text-[10px] font-black text-primary hover:underline mt-1 flex items-center gap-1 uppercase">
                                            Open Task <ChevronRight className="h-2 w-2"/>
                                        </Link>
                                    )}
                                </div>
                            )) : <p className="text-xs text-muted-foreground text-center py-8 italic">No urgent deadlines.</p>}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-l-4 border-l-green-500">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base font-bold">Recent Academic Results</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {recentGrades.length > 0 ? recentGrades.map((grade, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-green-50/20">
                                    <div>
                                        <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">{grade.courseCode}</p>
                                        <p className="text-xs font-medium text-muted-foreground">{grade.label}</p>
                                    </div>
                                    <Badge variant={grade.score >= 50 ? 'default' : 'destructive'} className="font-mono text-sm shadow-sm">{grade.score}%</Badge>
                                </div>
                            )) : <p className="text-xs text-muted-foreground text-center py-8 italic">No recent results posted.</p>}
                        </CardContent>
                        <CardFooter className="pt-0 border-t bg-muted/5 p-2">
                            <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest" asChild>
                                <Link href="/student/courses/results">Full Transcript <ChevronRight className="ml-1 h-3 w-3"/></Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
