'use client';
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
    GraduationCap,
    CalendarDays
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { calculateAcademicState } from '@/lib/semester-utils';

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
    const [recentGrades, setRecentGrades] = React.useState<any[]>([]);
    const [intakeName, setIntakeName] = React.useState('');
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const { toast } = useToast();

    React.useEffect(() => {
        if (!user) return;

        setLoading(true);
        
        const coursesRef = ref(db, 'courses');
        const usersRef = ref(db, 'users');
        const intakesRef = ref(db, 'intakes');
        const calendarRef = ref(db, 'calendarEvents');
        const timetablesRef = ref(db, 'timetables');
        const assessmentsRef = ref(db, 'assessments');
        const quizzesRef = ref(db, 'quizzes');
        const registrationsRef = ref(db, `registrations/${user.uid}`);
        const invoicesRef = ref(db, `invoices/${user.uid}`);
        const transactionsRef = ref(db, 'transactions');
        const attendanceRef = ref(db, 'attendance');
        const calendarSettingsRef = ref(db, 'settings/academicCalendar');

        const unsubRegs = onValue(registrationsRef, async (regSnap) => {
            const allRegistrations = regSnap.val() || {};
            
            const [cSnap, uSnap, iSnap, aSnap, tSnap, calSnap, invSnap, txSnap, assSnap, qSnap, settingsSnap] = await Promise.all([
                get(coursesRef), get(usersRef), get(intakesRef), get(attendanceRef), 
                get(timetablesRef), get(calendarRef), get(invoicesRef), 
                get(transactionsRef), get(assessmentsRef), get(quizzesRef), get(calendarSettingsRef)
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

            if (userProfile?.intakeId) {
                const iName = allIntakes[userProfile.intakeId]?.name || 'Your Intake';
                setIntakeName(iName);

                const yearMatch = iName.match(/\d{4}/);
                const monthMatch = iName.match(/[A-Z]{3}/);
                if (yearMatch && monthMatch) {
                    const startMonth = monthMatch[0] === 'JAN' ? '01' : '07';
                    const intakeStartStr = `${yearMatch[0]}-${startMonth}-01`;
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

            for (const semId in allRegistrations) {
                const reg = allRegistrations[semId];
                if (reg.courses) {
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

            let totalDue = 0;
            Object.values(allInvoices).forEach((inv: any) => {
                const due = (Number(inv.totalTuition) || 0) + (Number(inv.totalMandatoryFees) || 0) + (Number(inv.totalOptionalFees) || 0) - (inv.applyScholarship ? (Number(inv.totalTuition) || 0) : 0);
                totalDue += due;
            });
            const totalPaid = allTransactions.reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
            setFeeBalance(Math.max(0, totalDue - totalPaid));

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
                if (q.startTime && new Date(q.startTime) >= startOfDay(new Date())) {
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

        return () => unsubRegs();
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
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-primary">Hello, {userProfile?.name?.split(' ')[0]}!</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-muted-foreground border-primary/20 bg-primary/5">
                            {userProfile?.programmeName || 'Academic Portal'}
                        </Badge>
                        <Badge className="font-bold bg-primary text-primary-foreground">
                            Intake: {intakeName}
                        </Badge>
                        {academicStanding && (
                            <Badge variant="secondary" className="gap-1.5 font-bold">
                                <CalendarDays className="h-3 w-3" />
                                Academic Standing: {academicStanding}
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Courses</CardTitle>
                        <BookOpen className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{enrolledCourses.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Currently Enrolled</p>
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Attendance</CardTitle>
                        <Hand className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-2xl font-bold">{attendanceRate.toFixed(0)}%</div>
                        <Progress value={attendanceRate} className="h-1.5" />
                    </CardContent>
                </Card>
                <Card className="shadow-md">
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
                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Academic Status</CardTitle>
                        <UserCheck className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Good Standing</div>
                        <Badge variant="secondary" className="mt-1">Active</Badge>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
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
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20">
                                        <div className="flex flex-col items-center justify-center min-w-[80px] py-1 border-r pr-4">
                                            <span className="text-sm font-bold text-primary">{entry.startTime}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{entry.endTime}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold">{entry.courseCode}: {entry.courseName}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <CalendarIcon className="h-3 w-3" /> {entry.venue}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" asChild><Link href={`/student/courses/${entry.id}/assignments`}><ChevronRight className="h-4 w-4"/></Link></Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                <Clock className="mx-auto h-12 w-12 opacity-20 mb-2" />
                                <p>No classes scheduled for today.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-lg border-l-4 border-l-primary">
                        <CardHeader>
                            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((deadline, i) => (
                                <div key={i} className="flex flex-col gap-1 p-2 rounded-md border">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-semibold uppercase text-primary tracking-wider">{deadline.type}</span>
                                        <span className="text-xs text-muted-foreground">{format(parseISO(deadline.date), 'MMM dd')}</span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-1">{deadline.title}</p>
                                    {deadline.link && (
                                        <Link href={deadline.link} className="text-[10px] text-primary hover:underline mt-1">Open Task</Link>
                                    )}
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center py-4">No major deadlines.</p>}
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
