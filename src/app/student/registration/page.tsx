'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ChevronRight, BookCopy, CheckCircle2, Clock, UserCheck, Calendar as CalendarIcon, AlertCircle, Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';
import { logError } from '@/lib/error-logger';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type UserProfile = { intakeId: string; programmeId: string; programmeName: string; intakeName: string; };
type Course = { id: string; name: string; code: string; lecturerNames: string; timetable: string[]; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, { courses: string[] }>; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type SemesterWithStatus = Semester & { isRegistered: boolean; hasPaymentPlan: boolean; isOpen: boolean; courses: Course[]; deadlines: { title: string; date: string | null }[]; isMissingDeadlines: boolean; isCurrentStanding: boolean; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [semestersForPath, setSemestersForPath] = React.useState<SemesterWithStatus[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [uSnap, pSnap, iSnap, cpSnap, soSnap, rSnap, cSnap, sSnap, usersSnap, eventsSnap, timetablesSnap, plansSnap, calSnap] = await Promise.all([
                get(ref(db, `users/${currentUser.uid}`)), 
                get(ref(db, 'programmes')), 
                get(ref(db, 'intakes')),
                get(ref(db, 'coursePaths')), 
                get(ref(db, 'semesterOfferings')), 
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'courses')), 
                get(ref(db, 'semesters')),
                get(ref(db, 'users')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'settings/academicCalendar'))
            ]);
            
            if (!uSnap.exists()) return;
            const profile = uSnap.val();
            setUserProfile({ 
                ...profile, 
                programmeName: pSnap.val()?.[profile.programmeId]?.name || 'Unknown', 
                intakeName: iSnap.val()?.[profile.intakeId]?.name || 'Unknown' 
            });
            
            const userPath = Object.values(cpSnap.val() || {}).find((p: any) => p.intakeId === profile.intakeId && p.programmeId === profile.programmeId) as any;
            if (!userPath) { setSemestersForPath([]); setLoading(false); return; }
            
            const intakeName = iSnap.val()?.[profile.intakeId]?.name;
            const intakeStartStr = intakeName ? parseIntakeDate(intakeName) : null;
            const calSettings = calSnap.val();
            let currentStanding: { year: number, semester: number } | null = null;

            if (intakeStartStr && calSettings) {
                currentStanding = calculateAcademicState(
                    intakeStartStr,
                    new Date(),
                    calSettings.standardCycles,
                    Object.values(calSettings.anomalies || {})
                );
            }

            const offerings = soSnap.val() || {};
            const regs = rSnap.val() || {};
            const sData = sSnap.val() || {};
            const cData = cSnap.val() || {};
            const allUsers = usersSnap.val() || {};
            const eventsData = eventsSnap.val() || {};
            const timetablesData = timetablesSnap.val() || {};
            const plansData = plansSnap.val() || {};

            const list: SemesterWithStatus[] = [];
            
            if (userPath.semesters) {
                for (const semId in userPath.semesters) {
                    const details = sData[semId];
                    if (!details || details.status === 'Archived' || details.intakeId !== profile.intakeId) continue;
                    
                    const isOfferingActive = !!offerings[userPath.id]?.[semId]?.active;
                    const registration = regs[semId];
                    const isRegistered = !!(registration?.courses?.length > 0);
                    const hasPaymentPlan = !!registration?.paymentPlan;
                    const isCurrentStanding = !!(currentStanding && details.year === currentStanding.year && details.semesterInYear === currentStanding.semester);
                    
                    const courses = (userPath.semesters[semId].courses || []).map((id: string) => {
                        const course = cData[id];
                        const lecturerNames = (course?.lecturerIds || []).map((lid: string) => allUsers[lid]?.name).filter(Boolean).join(', ') || allUsers[course?.lecturerId || '']?.name || 'Unassigned';
                        const timetable = timetablesData[semId]?.[id] ? Object.values(timetablesData[semId][id]).map((t: any) => `${t.day.substring(0,3)} ${t.startTime}`) : [];
                        return { id, name: course?.name, code: course?.code, lecturerNames, timetable };
                    });

                    const deadlines: { title: string; date: string | null }[] = [];
                    let isMissingDeadlines = false;
                    const linkedPlanIds = Object.keys(details.paymentPlanIds || {});
                    linkedPlanIds.forEach(pid => {
                        const plan = plansData[pid];
                        if (plan && !plan.archived) {
                            for (let i = 0; i < plan.installments; i++) {
                                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${details.name}`;
                                const event = Object.values(eventsData).find((e: any) => e.title?.trim() === title.trim()) as any;
                                if (!event) isMissingDeadlines = true;
                                deadlines.push({ title: `${plan.name} ${getOrdinalSuffix(i + 1)}`, date: event?.date || null });
                            }
                        }
                    });

                    list.push({ 
                        ...details, 
                        id: semId, 
                        isRegistered, 
                        hasPaymentPlan,
                        isOpen: isOfferingActive, 
                        courses,
                        deadlines,
                        isMissingDeadlines,
                        isCurrentStanding
                    });
                }
            }
            setSemestersForPath(list.sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));
        } catch (error: any) { 
            logError(error.message, 'Registration Fetch', error);
            toast({ variant: 'destructive', title: 'Error loading semesters' }); 
        }
        finally { setLoading(false); }
    }, [currentUser, toast]);

    React.useEffect(() => { if(currentUser) fetchData(); }, [currentUser, fetchData]);
    
    if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
    
    return (
        <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>{userProfile?.programmeName} &middot; {userProfile?.intakeName}</CardDescription>
                </CardHeader>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-primary"/> My Academic Path</CardTitle>
                    <CardDescription>View available semesters and complete your enrollment requirements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {semestersForPath.length > 0 ? semestersForPath.map(sem => (
                        <Card key={sem.id} className={cn("overflow-hidden border-l-4", (sem.isRegistered && sem.hasPaymentPlan) ? "border-l-green-500" : (sem.isRegistered ? "border-l-orange-500" : (sem.isOpen ? "border-l-primary" : "border-l-muted")))}>
                            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl">{sem.name}</CardTitle>
                                        {sem.isCurrentStanding && <Badge className="bg-primary text-white text-[10px] uppercase font-black tracking-tighter h-5">Current Standing</Badge>}
                                    </div>
                                    <CardDescription>Year {sem.year}, Semester {sem.semesterInYear}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    {sem.isRegistered ? (
                                        sem.hasPaymentPlan ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-4 py-1">
                                                <CheckCircle2 className="mr-2 h-4 w-4"/>Registered
                                            </Badge>
                                        ) : (
                                            <Button asChild variant="secondary" className={cn("font-bold", sem.isCurrentStanding ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-muted text-muted-foreground")}>
                                                <Link href={`/student/registration/${sem.intakeId}/${sem.year}/${sem.semesterInYear}`}>
                                                    <AlertCircle className="mr-2 h-4 w-4"/>
                                                    {sem.isCurrentStanding ? "Complete Setup" : "Pending Setup"}
                                                </Link>
                                            </Button>
                                        )
                                    ) : sem.isOpen ? (
                                        <Button asChild>
                                            <Link href={`/student/registration/${sem.intakeId}/${sem.year}/${sem.semesterInYear}`}>
                                                Register Now <ChevronRight className="ml-2 h-4 w-4"/>
                                            </Link>
                                        </Button>
                                    ) : (
                                        <Button disabled variant="secondary" className="opacity-50 cursor-not-allowed">
                                            Registration Closed <ChevronRight className="ml-2 h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pb-6">
                                {!sem.hasPaymentPlan && sem.isRegistered && sem.isCurrentStanding && (
                                    <Alert className="bg-orange-50 border-orange-200">
                                        <AlertCircle className="h-4 w-4 text-orange-600" />
                                        <AlertTitle className="text-orange-800 font-bold">Action Required</AlertTitle>
                                        <AlertDescription className="text-orange-700">You are enrolled in classes but have not yet selected a payment plan. Click "Complete Setup" to finalize your financial requirements.</AlertDescription>
                                    </Alert>
                                )}
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                            <BookCopy className="h-3 w-3" /> Proposed Courses
                                        </Label>
                                        <div className="grid gap-2">
                                            {sem.courses.map(course => (
                                                <div key={course.id} className="p-2 border rounded bg-muted/20">
                                                    <div className="flex justify-between items-start text-sm font-semibold">
                                                        <span>{course.code} - {course.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                                                        <UserCheck className="h-3 w-3" /> {course.lecturerNames}
                                                    </div>
                                                    {course.timetable.length > 0 && (
                                                        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                                                            <Clock className="h-3 w-3" /> 
                                                            {course.timetable.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                            <CalendarIcon className="h-3 w-3" /> Important Deadlines
                                        </Label>
                                        <div className="space-y-2">
                                            {sem.deadlines.length > 0 ? sem.deadlines.map((d, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs p-2 rounded border border-dashed">
                                                    <span>{d.title}</span>
                                                    {d.date ? (
                                                        <span className="font-bold">{format(parseISO(d.date), 'PPP')}</span>
                                                    ) : (
                                                        <span className="text-destructive font-bold italic">Not Set</span>
                                                    )}
                                                </div>
                                            )) : (
                                                <p className="text-xs text-muted-foreground italic">No specific deadlines published.</p>
                                            )}
                                            {sem.isMissingDeadlines && (
                                                <Alert variant="default" className="py-2 bg-yellow-50 border-yellow-200">
                                                    <Info className="h-3 w-3 text-yellow-600" />
                                                    <AlertDescription className="text-[10px] text-yellow-700">
                                                        Administration is still finalizing some dates.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <Alert>
                            <Info className="h-4 w-4"/><AlertTitle>No Active Paths</AlertTitle>
                            <AlertDescription>There are currently no active registration paths for your intake and programme.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}