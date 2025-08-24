
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, push, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

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
    mandatoryFees?: Record<string, Fee>;
    optionalFees?: Record<string, Fee>;
    paymentPlanIds?: Record<string, boolean>;
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
    exemptedCourses?: Record<string, boolean>;
};

export default function RegisterForSemesterPage() {
    const params = useParams();
    const router = useRouter();
    const { year: yearParam, semester: semesterInYearParam } = params;

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

    const [availablePaymentPlans, setAvailablePaymentPlans] = React.useState<PaymentPlan[]>([]);
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
        if (!currentUser || !yearParam || !semesterInYearParam) return;
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Step 1: Get all necessary data in parallel
                const [
                    userSnap, 
                    coursePathsSnap, 
                    coursesSnap, 
                    semestersSnap, 
                    paymentPlansSnap, 
                    programmesSnap,
                    intakesSnap,
                    semesterOfferingsSnap
                ] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings/paymentPlans')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes')),
                    get(ref(db, 'semesterOfferings'))
                ]);

                // Step 2: Validate user and find their correct course path
                if (!userSnap.exists()) throw new Error("Could not find your user profile.");
                const userDataVal: UserProfile = userSnap.val();
                setUserData(userDataVal);

                if (!coursePathsSnap.exists()) throw new Error("Course paths have not been set up by the administration.");

                const allCoursePathsData = coursePathsSnap.val();
                const allCoursePaths: CoursePath[] = Object.keys(allCoursePathsData).map(id => ({ id, ...allCoursePathsData[id] }));
                
                const userPath = allCoursePaths.find(p => p.intakeId === userDataVal.intakeId && p.programmeId === userDataVal.programmeId);
                
                if (!userPath) {
                    throw new Error("A course path has not been defined for your intake and programme.");
                }
                
                // Step 4: Load all necessary data for the page
                const allCourses = coursesSnap.val() || {};
                const allSemesters = semestersSnap.val() || {};
                const allPaymentPlans = paymentPlansSnap.val() || {};
                const allProgrammes = programmesSnap.val() || {};
                const allIntakes = intakesSnap.val() || {};

                const programmeData = allProgrammes[userDataVal.programmeId];
                if (programmeData) {
                    setProgramme({ id: userDataVal.programmeId, ...programmeData });
                }

                const intakeName = allIntakes[userPath.intakeId]?.name || '';
                const semesterNamePattern = `${intakeName} Year ${yearParam} Semester ${semesterInYearParam}`;
                const foundSemesterEntry = Object.entries(allSemesters as Record<string, Semester>).find(([id, sem]) => sem.name === semesterNamePattern);

                if(!foundSemesterEntry) throw new Error(`Semester details for "${semesterNamePattern}" could not be found. Please contact administration.`);
                const [semesterId, semesterData] = foundSemesterEntry;

                const offerings = semesterOfferingsSnap.val() || {};
                const pathOfferings = offerings[userPath.id] || {};
                
                let semNumForPath = -1;
                 for (const semNumKey in userPath.semesters) {
                    const year = Math.floor((Number(semNumKey) - 1) / 2) + 1;
                    const semesterInYear = ((Number(semNumKey) - 1) % 2) + 1;
                    if(year === Number(yearParam) && semesterInYear === Number(semesterInYearParam)){
                        semNumForPath = Number(semNumKey);
                        break;
                    }
                }
                if (semNumForPath === -1 || !pathOfferings[semNumForPath]?.active) {
                    throw new Error("Registration for this semester is not currently open.");
                }

                const semesterCourseIds = userPath.semesters[semNumForPath]?.courses || [];
                const semesterCourses = semesterCourseIds.map((id: string) => ({ id, ...allCourses[id] }));
                setCoursesForSemester(semesterCourses);
                
                setSemesterDetails({id: semesterId, ...semesterData});

                if (semesterData.paymentPlanIds) {
                    const available = Object.keys(semesterData.paymentPlanIds)
                        .map(planId => allPaymentPlans[planId] ? { id: planId, ...allPaymentPlans[planId] } : null)
                        .filter(p => p && !p.archived) as PaymentPlan[];
                    setAvailablePaymentPlans(available);
                    if(available.length > 0) setSelectedPaymentPlan(available[0].name);
                }

                const initialSelectedCourses = semesterCourses
                    .map(c => c.id)
                    .filter(id => !userDataVal.exemptedCourses?.[id]);
                setSelectedCourseIds(initialSelectedCourses);

            } catch (error: any) {
                console.error(error);
                setError(error.message);
                toast({ variant: 'destructive', title: 'Error', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, yearParam, semesterInYearParam, router, toast]);

    const toggleCourseSelection = (courseId: string) => {
        if (programme?.tuitionFee) return;
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
            
            const newInvoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
            const invoiceId = newInvoiceRef.key!;

            const tuitionCost = programme?.tuitionFee ? programme.tuitionFee : selectedCourseIds.reduce((sum, id) => sum + (coursesForSemester.find(c => c.id === id)?.cost || 0), 0);
            
            const mandatoryFeesCost = Object.values(semesterDetails.mandatoryFees || {}).reduce((sum, fee) => sum + fee.amount, 0);
            const optionalFeesCost = selectedOptionalFees.reduce((sum, id) => sum + (semesterDetails.optionalFees?.[id]?.amount || 0), 0);

            await set(newInvoiceRef, {
                invoiceId,
                totalTuition: tuitionCost,
                totalMandatoryFees: mandatoryFeesCost,
                totalOptionalFees: optionalFeesCost,
                paymentPlan: selectedPaymentPlan,
                dateCreated: new Date().toISOString(),
                semester: semesterDetails.name,
                semesterId: semesterDetails.id,
                courses: selectedCourseIds,
                optionalFees: selectedOptionalFees,
                applyScholarship: applyScholarship,
            });

            await set(registrationRef, {
                courses: selectedCourseIds,
                coursePriority: selectedCourseIds,
                optionalFees: selectedOptionalFees,
                invoiceId,
                status: 'Pending Approval',
                paymentPlan: selectedPaymentPlan,
                programmeId: userData.programmeId,
                registrationDate: new Date().toISOString(),
                applyScholarship: applyScholarship,
                semesterName: semesterDetails.name,
            });
            
            const registrarIds = await getRegistrarIds();
            const notificationPromises = registrarIds.map(id => 
                createNotification(id, `${userData.name} has submitted a new course registration for review.`, '/admin/approve-registrations')
            );
            await Promise.all(notificationPromises);

            toast({ variant: 'success', title: "Registration Submitted!", description: "Your registration is now pending approval." });
            router.push('/student/payments');

        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Registration failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="space-y-4"><Skeleton className="h-96 w-full"/></div>
    }

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

    const isFlatFee = !!programme?.tuitionFee && programme.tuitionFee > 0;

    return (
        <div className="space-y-6">
            <Button variant="outline" asChild><Link href="/student/registration"><ChevronLeft className="mr-2 h-4 w-4"/>Back to Semesters</Link></Button>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Register for {semesterDetails?.name}</CardTitle>
                    <CardDescription>Confirm your courses, select fees and a payment plan to complete your registration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="space-y-2">
                        <h3 className="font-semibold">Courses for this Semester</h3>
                        {isFlatFee && <Alert><Info className="h-4 w-4"/><AlertDescription>This programme has a flat semester fee, so all courses below are required and pre-selected.</AlertDescription></Alert>}
                        <div className="grid md:grid-cols-2 gap-2">
                            {coursesForSemester.map(course => (
                                <div key={course.id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
                                    <Checkbox 
                                        id={course.id} 
                                        checked={selectedCourseIds.includes(course.id)} 
                                        onCheckedChange={() => toggleCourseSelection(course.id)}
                                        disabled={isFlatFee || !!userData?.exemptedCourses?.[course.id]}
                                    />
                                    <Label htmlFor={course.id} className={`flex-1 ${isFlatFee ? 'cursor-default' : 'cursor-pointer'}`}>
                                        <p>{course.name}</p>
                                        <p className="text-xs text-muted-foreground">{course.code} - ZMW {course.cost.toFixed(2)}</p>
                                    </Label>
                                    {!!userData?.exemptedCourses?.[course.id] && <Badge variant="secondary">Exempted</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>
                    {Object.keys(semesterDetails?.optionalFees || {}).length > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold">Optional Fees</h3>
                             <div className="grid md:grid-cols-2 gap-2">
                                {Object.entries(semesterDetails!.optionalFees!).map(([id, fee]) => (
                                    <div key={id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
                                        <Checkbox id={id} checked={selectedOptionalFees.includes(id)} onCheckedChange={() => toggleOptionalFee(id)} />
                                        <Label htmlFor={id} className="flex-1 cursor-pointer">
                                            <p>{fee.name}</p>
                                            <p className="text-xs text-muted-foreground">ZMW {fee.amount.toFixed(2)}</p>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <Separator/>
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Payment Plan</Label>
                            <Select value={selectedPaymentPlan} onValueChange={setSelectedPaymentPlan}>
                                <SelectTrigger><SelectValue placeholder="Select a payment plan..." /></SelectTrigger>
                                <SelectContent>{availablePaymentPlans.map(p => <SelectItem key={p.id} value={p.name}>{p.name} ({p.installments} installment{p.installments > 1 ? 's' : ''})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                         <div className="flex items-end">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="apply-scholarship" checked={applyScholarship} onCheckedChange={c => setApplyScholarship(!!c)}/>
                                <Label htmlFor="apply-scholarship">I have a scholarship (100% Tuition Waiver)</Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSubmitRegistration} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Complete Registration
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
