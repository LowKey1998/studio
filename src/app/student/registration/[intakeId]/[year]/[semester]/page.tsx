
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ChevronLeft, Check, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, push, update } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { calculateBilling, type BillingPolicy } from '@/lib/billing-utils';

// --- TYPE DEFINITIONS ---
type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
    cost: number;
};

type Programme = {
    id: string;
    name: string;
    tuitionFee?: number;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

type Semester = {
    id: string;
    name: string;
    year: number;
    semesterInYear: number;
    mandatoryFees?: Record<string, Fee>;
    optionalFees?: Record<string, Fee>;
    paymentPlanIds?: Record<string, boolean>;
    lateRegistrationActive?: boolean;
    billingPolicy?: BillingPolicy;
    tuitionFee?: number;
    isFeesSet?: boolean;
    activeConfigId?: string;
};

type Fee = {
    id: string;
    name: string;
    amount: number;
};

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
};

type UserProfile = {
    name: string;
    programmeId: string;
    intakeId: string;
    id: string;
    exemptedCourses?: Record<string, boolean>;
};

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

const getCoursesFromReg = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((id: any) => typeof id === 'string');
    if (typeof raw === 'object') {
        return Object.keys(raw).filter(k => raw[k] === true);
    }
    return [];
};

export default function RegisterForSemesterPage() {
    const params = useParams();
    const router = useRouter();
    const { intakeId, year: yearParam, semester: semesterInYearParam } = params;

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserProfile | null>(null);

    const [programme, setProgramme] = React.useState<Programme | null>(null);
    const [coursesForSemester, setCoursesForSemester] = React.useState<Course[]>([]);
    const [semesterDetails, setSemesterDetails] = React.useState<Semester | null>(null);
    const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
    const [selectedOptionalFees, setSelectedOptionalFees] = React.useState<string[]>([]);
    const [selectedPaymentPlan, setSelectedPaymentPlan] = React.useState<string>('');
    const [applyScholarship, setApplyScholarship] = React.useState(false);
    const [billingPolicy, setBillingPolicy] = React.useState<BillingPolicy>('course');

    const [availablePaymentPlans, setAvailablePaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [paymentDeadlines, setPaymentDeadlines] = React.useState<string[]>([]);
    const [lateFee, setLateFee] = React.useState(0);
    const [isLateRegistration, setIsLateRegistration] = React.useState(false);
    const [existingRegistration, setExistingRegistration] = React.useState<any>(null);


    const [error, setError] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) setCurrentUser(user);
            else router.push('/login');
        });
        return () => unsubscribe();
    }, [router]);
    
    React.useEffect(() => {
        if (!currentUser || !yearParam || !semesterInYearParam || !intakeId) return;
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [
                    userSnap, 
                    coursePathsSnap, 
                    coursesSnap, 
                    semestersSnap, 
                    settingsSnap,
                    programmesSnap,
                    myRegsSnap
                ] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings')),
                    get(ref(db, 'programmes')),
                    get(ref(db, `registrations/${currentUser.uid}`))
                ]);

                if (!userSnap.exists()) throw new Error("Could not find your user profile.");
                const userDataVal: UserProfile = userSnap.val();
                setUserData(userDataVal);

                if (userDataVal.intakeId !== intakeId) {
                    throw new Error(`Invalid registration link. You are not authorized for this intake.`);
                }

                if (!coursePathsSnap.exists()) throw new Error("Course paths have not been set up by the administration.");

                const allCoursePathsData = coursePathsSnap.val();
                const userPath = Object.values(allCoursePathsData as Record<string, CoursePath>).find(
                    (p: CoursePath) => p.intakeId === userDataVal.intakeId && p.programmeId === userDataVal.programmeId
                );
                
                if (!userPath) throw new Error("A course path has not been defined for your intake and programme.");

                const allCourses = coursesSnap.val() || {};
                const allSemesters = semestersSnap.val() || {};
                const allSettings = settingsSnap.val() || {};
                const allProgrammes = programmesSnap.val() || {};
                const allPaymentPlansData = allSettings.paymentPlans || {};
                
                const programmeData = allProgrammes[userDataVal.programmeId];
                if (programmeData) {
                    setProgramme({ id: userDataVal.programmeId, ...programmeData });
                }

                const foundSemesterEntry = Object.entries(allSemesters as Record<string, Semester>).find(([id, sem]) => 
                    (sem as any).intakeId === intakeId && 
                    sem.year === Number(yearParam) && 
                    sem.semesterInYear === Number(semesterInYearParam)
                );
                
                if(!foundSemesterEntry) throw new Error(`Semester details could not be found.`);
                const [semesterId, semesterData] = foundSemesterEntry;

                if (!userPath.semesters || !userPath.semesters[semesterId]) {
                    throw new Error("The selected semester is not part of your defined course path.");
                }
                
                const activePolicy = semesterData.billingPolicy || allSettings.institution?.billingPolicy || 'course';
                setBillingPolicy(activePolicy);
                setSemesterDetails({id: semesterId, ...semesterData});

                if(allSettings.registrationPolicy?.lateRegistrationFee > 0 && semesterData.lateRegistrationActive) {
                    setIsLateRegistration(true);
                    setLateFee(allSettings.registrationPolicy.lateRegistrationFee);
                }

                const semesterCourseIds = userPath.semesters[semesterId]?.courses || [];
                const semesterCourses = semesterCourseIds.map((id: string) => ({ id, ...allCourses[id] }));
                setCoursesForSemester(semesterCourses);
                
                if (semesterData.paymentPlanIds) {
                    const linkedPlanIds = Object.keys(semesterData.paymentPlanIds);
                    const allPlansList = Object.keys(allPaymentPlansData).map(id => ({ id, ...allPaymentPlansData[id]}));
                    const available = allPlansList.filter(p => linkedPlanIds.includes(p.id) && !p.archived);

                    setAvailablePaymentPlans(available);
                    if(available.length > 0) setSelectedPaymentPlan(available[0].name);
                }

                const myExisting = myRegsSnap.val()?.[semesterId];
                if (myExisting) {
                    setExistingRegistration(myExisting);
                    const enrolledCourseIds = getCoursesFromReg(myExisting.courses);
                    setSelectedCourseIds(enrolledCourseIds);
                    setSelectedOptionalFees(myExisting.optionalFees || []);
                    if (myExisting.paymentPlan) setSelectedPaymentPlan(myExisting.paymentPlan);
                    setApplyScholarship(!!myExisting.applyScholarship);
                } else {
                    const initialSelectedCourses = semesterCourses
                        .map((c:Course) => c.id)
                        .filter((id:string) => !userDataVal.exemptedCourses?.[id]);
                    setSelectedCourseIds(initialSelectedCourses);
                }

            } catch (error: any) {
                console.error(error);
                setError(error.message);
                toast({ variant: 'destructive', title: 'Error', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, yearParam, semesterInYearParam, intakeId, router, toast]);

    React.useEffect(() => {
        const getDeadlines = async () => {
            const plan = availablePaymentPlans.find(p => p.name === selectedPaymentPlan);
            if(!plan || !semesterDetails) { setPaymentDeadlines([]); return;}
            
            const eventsSnapshot = await get(ref(db, 'calendarEvents'));
            const eventMap = new Map<string, string>();
            if (eventsSnapshot.exists()) { 
                Object.values(eventsSnapshot.val()).forEach((event: any) => {
                    eventMap.set(event.title.trim(), event.date);
                });
            }

            const deadlines: string[] = [];
            for (let i = 0; i < plan.installments; i++) {
                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterDetails.name}`;
                const date = eventMap.get(title.trim());
                deadlines.push(`${getOrdinalSuffix(i + 1)} Installment Due: ${date ? format(parseISO(date), 'PPP') : 'Not Set'}`);
            }
            setPaymentDeadlines(deadlines);
        };
        getDeadlines();
    }, [selectedPaymentPlan, availablePaymentPlans, semesterDetails]);

    const toggleCourseSelection = (courseId: string) => {
        if (billingPolicy === 'semester') return;
        setSelectedCourseIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const toggleOptionalFee = (feeId: string) => {
        setSelectedOptionalFees(prev => prev.includes(feeId) ? prev.filter(id => id !== feeId) : [...prev, feeId]);
    };

    const handleSubmitRegistration = async () => {
        if (!currentUser || !userData || !semesterDetails) return;
        if (selectedCourseIds.length === 0) {
            toast({ variant: 'destructive', title: 'Please select at least one course.' });
            return;
        }
        if (!selectedPaymentPlan) {
            toast({ variant: 'destructive', title: 'Please select a payment plan.' });
            return;
        }

        setSaving(true);
        try {
            const registrationId = semesterDetails.id;
            const registrationRef = ref(db, `registrations/${currentUser.uid}/${registrationId}`);
            
            let invoiceId = existingRegistration?.invoiceId;
            let invoiceRef;
            if (invoiceId) {
                invoiceRef = ref(db, `invoices/${currentUser.uid}/${invoiceId}`);
            } else {
                invoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
                invoiceId = invoiceRef.key!;
            }

            const breakdown = calculateBilling({
                policy: billingPolicy,
                semesterTuition: semesterDetails.tuitionFee || programme?.tuitionFee || 0,
                courses: selectedCourseIds.map(id => ({ id, cost: coursesForSemester.find(c => c.id === id)?.cost || 0 })),
                mandatoryFees: Object.values(semesterDetails.mandatoryFees || {}),
                optionalFees: selectedOptionalFees.map(id => ({ name: semesterDetails.optionalFees?.[id]?.name || 'Fee', amount: semesterDetails.optionalFees?.[id]?.amount || 0 })),
                applyScholarship: applyScholarship,
                scholarshipPercentage: existingRegistration?.scholarshipPercentage || 0,
                lateFee: isLateRegistration ? lateFee : 0
            });

            const invoiceData = {
                invoiceId,
                totalTuition: breakdown.baseTuition,
                totalMandatoryFees: breakdown.totalMandatoryFees,
                totalOptionalFees: breakdown.totalOptionalFees,
                lateFee: breakdown.lateFee,
                paymentPlan: selectedPaymentPlan,
                dateCreated: existingRegistration?.registrationDate || new Date().toISOString(),
                semester: semesterDetails.name,
                semesterId: semesterDetails.id,
                courses: selectedCourseIds,
                optionalFees: selectedOptionalFees,
                applyScholarship: applyScholarship,
                configId: semesterDetails.activeConfigId || null 
            };

            const registrationData = {
                courses: selectedCourseIds,
                optionalFees: selectedOptionalFees,
                invoiceId,
                status: existingRegistration?.status || 'Pending Approval',
                paymentPlan: selectedPaymentPlan,
                programmeId: userData.programmeId,
                registrationDate: existingRegistration?.registrationDate || new Date().toISOString(),
                applyScholarship: applyScholarship,
                semesterName: semesterDetails.name,
                source: 'manual',
                configId: semesterDetails.activeConfigId || null 
            };

            await set(invoiceRef, invoiceData);
            await set(registrationRef, registrationData);
            
            if (!existingRegistration || existingRegistration.status === 'Pending Approval') {
                const registrarIds = await getRegistrarIds();
                if (registrarIds.length > 0) {
                    await createNotification(
                        registrarIds, 
                        `${userData.name} has ${existingRegistration ? 'updated' : 'submitted'} their registration for review.`,
                        '/admin/approve-registrations'
                    );
                }
            }

            toast({ variant: 'success', title: existingRegistration ? "Details Updated" : "Registration Submitted!", description: "Your requirements have been saved." });
            router.push('/student/payments');

        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Action failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) return <div className="space-y-4"><Skeleton className="h-96 w-full"/></div>

    if (error) {
        return (
             <div className="space-y-6">
                <Button variant="outline" asChild><Link href="/student/registration"><ChevronLeft className="mr-2 h-4 w-4"/>Back to Semesters</Link></Button>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Registration Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        )
    }

    const isLocked = billingPolicy === 'semester';

    return (
        <div className="space-y-6">
            <Button variant="outline" asChild><Link href="/student/registration"><ChevronLeft className="mr-2 h-4 w-4"/>Back to Semesters</Link></Button>
            
            {existingRegistration && !existingRegistration.paymentPlan && (
                <Alert className="bg-orange-50 border-orange-200 shadow-md">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <AlertTitle className="font-bold text-orange-800">Final Step Required</AlertTitle>
                    <AlertDescription className="text-orange-700 text-sm">You are enrolled in classes, but you must select a payment plan below to generate your invoice and complete your registration.</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">
                        {existingRegistration && !existingRegistration.paymentPlan ? 'Complete Semester Setup' : (existingRegistration ? 'Edit Registration' : 'Register for Semester')}
                    </CardTitle>
                    <CardDescription>Confirm your courses, select fees and a payment plan to complete your registration for <strong>{semesterDetails?.name}</strong>.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="space-y-2">
                        <h3 className="font-semibold">Courses for this Semester</h3>
                        {isLocked && (
                            <Alert className="bg-primary/5 border-primary/20">
                                <Info className="h-4 w-4 text-primary"/>
                                <AlertDescription className="text-xs">This programme follows a <strong>Flat Semester Fee</strong> policy. All listed courses are required for the session.</AlertDescription>
                            </Alert>
                        )}
                        <div className="grid md:grid-cols-2 gap-2">
                            {coursesForSemester.map(course => (
                                <div key={course.id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/50 shadow-sm">
                                    <Checkbox 
                                        id={course.id} 
                                        checked={selectedCourseIds.includes(course.id)} 
                                        onCheckedChange={() => toggleCourseSelection(course.id)}
                                        disabled={isLocked || !!userData?.exemptedCourses?.[course.id] || (existingRegistration && existingRegistration.status === 'Completed')}
                                    />
                                    <Label htmlFor={course.id} className={`flex-1 ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
                                        <p className="font-medium">{course.name}</p>
                                        <p className="text-xs text-muted-foreground">{course.code} {!isLocked && `- ZMW ${course.cost.toFixed(2)}`}</p>
                                    </Label>
                                    {!!userData?.exemptedCourses?.[course.id] && <Badge variant="secondary">Exempted</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <h3 className="font-semibold">Semester Fees</h3>
                        <div className="grid md:grid-cols-2 gap-2">
                             {Object.entries(semesterDetails?.mandatoryFees || {}).map(([id, fee]) => (
                                <div key={id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
                                    <Checkbox id={`mand-${id}`} checked disabled/>
                                    <Label htmlFor={`mand-${id}`} className="flex-1 cursor-default">
                                        <p className="text-sm font-medium">{fee.name} <Badge variant="destructive" className="h-4 text-[8px] uppercase">Required</Badge></p>
                                        <p className="text-xs text-muted-foreground">ZMW {fee.amount.toFixed(2)}</p>
                                    </Label>
                                </div>
                             ))}
                             {Object.entries(semesterDetails?.optionalFees || {}).map(([id, fee]) => (
                                <div key={id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
                                    <Checkbox id={id} checked={selectedOptionalFees.includes(id)} onCheckedChange={() => toggleOptionalFee(id)} disabled={existingRegistration && existingRegistration.status === 'Completed'}/>
                                    <Label htmlFor={id} className="flex-1 cursor-pointer">
                                        <p className="text-sm font-medium">{fee.name}</p>
                                        <p className="text-xs text-muted-foreground">ZMW {fee.amount.toFixed(2)}</p>
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    {isLateRegistration && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Late Registration</AlertTitle>
                            <AlertDescription>A late registration fee of <strong>ZMW {lateFee.toFixed(2)}</strong> will be added to your invoice.</AlertDescription>
                        </Alert>
                    )}
                    <Separator />
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="font-bold">Payment Plan</Label>
                            <Select value={selectedPaymentPlan} onValueChange={setSelectedPaymentPlan} disabled={existingRegistration && !!existingRegistration.paymentPlan && existingRegistration.status !== 'Pending Approval'}>
                                <SelectTrigger><SelectValue placeholder="Select a payment plan..." /></SelectTrigger>
                                <SelectContent>{availablePaymentPlans.map(p => <SelectItem key={p.id} value={p.name}>{p.name} ({p.installments} installment{p.installments > 1 ? 's' : ''})</SelectItem>)}</SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground space-y-1 pt-2 bg-muted/30 p-2 rounded border border-dashed mt-2">
                                {paymentDeadlines.map(d => <p key={d} className="flex items-center gap-2"><Clock className="h-3 w-3"/> {d}</p>)}
                            </div>
                        </div>
                         <div className="flex items-end">
                            <div className="flex items-center space-x-2 p-4 border rounded-lg bg-blue-50/50">
                                <Checkbox id="apply-scholarship" checked={applyScholarship} onCheckedChange={c => setApplyScholarship(!!c)} disabled={existingRegistration && existingRegistration.status === 'Completed'}/>
                                <Label htmlFor="apply-scholarship" className="cursor-pointer">
                                    <p className="font-bold text-blue-700">I am on Scholarship/Apply for Scholarship</p>
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button size="lg" onClick={handleSubmitRegistration} disabled={saving || !semesterDetails?.isFeesSet}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {semesterDetails?.isFeesSet ? (existingRegistration ? 'Update My Details' : 'Complete & Submit Registration') : 'Fees Not Finalized by Admin'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
