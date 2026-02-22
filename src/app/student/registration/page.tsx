'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Loader2, 
    Info, 
    ChevronRight, 
    BookCopy, 
    CheckCircle2, 
    Clock, 
    UserCheck, 
    Calendar as CalendarIcon, 
    AlertCircle, 
    Route, 
    Receipt, 
    DollarSign, 
    CalendarDays, 
    Tag, 
    Trash2, 
    Pencil, 
    X, 
    Wallet, 
    GraduationCap 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue, update, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInCalendarDays, isBefore, startOfDay } from 'date-fns';
import { Label } from '@/components/ui/label';
import { calculateAcademicState, parseIntakeDate, calculateSemesterDateRange } from '@/lib/semester-utils';
import { Separator } from '@/components/ui/separator';
import { calculateBilling, type BillingPolicy } from '@/lib/billing-utils';

type UserProfile = { intakeId: string; programmeId: string; programmeName: string; intakeName: string; exemptedCourses?: Record<string, boolean>; };
type Course = { id: string; name: string; code: string; lecturerNames: string; timetable: string[]; cost: number; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; billingPolicy?: BillingPolicy; tuitionFee?: number; mandatoryFees?: Record<string, {name: string, amount: number}>; optionalFees?: Record<string, {name: string, amount: number}>; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

type SemesterWithStatus = Semester & { 
    isRegistered: boolean; 
    hasPaymentPlan: boolean; 
    isOpen: boolean; 
    courses: Course[]; 
    deadlines: { title: string; date: string | null }[]; 
    isMissingDeadlines: boolean; 
    isCurrentStanding: boolean;
    selectedPaymentPlan?: string;
    billingBreakdown: ReturnType<typeof calculateBilling>;
    source: 'auto' | 'manual';
    statusInDb?: 'Pending Approval' | 'Pending Payment' | 'Completed';
    invoiceId?: string;
};

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

const getCoursesFromReg = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(id => typeof id === 'string');
    if (typeof raw === 'object') {
        const values = Object.values(raw);
        if (values.every(v => typeof v === 'boolean')) return Object.keys(raw);
        return values.filter(v => typeof v === 'string') as string[];
    }
    return [];
};

export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [semestersForPath, setSemestersForPath] = React.useState<SemesterWithStatus[]>([]);
    const { toast } = useToast();

    const hasInitialized = React.useRef(false);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => { 
            if(user) setCurrentUser(user);
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        
        if (!hasInitialized.current) setLoading(true);

        try {
            const dbRef = ref(db);
            const snapshot = await get(dbRef);
            if (!snapshot.exists()) return;
            const data = snapshot.val();

            const userProfileData = data.users[currentUser.uid];
            if (!userProfileData) return;

            const profileMeta = { 
                ...userProfileData, 
                programmeName: data.programmes?.[userProfileData.programmeId]?.name || 'Unknown', 
                intakeName: data.intakes?.[userProfileData.intakeId]?.name || 'Unknown' 
            };
            setUserProfile(profileMeta);
            
            const coursePathsData = data.coursePaths || {};
            const userPathEntry = Object.entries(coursePathsData).find(([_, p]: [string, any]) => 
                p.intakeId === userProfileData.intakeId && p.programmeId === userProfileData.programmeId
            );

            if (!userPathEntry) { 
                setSemestersForPath([]); 
                setLoading(false); 
                return; 
            }
            const [userPathId, userPath] = userPathEntry as [string, any];
            
            const intakeName = profileMeta.intakeName;
            const intakeStartStr = intakeName ? parseIntakeDate(intakeName) : null;
            const calSettings = data.settings?.academicCalendar || {};
            const globalInstSettings = data.settings?.institution || { billingPolicy: 'course' };
            const invoicesData = data.invoices?.[currentUser.uid] || {};
            const plansData = data.settings?.paymentPlans || {};

            let currentStanding: { year: number, semester: number } | null = null;
            if (intakeStartStr && calSettings) {
                currentStanding = calculateAcademicState(
                    intakeStartStr,
                    new Date(),
                    calSettings.standardCycles || [],
                    Object.values(calSettings.anomalies || {})
                );
            }

            const offerings = data.semesterOfferings || {};
            const regs = data.registrations?.[currentUser.uid] || {};
            const sData = data.semesters || {};
            const cData = data.courses || {};
            const allUsers = data.users || {};
            const eventsData = Object.values(data.calendarEvents || {}) as any[];

            const list: SemesterWithStatus[] = [];
            
            if (userPath.semesters) {
                for (const semId in userPath.semesters) {
                    const details = sData[semId];
                    if (!details || details.status === 'Archived' || details.intakeId !== userProfileData.intakeId) continue;
                    
                    const isOfferingActive = !!offerings[userPathId]?.[semId]?.active;
                    const registration = regs[semId];
                    const enrolledCourseIds = getCoursesFromReg(registration?.courses);

                    const isRegistered = enrolledCourseIds.length > 0;
                    const hasPaymentPlan = !!registration?.paymentPlan;
                    const isCurrentStanding = !!(currentStanding && details.year === currentStanding.year && details.semesterInYear === currentStanding.semester);
                    
                    const courses = (userPath.semesters[semId].courses || []).map((id: string) => {
                        const course = cData[id];
                        const lecturerNames = (course?.lecturerIds || []).map((lid: string) => allUsers[lid]?.name).filter(Boolean).join(', ') || allUsers[course?.lecturerId || '']?.name || 'Unassigned';
                        const timetable = data.timetables?.[semId]?.[id] ? Object.values(data.timetables[semId][id]).map((t: any) => `${t.day.substring(0,3)} ${t.startTime}`) : [];
                        return { id, name: course?.name, code: course?.code, lecturerNames, timetable, cost: Number(course?.cost || 0) };
                    });

                    const deadlines: { title: string; date: string | null }[] = [];
                    let isMissingDeadlines = false;
                    const linkedPlanIds = Object.keys(details.paymentPlanIds || {});
                    linkedPlanIds.forEach(pid => {
                        const plan = plansData[pid];
                        if (plan && !plan.archived) {
                            for (let i = 0; i < plan.installments; i++) {
                                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${details.name}`;
                                const event = eventsData.find((e: any) => e.title?.trim() === title.trim());
                                if (!event) isMissingDeadlines = true;
                                deadlines.push({ title: `${plan.name} ${getOrdinalSuffix(i + 1)}`, date: event?.date || null });
                            }
                        }
                    });

                    const invoice = invoicesData[registration?.invoiceId];
                    const activePolicy = details.billingPolicy || globalInstSettings.billingPolicy || 'course';

                    const activeCoursesForBilling = isRegistered 
                        ? enrolledCourseIds.map(id => ({ id, cost: Number(cData[id]?.cost || 0) }))
                        : courses.map(c => ({ id: c.id, cost: Number(c.cost || 0) }));

                    const breakdown = calculateBilling({
                        policy: activePolicy,
                        semesterTuition: Number(details.tuitionFee || 0),
                        courses: activeCoursesForBilling,
                        mandatoryFees: Object.values(details.mandatoryFees || {}).map((f:any) => ({ name: f.name, amount: Number(f.amount || 0) })),
                        optionalFees: (registration?.optionalFees || []).map((fid:string) => ({ name: details.optionalFees?.[fid]?.name || 'Fee', amount: Number(details.optionalFees?.[fid]?.amount || 0) })),
                        applyScholarship: !!registration?.applyScholarship,
                        scholarshipPercentage: Number(registration?.scholarshipPercentage || 0),
                        lateFee: Number(invoice?.lateFee || 0)
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
                        isCurrentStanding,
                        selectedPaymentPlan: registration?.paymentPlan,
                        billingBreakdown: breakdown,
                        billingPolicy: activePolicy,
                        source: registration?.source || 'manual',
                        statusInDb: registration?.status,
                        invoiceId: registration?.invoiceId
                    });
                }
            }
            setSemestersForPath(list.sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));
            hasInitialized.current = true;
            setLoading(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Error loading semesters' }); 
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => { 
        if(currentUser) {
            fetchData();
            const rootRef = ref(db);
            const unsub = onValue(rootRef, () => fetchData());
            return () => unsub();
        }
    }, [currentUser, fetchData]);

    const handleCancelRegistration = async (sem: SemesterWithStatus) => {
        if (!currentUser) return;
        if (!window.confirm("Are you sure? All selected courses and pending invoices will be removed.")) return;
        
        setActionLoading(sem.id);
        try {
            const updates: Record<string, any> = {};
            updates[`registrations/${currentUser.uid}/${sem.id}`] = null;
            if (sem.invoiceId) updates[`invoices/${currentUser.uid}/${sem.invoiceId}`] = null;
            await update(ref(db), updates);
            toast({ title: 'Registration Canceled' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setActionLoading(null);
        }
    }
    
    if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
    
    return (
        <div className="space-y-6">
            <Card className="border-primary/20 shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>{userProfile?.programmeName} &middot; {userProfile?.intakeName}</CardDescription>
                </CardHeader>
            </Card>

            <Card className="shadow-lg border-0 bg-muted/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-primary"/> My Academic Path</CardTitle>
                    <CardDescription>View available semesters and complete your enrollment requirements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {semestersForPath.length > 0 ? semestersForPath.map(sem => {
                        const isActionable = sem.isRegistered || sem.isOpen;
                        const billingBreakdown = sem.billingBreakdown;
                        const grandTotal = billingBreakdown?.grandTotal || 0;

                        const isManual = sem.source === 'manual';
                        const isApproved = sem.statusInDb === 'Pending Payment' || sem.statusInDb === 'Completed';
                        const isCompleted = sem.statusInDb === 'Completed';

                        return (
                        <Card key={sem.id} className={cn("overflow-hidden border-l-4 transition-all", (sem.isRegistered && sem.hasPaymentPlan) ? "border-l-green-500" : (sem.isRegistered ? "border-l-orange-500" : (sem.isOpen ? "border-l-primary" : "border-l-muted")))}>
                            <CardHeader className="bg-muted/30 py-4 px-6">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <CardTitle className="text-xl leading-tight">{sem.name}</CardTitle>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {sem.isCurrentStanding && <Badge className="bg-primary text-white text-[10px] uppercase font-black tracking-tighter h-5">Current Standing</Badge>}
                                                {sem.isRegistered && <Badge variant="secondary" className="text-[8px] uppercase font-black tracking-widest h-4 opacity-60">{sem.source} registration</Badge>}
                                            </div>
                                        </div>
                                        <CardDescription className="font-medium">Year {sem.year}, Semester {sem.semesterInYear}</CardDescription>
                                    </div>
                                    <div className="flex gap-2 flex-wrap md:justify-end">
                                        {sem.isRegistered ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {isManual && !isCompleted && (
                                                    <Button variant="ghost" size="sm" className="text-destructive h-8 text-[10px] font-bold" onClick={() => handleCancelRegistration(sem)} disabled={!!actionLoading}>
                                                        {actionLoading === sem.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <X className="h-3 w-3 mr-1"/>}
                                                        Cancel Registration
                                                    </Button>
                                                )}
                                                
                                                {isManual && !isApproved ? (
                                                    <Button asChild size="sm" variant="outline" className="h-8 shadow-sm">
                                                        <Link href={`/student/registration/${userProfile?.intakeId}/${sem.year}/${sem.semesterInYear}`}>
                                                            <Pencil className="h-3 w-3 mr-1.5"/> Edit Selection
                                                        </Link>
                                                    </Button>
                                                ) : sem.hasPaymentPlan ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-4 py-1 font-bold">
                                                        <CheckCircle2 className="mr-2 h-4 w-4"/>Registered
                                                    </Badge>
                                                ) : (
                                                    sem.isCurrentStanding ? (
                                                        <Button asChild variant="secondary" className="font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-sm h-8">
                                                            <Link href={`/student/registration/${userProfile?.intakeId}/${sem.year}/${sem.semesterInYear}`}>
                                                                <AlertCircle className="mr-2 h-4 w-4"/>
                                                                Complete Setup
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground px-4 py-1 opacity-60 h-8">
                                                            <Clock className="mr-2 h-4 w-4"/>Registered (Pending Plan)
                                                        </Badge>
                                                    )
                                                )}
                                            </div>
                                        ) : sem.isOpen ? (
                                            <Button asChild className="h-8 shadow-md">
                                                <Link href={`/student/registration/${userProfile?.intakeId}/${sem.year}/${sem.semesterInYear}`}>
                                                    Register Now <ChevronRight className="ml-2 h-4 w-4"/>
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button disabled variant="secondary" className="h-8 opacity-50 cursor-not-allowed">
                                                Registration Closed
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6 pb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                <BookCopy className="h-3 w-3" /> Active Curriculum
                                            </Label>
                                            <div className="grid gap-2">
                                                {sem.courses.map(course => (
                                                    <div key={course.id} className="p-3 border rounded-xl bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-4 shadow-sm">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-bold text-sm leading-tight">{course.name}</span>
                                                                <span className="text-[10px] font-mono text-primary/70">{course.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1.5">
                                                                <UserCheck className="h-3 w-3" /> {course.lecturerNames}
                                                            </div>
                                                        </div>
                                                        {sem.billingPolicy === 'course' && (
                                                            <Badge variant="outline" className="h-6 font-mono text-[10px] bg-background border-primary/20 shrink-0">
                                                                ZMW {course.cost.toFixed(2)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {isActionable && billingBreakdown && (
                                            <div className="space-y-3 p-5 border rounded-2xl bg-primary/5 shadow-inner">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                                                    <Wallet className="h-3 w-3" /> {sem.isRegistered ? "Financial Summary" : "Projected Costs"}
                                                </Label>
                                                <div className="space-y-2.5 text-xs font-medium">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex justify-between font-bold border-b border-primary/10 pb-1">
                                                            <span className="opacity-70 italic">Tuition Additions {sem.billingPolicy === 'semester' ? '(Flat Rate)' : `(${billingBreakdown.courses?.length || 0} Courses)`}:</span>
                                                            <span>ZMW {billingBreakdown.baseTuition.toFixed(2)}</span>
                                                        </div>
                                                        {sem.billingPolicy === 'course' && billingBreakdown.courses && billingBreakdown.courses.length > 0 && (
                                                            <div className="pl-4 space-y-1 mt-1 border-l-2 border-primary/10 ml-1">
                                                                {billingBreakdown.courses.map(c => {
                                                                    const courseMeta = sem.courses.find(cm => cm.id === c.id);
                                                                    return (
                                                                        <div key={c.id} className="flex justify-between text-[10px] opacity-60 italic">
                                                                            <span className="truncate pr-2">+ {courseMeta?.code} {courseMeta?.name}</span>
                                                                            <span className="shrink-0">ZMW {c.cost.toFixed(2)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {billingBreakdown.scholarshipAmount > 0 && (
                                                        <div className="flex justify-between text-blue-600 font-bold">
                                                            <span className="opacity-70 flex items-center gap-1.5"><GraduationCap className="h-3 w-3"/> Scholarship Credit:</span>
                                                            <span>- ZMW {billingBreakdown.scholarshipAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {billingBreakdown.totalMandatoryFees > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="opacity-70">Mandatory Fees:</span>
                                                            <span className="font-bold">ZMW {billingBreakdown.totalMandatoryFees.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {billingBreakdown.totalOptionalFees > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="opacity-70">Optional Fees:</span>
                                                            <span className="font-bold">ZMW {billingBreakdown.totalOptionalFees.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {billingBreakdown.lateFee > 0 && (
                                                        <div className="flex justify-between text-destructive font-bold">
                                                            <span className="opacity-70">Late Registration Fee:</span>
                                                            <span>ZMW {billingBreakdown.lateFee.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <Separator className="my-2 bg-primary/10"/>
                                                    <div className="flex justify-between items-baseline pt-1">
                                                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">Total Invoiced</span>
                                                        <span className="text-lg font-black text-primary">ZMW {grandTotal.toFixed(2)}</span>
                                                    </div>
                                                    {sem.hasPaymentPlan && (
                                                        <div className="flex justify-between pt-3 border-t border-dashed border-primary/20 mt-2">
                                                            <span className="opacity-70 flex items-center gap-1.5 font-bold"><Wallet className="h-3 w-3"/> Payment Plan:</span>
                                                            <Badge variant="outline" className="h-5 text-[9px] font-black uppercase bg-primary text-white border-primary px-3 shadow-sm">{sem.selectedPaymentPlan}</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                            <CalendarIcon className="h-3 w-3" /> Institutional Deadlines
                                        </Label>
                                        <div className="space-y-2.5">
                                            {sem.deadlines.length > 0 ? sem.deadlines.map((d, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs p-3 rounded-xl border border-dashed hover:bg-muted/30 transition-colors bg-card shadow-sm">
                                                    <span className="font-bold opacity-80">{d.title}</span>
                                                    {d.date ? (
                                                        <span className="font-black text-primary">{format(parseISO(d.date), 'dd MMM yyyy')}</span>
                                                    ) : (
                                                        <span className="text-destructive font-black italic text-[10px]">Pending Publication</span>
                                                    )}
                                                </div>
                                            )) : (
                                                <div className="py-12 text-center border-2 border-dashed rounded-2xl bg-muted/5 flex flex-col items-center gap-3">
                                                    <Clock className="h-8 w-8 opacity-10"/>
                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest leading-relaxed">Schedule currently being<br/>finalized by academics</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        );
                    }) : (
                        <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-muted/5">
                            <Route className="h-12 w-12 mx-auto opacity-10 mb-4" />
                            <h3 className="text-lg font-bold">No Active Pathways</h3>
                            <p className="text-sm text-muted-foreground max-xs mx-auto">There are currently no active registration windows open for your specific intake and programme path.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
