
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    BookOpen, 
    Hand, 
    Calendar as CalendarIcon, 
    Clock, 
    DollarSign, 
    UserCheck, 
    ChevronRight, 
    CreditCard,
    PlusCircle,
    CalendarDays,
    AlertTriangle,
    ShieldAlert,
    Wallet,
    MapPin,
    AlertCircle,
    ClipboardCheck,
    Layers,
    Video,
    ShieldX,
    Info,
    Receipt,
    TrendingUp,
    ArrowRight
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, startOfDay, isAfter, addDays, isToday, differenceInCalendarDays, isBefore } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PaymentCountdown } from '@/components/payment-countdown';
import { Separator } from '@/components/ui/separator';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerNames: string;
    assignmentAlert?: { type: 'soon' | 'late'; count: number };
};

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
    id: string;
    semesterId: string;
    isLiveSession?: boolean;
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
    const [currentSemesterFinance, setCurrentSemesterFinance] = React.useState<{
        due: number;
        paid: number;
        balance: number;
        semesterName: string;
        academicStanding: string;
    } | null>(null);
    const [todaySchedule, setTodaySchedule] = React.useState<TimetableEntry[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = React.useState<DeadlineEvent[]>([]);
    const [paymentDeadline, setPaymentDeadline] = React.useState<{ title: string; date: string } | null>(null);
    const [recentGrades, setRecentGrades] = React.useState<any[]>([]);
    const [intakeName, setIntakeName] = React.useState('');
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const [financialWarning, setFinancialWarning] = React.useState<{ message: string; restriction: boolean } | null>(null);
    const [missingPlanPrompt, setMissingPlanPrompt] = React.useState<{ semesterName: string; pathId: string; year: number; sem: number } | null>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    const { toast } = useToast();

    React.useEffect(() => {
        onValue(ref(db, '.info/serverTimeOffset'), (snap) => setServerTimeOffset(snap.val() || 0));
    }, []);

    const getCurrentServerDate = () => new Date(Date.now() + serverTimeOffset);

    React.useEffect(() => {
        if (!user || !userProfile) return;

        setLoading(true);
        
        const registrationsRef = ref(db, `registrations/${user.uid}`);
        const unsub = onValue(registrationsRef, async (regSnap) => {
            const allRegistrations = regSnap.val() || {};
            
            const [cSnap, uSnap, iSnap, aSnap, tSnap, calSnap, invSnap, txSnap, assSnap, settingsSnap, fSnap, semSnap, studentAssSnap, templatesSnap, pathsSnap] = await Promise.all([
                get(ref(db, 'courses')), get(ref(db, 'users')), get(ref(db, 'intakes')), get(ref(db, 'attendance')), 
                get(ref(db, 'timetables')), get(ref(db, 'calendarEvents')), get(ref(db, `invoices/${user.uid}`)), 
                get(ref(db, 'transactions')), get(ref(db, 'assessments')), get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'settings/financialSettings')), get(ref(db, 'semesters')), get(ref(db, 'assignments')),
                get(ref(db, 'settings/assessmentTemplates')), get(ref(db, 'coursePaths'))
            ]);

            const allCourses = cSnap.val() || {};
            const allUsers = uSnap.val() || {};
            const allIntakes = iSnap.val() || {};
            const allAttendance = aSnap.val() || {};
            const allTimetables = tData || {}; // tData is likely null in prompt, using let
            const allCalendarEvents = Object.values(calSnap.val() || {}) as any[];
            const allInvoices = invSnap.val() || {};
            const allTransactions = Object.values(txSnap.val() || {}).filter((t: any) => t.userId === user.uid && t.status === 'successful');
            const allAssessments = assSnap.val() || {};
            const calSettings = settingsSnap.val() || {};
            const fSettings = fSnap.val() || { paymentThreshold: 75 };
            const allSemesters = semSnap.val() || {};
            const allAssignments = studentAssSnap.val() || {};
            const allTemplates = templatesSnap.val() || {};
            const allPaths = pathsSnap.val() || {};

            let currentIntakeNameVal = '';
            let matchingSemesterId: string | null = null;
            let currentPhase = { year: 1, semester: 1 };
            let standingLabel = '';

            if (userProfile?.intakeId) {
                currentIntakeNameVal = allIntakes[userProfile.intakeId]?.name || 'Your Intake';
                setIntakeName(currentIntakeNameVal);

                const intakeStartStr = parseIntakeDate(currentIntakeNameVal);
                if (intakeStartStr && calSettings) {
                    const state = calculateAcademicState(
                        intakeStartStr, 
                        getCurrentServerDate(), 
                        calSettings.standardCycles, 
                        Object.values(calSettings.anomalies || {})
                    );
                    currentPhase = { year: state.year, semester: state.semester };
                    standingLabel = `Year ${state.year}, Sem ${state.semester}`;
                    setAcademicStanding(standingLabel);

                    const matchingSemesterEntry = Object.entries(allSemesters).find(([_, s]: [string, any]) => {
                        return s.intakeId === userProfile.intakeId && 
                               s.year === state.year && 
                               s.semesterInYear === state.semester;
                    });
                    matchingSemesterId = matchingSemesterEntry ? matchingSemesterEntry[0] : null;
                }
            }

            if (matchingSemesterId) {
                const reg = allRegistrations[matchingSemesterId];
                if (reg && !reg.paymentPlan) {
                    const path = Object.values(allPaths).find((p: any) => p.intakeId === userProfile.intakeId && p.programmeId === userProfile.programmeId) as any;
                    setMissingPlanPrompt({
                        semesterName: allSemesters[matchingSemesterId].name,
                        pathId: path?.id,
                        year: currentPhase.year,
                        sem: currentPhase.semester
                    });
                } else {
                    setMissingPlanPrompt(null);
                }
            }

            const coursesMap = new Map<string, Course>();
            let totalPresent = 0;
            let totalMarked = 0;
            const enrolledIds = new Set<string>();

            if (matchingSemesterId && allRegistrations[matchingSemesterId]) {
                const reg = allRegistrations[matchingSemesterId];
                if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                    const coursesArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses || {});
                    coursesArr.forEach((cid: string) => {
                        enrolledIds.add(cid);
                        const c = allCourses[cid];
                        if (c) {
                            const lecturerNames = (c.lecturerIds || [])
                                .map((id: string) => allUsers[id]?.name)
                                .filter(Boolean)
                                .join(', ') || allUsers[c.lecturerId]?.name || 'N/A';

                            const courseAssignments = allAssignments[cid] || allAssignments[`${cid}_${matchingSemesterId}`] || {};
                            let soon = 0;
                            let late = 0;
                            Object.values(courseAssignments).forEach((a: any) => {
                                if (a.submissions?.[user.uid]) return;
                                const due = parseISO(a.dueDate);
                                const today = startOfDay(getCurrentServerDate());
                                const diff = differenceInCalendarDays(due, today);
                                if (isBefore(due, today)) late++;
                                else if (diff <= 3) soon++;
                            });

                            coursesMap.set(cid, {
                                id: cid,
                                name: c.name,
                                code: c.code,
                                lecturerNames,
                                assignmentAlert: late > 0 ? { type: 'late', count: late } : soon > 0 ? { type: 'soon', count: soon } : undefined
                            });
                        }
                    });
                }
            }
            setEnrolledCourses(Array.from(coursesMap.values()));

            for (const semId in allRegistrations) {
                const reg = allRegistrations[semId];
                if (reg.courses && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                    const coursesArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses);
                    coursesArr.forEach((cid: string) => {
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
            setAttendanceRate(totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 100);

            let totalDueOverall = 0;
            Object.values(allInvoices).forEach((inv: any) => {
                const tuition = Number(inv.totalTuition || 0);
                const mandatory = Number(inv.totalMandatoryFees || 0);
                const optional = Number(inv.totalOptionalFees || 0);
                const late = Number(inv.lateFee || 0);
                const scholarPerc = Number(inv.scholarshipPercentage || 100);

                const due = inv.applyScholarship 
                    ? (tuition * (1 - (scholarPerc / 100))) + mandatory + optional + late
                    : tuition + mandatory + optional + late;
                totalDueOverall += due;
            });
            const totalPaidOverall = allTransactions.reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
            setFeeBalance(Math.max(0, totalDueOverall - totalPaidOverall));

            if (matchingSemesterId && allRegistrations[matchingSemesterId]) {
                const reg = allRegistrations[matchingSemesterId];
                const invoice = allInvoices[reg.invoiceId];
                const semester = allSemesters[matchingSemesterId];
                
                if (invoice) {
                    const tuition = Number(invoice.totalTuition || 0);
                    const mandatory = Number(invoice.totalMandatoryFees || 0);
                    const optional = Number(invoice.totalOptionalFees || 0);
                    const late = Number(invoice.lateFee || 0);
                    const scholarPerc = Number(invoice.scholarshipPercentage || 100);

                    const due = invoice.applyScholarship 
                        ? (tuition * (1 - (scholarPerc / 100))) + mandatory + optional + late
                        : tuition + mandatory + optional + late;
                    
                    const paid = allTransactions.filter((t: any) => t.invoiceId === reg.invoiceId).reduce((acc, t: any) => acc + (Number(t.amount) || 0), 0);
                    
                    setCurrentSemesterFinance({
                        due,
                        paid,
                        balance: Math.max(0, due - paid),
                        semesterName: semester?.name || 'Current Semester',
                        academicStanding: standingLabel
                    });

                    const threshold = semester.paymentThreshold || fSettings.paymentThreshold || 75;
                    const grace = semester.gracePeriodDays || 0;
                    
                    const semDeadlines = allCalendarEvents
                        .filter((ev: any) => ev.semester === semester.name && ev.title.includes('Deadline'))
                        .sort((a: any, b: any) => a.date.localeCompare(b.date));

                    const nextDeadline: any = semDeadlines.find((ev: any) => isAfter(parseISO(ev.date), getCurrentServerDate()));
                    if (nextDeadline) {
                        setPaymentDeadline({ title: nextDeadline.title.split(' - ')[0], date: nextDeadline.date });
                    }

                    const passedDeadlines = semDeadlines.filter((ev: any) => isAfter(getCurrentServerDate(), addDays(parseISO(ev.date), grace)));
                    if (passedDeadlines.length > 0) {
                        const paidPercentage = due > 0 ? (paid / due) * 100 : 100;
                        if (paidPercentage < threshold) {
                            setFinancialWarning({
                                message: `Standing Alert: Your payment level (${paidPercentage.toFixed(0)}%) is below the required ${threshold}% threshold for ${semester.name}.`,
                                restriction: true
                            });
                        }
                    }
                }
            }

            const todayName = daysOfWeek[getCurrentServerDate().getDay()];
            const scheduleMap = new Map<string, TimetableEntry>();
            const allTData = tSnap.val() || {};

            if (matchingSemesterId && enrolledIds.size > 0) {
                const relevantNodes = ['master', matchingSemesterId];
                relevantNodes.forEach(nodeId => {
                    const semesterSessions = allTData[nodeId];
                    if (!semesterSessions) return;

                    for (const cid in semesterSessions) {
                        if (!enrolledIds.has(cid)) continue;
                        const courseInfo = allCourses[cid];
                        Object.entries(semesterSessions[cid]).forEach(([entryId, entry]: [string, any]) => {
                            if (entry.day === todayName) {
                                let shouldInclude = false;
                                const entryIntake = entry.intakeName?.trim().toUpperCase();
                                const studentIntake = currentIntakeNameVal?.trim().toUpperCase();

                                if (nodeId === 'master') {
                                    shouldInclude = (studentIntake && entryIntake === studentIntake) || (entryIntake === 'MASTER');
                                } else {
                                    shouldInclude = true;
                                }

                                if (shouldInclude) {
                                    const sessionKey = `${cid}-${entry.startTime}-${entry.venue}`;
                                    const existing = scheduleMap.get(sessionKey);
                                    if (!existing || (nodeId !== 'master' && existing.semesterId === 'master')) {
                                        scheduleMap.set(sessionKey, { 
                                            ...entry, 
                                            courseCode: courseInfo?.code, 
                                            courseName: courseInfo?.name, 
                                            id: cid,
                                            semesterId: nodeId
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
            }
            setTodaySchedule(Array.from(scheduleMap.values()).sort((a,b) => a.startTime.localeCompare(b.startTime)));

            const deadlines: DeadlineEvent[] = [];
            const currentSemesterName = matchingSemesterId ? allSemesters[matchingSemesterId]?.name : null;

            allCalendarEvents.forEach((ev: any) => {
                const isFuture = new Date(ev.date) >= startOfDay(getCurrentServerDate());
                if (!isFuture) return;
                const isForThisSemester = currentSemesterName && ev.semester === currentSemesterName;
                const isGeneral = !ev.semester || ev.semester === 'General';
                const isDeadline = ev.title?.toLowerCase().includes('deadline');
                if (isForThisSemester || (isGeneral && !isDeadline)) {
                    deadlines.push({ title: ev.title, date: ev.date, type: isDeadline ? 'payment' : 'assignment' });
                }
            });
            setUpcomingDeadlines(deadlines.sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4));

            const grades: any[] = [];
            Object.keys(allAssessments).forEach(nodeId => {
                const results = allAssessments[nodeId];
                if (allSemesters[nodeId] || nodeId === 'master') {
                    Object.keys(results).forEach(cid => {
                        const studentScore = results[cid][user.uid];
                        if (studentScore) {
                            const course = allCourses[cid];
                            const template = course?.assessmentTemplateId ? allTemplates[course.assessmentTemplateId] : null;
                            Object.entries(studentScore).forEach(([key, data]: [string, any]) => {
                                if (data.score !== undefined) {
                                    let label = key === 'finalExam' ? 'Final Exam' : key;
                                    if (template && template.components?.[key]) label = template.components[key].name;
                                    grades.push({ courseCode: course?.code, label, score: data.score });
                                }
                            });
                        }
                    });
                }
            });
            setRecentGrades(grades.slice(-3));
            setLoading(false);
        });

        return () => unsub();
    }, [user, userProfile, serverTimeOffset]);

    if (authLoading || loading) return <Skeleton className="h-screen w-full" />;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight font-headline text-primary">Hello, {userProfile?.name?.split(' ')[0]}!</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground border-primary/20 bg-primary/5">{userProfile?.programmeName || 'Academic Portal'}</Badge>
                        <Badge className="font-bold bg-primary text-primary-foreground">Intake: {intakeName}</Badge>
                        {academicStanding && <Badge variant="secondary" className="gap-1.5 font-bold"><CalendarDays className="h-3 w-3" />{academicStanding}</Badge>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild><Link href="/student/registration"><PlusCircle className="mr-2 h-4 w-4"/>Registration</Link></Button>
                    <Button size="sm" asChild><Link href="/student/payments"><CreditCard className="mr-2 h-4 w-4"/>Pay Fees</Link></Button>
                </div>
            </div>

            {missingPlanPrompt && (
                <Alert className="border-orange-200 bg-orange-50/50 shadow-md animate-in fade-in slide-in-from-top-4">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <AlertTitle className="font-bold text-orange-800 uppercase text-[10px] tracking-widest">Incomplete Registration</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p className="text-orange-700 text-sm">You haven't selected a payment plan for <strong>{missingPlanPrompt.semesterName}</strong>. This is required to finalize your enrollment and generate your invoice.</p>
                        <Button size="sm" className="w-fit bg-orange-600 hover:bg-orange-700 text-white font-bold" asChild>
                            <Link href={`/student/registration/${userProfile?.intakeId}/${missingPlanPrompt.year}/${missingPlanPrompt.sem}`}>
                                Select Payment Plan <ArrowRight className="ml-2 h-4 w-4"/>
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {financialWarning && (
                <Alert variant="destructive" className="border-2 shadow-md">
                    <ShieldX className="h-5 w-5" />
                    <AlertTitle className="font-bold">Financial Standing Alert</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <p>{financialWarning.message}</p>
                        <div className="text-xs space-y-1">
                            <p className="font-bold uppercase opacity-70">Active Restrictions:</p>
                            <ul className="list-disc pl-5 opacity-90">
                                <li>Semester results are hidden</li>
                                <li>New registrations are blocked</li>
                                <li>Library borrowing suspended</li>
                            </ul>
                        </div>
                        <Button variant="outline" size="sm" className="w-fit border-destructive text-destructive font-bold" asChild><Link href="/student/payments">Pay to Restore Access</Link></Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {currentSemesterFinance ? (
                    <Card className="shadow-lg border-2 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <DollarSign className="h-4 w-4"/> Fee Summary
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase">
                                {currentSemesterFinance.academicStanding}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-70 italic font-medium text-muted-foreground">You've paid:</span>
                                <span className="font-bold text-green-600">ZMW {currentSemesterFinance.paid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-70 italic font-medium text-muted-foreground">Total supposed to pay:</span>
                                <span className="font-bold">ZMW {currentSemesterFinance.due.toFixed(2)}</span>
                            </div>
                            <Separator className="bg-primary/10"/>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-primary">Left to pay:</span>
                                <span className={cn("text-lg font-black", currentSemesterFinance.balance > 0 ? "text-destructive" : "text-green-600")}>
                                    ZMW {currentSemesterFinance.balance.toFixed(2)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Fee Summary</CardTitle><Wallet className="h-4 w-4 text-primary" /></CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-black", feeBalance > 0 ? "text-destructive" : "text-green-600")}>ZMW {feeBalance.toFixed(2)}</div>
                            <p className="text-[10px] text-muted-foreground italic mt-1 leading-tight">Fee total due will reflect once set in system</p>
                        </CardContent>
                    </Card>
                )}
                {paymentDeadline && feeBalance > 0 && (
                    <Card className="shadow-lg border-2 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2"><Clock className="h-4 w-4"/> Next Payment Due</CardTitle>
                        </CardHeader>
                        <CardContent><PaymentCountdown deadlineDate={paymentDeadline.date} title={paymentDeadline.title} /></CardContent>
                    </Card>
                )}
                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Overall Attendance</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{attendanceRate.toFixed(0)}%</div>
                        <Progress value={attendanceRate} className="h-1 mt-2" />
                    </CardContent>
                </Card>
                <Card className="shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Courses</CardTitle><BookOpen className="h-4 w-4 text-primary" /></CardHeader>
                    <CardContent><div className="text-2xl font-black">{enrolledCourses.length}</div></CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 shadow-lg border-0 bg-muted/10">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <div>
                            <CardTitle className="font-headline">Daily Schedule</CardTitle>
                            <CardDescription>{format(getCurrentServerDate(), 'EEEE, MMMM do')}</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="text-primary font-bold"><Link href="/student/timetable">Full View <ChevronRight className="ml-2 h-4 w-4"/></Link></Button>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {todaySchedule.length > 0 ? (
                            <div className="space-y-4">
                                {todaySchedule.map((entry, i) => (
                                    <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm group hover:border-primary/30 transition-all">
                                        <div className="flex flex-col items-center justify-center min-w-[80px] py-1 border-r border-primary/10 pr-4">
                                            <span className="text-sm font-black text-primary">{entry.startTime}</span>
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase">{entry.endTime}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm group-hover:text-primary transition-colors">{entry.courseCode}: {entry.courseName}</p>
                                                {entry.isLiveSession && <Video className="h-3 w-3 text-blue-600" />}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                                <MapPin className="h-3 w-3 text-primary/60" /> 
                                                {entry.isLiveSession ? "DIGITAL ROOM" : entry.venue}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" asChild><Link href={`/student/courses/${entry.id}/assignments`}><ChevronRight className="h-4 w-4 text-primary"/></Link></Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
                                <Clock className="mx-auto h-12 w-12 opacity-10 mb-2" /><p className="font-medium">No classes scheduled for today.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-lg border-l-4 border-l-primary">
                        <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">Upcoming Deadlines</CardTitle></CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((deadline, i) => (
                                <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border bg-card shadow-sm hover:scale-[1.02] transition-transform">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest">{deadline.type}</Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground">{format(parseISO(deadline.date), 'MMM dd')}</span>
                                    </div>
                                    <p className="text-xs font-bold mt-1 line-clamp-1">{deadline.title}</p>
                                </div>
                            )) : <p className="text-xs text-muted-foreground text-center py-8 italic">No urgent deadlines.</p>}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-l-4 border-l-green-500">
                        <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">Recent Academic Activity</CardTitle></CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {recentGrades.length > 0 ? recentGrades.map((grade, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-green-50/20">
                                    <div><p className="text-[10px] font-black text-green-700 uppercase tracking-tighter">{grade.courseCode}</p><p className="text-xs font-medium text-muted-foreground line-clamp-1">{grade.label}</p></div>
                                    <Badge variant={grade.score >= 50 ? 'default' : 'destructive'} className="font-mono">{grade.score}%</Badge>
                                </div>
                            )) : <p className="text-xs text-muted-foreground text-center py-8 italic">No recent results posted.</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
